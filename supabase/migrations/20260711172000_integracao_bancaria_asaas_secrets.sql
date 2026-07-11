-- Seguranca da integracao bancaria Asaas.
-- Tokens ficam no Supabase Vault; a tabela guarda apenas metadados e IDs dos segredos.

CREATE SCHEMA IF NOT EXISTS vault;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

ALTER TABLE public.configuracoes_integracao_bancaria
  DROP CONSTRAINT IF EXISTS configuracoes_integracao_bancaria_empresa_id_provedor_key;

CREATE UNIQUE INDEX IF NOT EXISTS configuracoes_integracao_bancaria_empresa_provedor_idx
  ON public.configuracoes_integracao_bancaria (empresa_id, provedor);

CREATE TABLE IF NOT EXISTS public.asaas_webhook_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ambiente varchar(20) NOT NULL CHECK (ambiente IN ('producao', 'homologacao')),
  external_event_id text NOT NULL,
  event_type text NOT NULL DEFAULT 'UNKNOWN',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(24) NOT NULL DEFAULT 'recebido' CHECK (status IN ('recebido', 'duplicado', 'processado', 'erro')),
  erro text,
  recebido_em timestamptz NOT NULL DEFAULT now(),
  processado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, ambiente, external_event_id)
);

CREATE INDEX IF NOT EXISTS idx_asaas_webhook_eventos_empresa_recebido
  ON public.asaas_webhook_eventos (empresa_id, recebido_em DESC);

ALTER TABLE public.asaas_webhook_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS asaas_webhook_eventos_tenant_policy ON public.asaas_webhook_eventos;
CREATE POLICY asaas_webhook_eventos_tenant_policy ON public.asaas_webhook_eventos
  FOR SELECT TO authenticated
  USING (public.is_empresa_member(empresa_id));

DROP TRIGGER IF EXISTS set_asaas_webhook_eventos_updated_at ON public.asaas_webhook_eventos;
CREATE TRIGGER set_asaas_webhook_eventos_updated_at
  BEFORE UPDATE ON public.asaas_webhook_eventos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.normalize_asaas_environment(p_ambiente text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN lower(coalesce(p_ambiente, '')) IN ('producao', 'production', 'prod') THEN 'producao'
    ELSE 'homologacao'
  END
$$;

CREATE OR REPLACE FUNCTION public.upsert_vault_secret(
  p_secret_id uuid,
  p_secret text,
  p_name text,
  p_description text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_secret_id uuid := p_secret_id;
BEGIN
  IF NULLIF(trim(coalesce(p_secret, '')), '') IS NULL THEN
    RETURN v_secret_id;
  END IF;

  IF v_secret_id IS NULL THEN
    SELECT ds.id
      INTO v_secret_id
    FROM vault.decrypted_secrets ds
    WHERE ds.name = p_name
    LIMIT 1;
  END IF;

  IF v_secret_id IS NULL THEN
    SELECT vault.create_secret(p_secret, p_name, p_description)
      INTO v_secret_id;
  ELSE
    PERFORM vault.update_secret(v_secret_id, p_secret, p_name, p_description);
  END IF;

  RETURN v_secret_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.format_asaas_environment_response(
  p_environment jsonb,
  p_default_webhook_url text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'apiKey', '',
    'apiKeyConfigured', (p_environment ? 'api_key_secret_id') OR coalesce((p_environment->>'apiKeyConfigured')::boolean, false),
    'webhookUrl', coalesce(NULLIF(p_environment->>'webhookUrl', ''), NULLIF(p_environment->>'webhook_url', ''), p_default_webhook_url),
    'webhookToken', '',
    'webhookTokenConfigured', (p_environment ? 'webhook_token_secret_id') OR coalesce((p_environment->>'webhookTokenConfigured')::boolean, false),
    'emailNotificacao', coalesce((p_environment->>'emailNotificacao')::boolean, true),
    'aceitaBoleto', coalesce((p_environment->>'aceitaBoleto')::boolean, true),
    'aceitaPix', coalesce((p_environment->>'aceitaPix')::boolean, true),
    'aceitaCartao', coalesce((p_environment->>'aceitaCartao')::boolean, false),
    'checkoutAtivo', coalesce((p_environment->>'checkoutAtivo')::boolean, true),
    'maxParcelas', least(greatest(coalesce((p_environment->>'maxParcelas')::integer, 12), 1), 12)
  )
$$;

CREATE OR REPLACE FUNCTION public.listar_configuracao_asaas()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_config jsonb := '{}'::jsonb;
  v_active_environment text := 'homologacao';
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  SELECT c.configuracao
    INTO v_config
  FROM public.configuracoes_integracao_bancaria c
  WHERE c.empresa_id = v_empresa_id
    AND c.provedor = 'asaas'
  LIMIT 1;

  v_config := coalesce(v_config, '{}'::jsonb);
  v_active_environment := public.normalize_asaas_environment(coalesce(v_config->>'activeEnvironment', v_config->>'ambiente', 'homologacao'));

  RETURN jsonb_build_object(
    'activeEnvironment', v_active_environment,
    'environments', jsonb_build_object(
      'producao', public.format_asaas_environment_response(coalesce(v_config->'environments'->'producao', '{}'::jsonb), ''),
      'homologacao', public.format_asaas_environment_response(coalesce(v_config->'environments'->'homologacao', '{}'::jsonb), '')
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.build_asaas_environment_config(
  p_empresa_id uuid,
  p_ambiente text,
  p_current jsonb,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_ambiente text := public.normalize_asaas_environment(p_ambiente);
  v_api_key_secret_id uuid := NULLIF(p_current->>'api_key_secret_id', '')::uuid;
  v_webhook_token_secret_id uuid := NULLIF(p_current->>'webhook_token_secret_id', '')::uuid;
  v_secret_prefix text := 'empresa_' || p_empresa_id::text || '_asaas_' || v_ambiente;
  v_api_key text := p_payload->>'apiKey';
  v_webhook_token text := p_payload->>'webhookToken';
BEGIN
  v_api_key_secret_id := public.upsert_vault_secret(
    v_api_key_secret_id,
    v_api_key,
    v_secret_prefix || '_api_key',
    'Chave de API Asaas ' || v_ambiente || ' da empresa ' || p_empresa_id::text
  );

  v_webhook_token_secret_id := public.upsert_vault_secret(
    v_webhook_token_secret_id,
    v_webhook_token,
    v_secret_prefix || '_webhook_token',
    'Token de webhook Asaas ' || v_ambiente || ' da empresa ' || p_empresa_id::text
  );

  RETURN jsonb_build_object(
    'api_key_secret_id', v_api_key_secret_id,
    'apiKeyConfigured', v_api_key_secret_id IS NOT NULL,
    'webhookUrl', coalesce(NULLIF(p_payload->>'webhookUrl', ''), NULLIF(p_current->>'webhookUrl', '')),
    'webhook_token_secret_id', v_webhook_token_secret_id,
    'webhookTokenConfigured', v_webhook_token_secret_id IS NOT NULL,
    'emailNotificacao', coalesce((p_payload->>'emailNotificacao')::boolean, (p_current->>'emailNotificacao')::boolean, true),
    'aceitaBoleto', coalesce((p_payload->>'aceitaBoleto')::boolean, (p_current->>'aceitaBoleto')::boolean, true),
    'aceitaPix', coalesce((p_payload->>'aceitaPix')::boolean, (p_current->>'aceitaPix')::boolean, true),
    'aceitaCartao', coalesce((p_payload->>'aceitaCartao')::boolean, (p_current->>'aceitaCartao')::boolean, false),
    'checkoutAtivo', coalesce((p_payload->>'checkoutAtivo')::boolean, (p_current->>'checkoutAtivo')::boolean, true),
    'maxParcelas', least(greatest(coalesce((p_payload->>'maxParcelas')::integer, (p_current->>'maxParcelas')::integer, 12), 1), 12)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_configuracao_asaas(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_current_config jsonb := '{}'::jsonb;
  v_active_environment text := public.normalize_asaas_environment(p_payload->>'activeEnvironment');
  v_prod jsonb;
  v_hmlg jsonb;
  v_config jsonb;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  SELECT c.configuracao
    INTO v_current_config
  FROM public.configuracoes_integracao_bancaria c
  WHERE c.empresa_id = v_empresa_id
    AND c.provedor = 'asaas'
  LIMIT 1;

  v_current_config := coalesce(v_current_config, '{}'::jsonb);

  v_prod := public.build_asaas_environment_config(
    v_empresa_id,
    'producao',
    coalesce(v_current_config->'environments'->'producao', '{}'::jsonb),
    coalesce(p_payload->'environments'->'producao', '{}'::jsonb)
  );

  v_hmlg := public.build_asaas_environment_config(
    v_empresa_id,
    'homologacao',
    coalesce(v_current_config->'environments'->'homologacao', '{}'::jsonb),
    coalesce(p_payload->'environments'->'homologacao', '{}'::jsonb)
  );

  v_config := jsonb_build_object(
    'gateway', 'asaas',
    'activeEnvironment', v_active_environment,
    'environments', jsonb_build_object(
      'producao', v_prod,
      'homologacao', v_hmlg
    )
  );

  INSERT INTO public.configuracoes_integracao_bancaria (
    empresa_id, provedor, ambiente, ativo, configuracao
  )
  VALUES (
    v_empresa_id,
    'asaas',
    CASE WHEN v_active_environment = 'producao' THEN 'producao' ELSE 'sandbox' END,
    true,
    v_config
  )
  ON CONFLICT (empresa_id, provedor) DO UPDATE SET
    ambiente = EXCLUDED.ambiente,
    ativo = true,
    configuracao = EXCLUDED.configuracao,
    updated_at = now();

  RETURN public.listar_configuracao_asaas();
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_asaas_webhook_evento(
  p_ambiente text,
  p_token text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_ambiente text := public.normalize_asaas_environment(p_ambiente);
  v_empresa_id uuid;
  v_event_id text;
  v_event_type text;
  v_row public.asaas_webhook_eventos;
BEGIN
  IF NULLIF(trim(coalesce(p_token, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Token do webhook ausente.';
  END IF;

  SELECT c.empresa_id
    INTO v_empresa_id
  FROM public.configuracoes_integracao_bancaria c
  JOIN vault.decrypted_secrets s
    ON s.id = NULLIF(c.configuracao->'environments'->v_ambiente->>'webhook_token_secret_id', '')::uuid
  WHERE c.provedor = 'asaas'
    AND s.decrypted_secret = p_token
  LIMIT 1;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Token do webhook invalido.';
  END IF;

  v_event_type := coalesce(p_payload->>'event', p_payload->>'type', 'UNKNOWN');
  v_event_id := coalesce(
    NULLIF(p_payload->>'id', ''),
    NULLIF(p_payload->'payment'->>'id', ''),
    encode(digest(p_payload::text, 'sha256'), 'hex')
  );

  INSERT INTO public.asaas_webhook_eventos (
    empresa_id, ambiente, external_event_id, event_type, payload
  )
  VALUES (
    v_empresa_id, v_ambiente, v_event_id, v_event_type, p_payload
  )
  ON CONFLICT (empresa_id, ambiente, external_event_id) DO UPDATE SET
    status = 'duplicado',
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'empresa_id', v_row.empresa_id,
    'ambiente', v_row.ambiente,
    'event_id', v_row.external_event_id,
    'event_type', v_row.event_type,
    'status', v_row.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_vault_secret(uuid, text, text, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.build_asaas_environment_config(uuid, text, jsonb, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.listar_configuracao_asaas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_configuracao_asaas(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_asaas_webhook_evento(text, text, jsonb) TO service_role;
