-- Adiciona opcoes do webhook Asaas e permite rotear ambiente pelo token.

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
    'apiKeyConfigured', NULLIF(p_environment->>'api_key_secret_id', '') IS NOT NULL
      OR coalesce((p_environment->>'apiKeyConfigured')::boolean, false),
    'apiVersion', CASE WHEN p_environment->>'apiVersion' = 'v2' THEN 'v2' ELSE 'v3' END,
    'webhookUrl', coalesce(NULLIF(p_environment->>'webhookUrl', ''), NULLIF(p_environment->>'webhook_url', ''), p_default_webhook_url),
    'webhookToken', '',
    'webhookTokenConfigured', NULLIF(p_environment->>'webhook_token_secret_id', '') IS NOT NULL
      OR coalesce((p_environment->>'webhookTokenConfigured')::boolean, false),
    'tipoEnvio', CASE WHEN p_environment->>'tipoEnvio' = 'nao_sequencial' THEN 'nao_sequencial' ELSE 'sequencial' END,
    'filaSincronizacaoAtiva', coalesce((p_environment->>'filaSincronizacaoAtiva')::boolean, false),
    'emailNotificacao', coalesce((p_environment->>'emailNotificacao')::boolean, true),
    'aceitaBoleto', coalesce((p_environment->>'aceitaBoleto')::boolean, true),
    'aceitaPix', coalesce((p_environment->>'aceitaPix')::boolean, true),
    'aceitaCartao', coalesce((p_environment->>'aceitaCartao')::boolean, false),
    'checkoutAtivo', coalesce((p_environment->>'checkoutAtivo')::boolean, true),
    'maxParcelas', least(greatest(coalesce((p_environment->>'maxParcelas')::integer, 12), 1), 12)
  )
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
    'apiVersion', CASE WHEN p_payload->>'apiVersion' = 'v2' THEN 'v2' ELSE 'v3' END,
    'webhookUrl', coalesce(NULLIF(p_payload->>'webhookUrl', ''), NULLIF(p_current->>'webhookUrl', '')),
    'webhook_token_secret_id', v_webhook_token_secret_id,
    'webhookTokenConfigured', v_webhook_token_secret_id IS NOT NULL,
    'tipoEnvio', CASE WHEN p_payload->>'tipoEnvio' = 'nao_sequencial' THEN 'nao_sequencial' ELSE 'sequencial' END,
    'filaSincronizacaoAtiva', coalesce((p_payload->>'filaSincronizacaoAtiva')::boolean, (p_current->>'filaSincronizacaoAtiva')::boolean, false),
    'emailNotificacao', coalesce((p_payload->>'emailNotificacao')::boolean, (p_current->>'emailNotificacao')::boolean, true),
    'aceitaBoleto', coalesce((p_payload->>'aceitaBoleto')::boolean, (p_current->>'aceitaBoleto')::boolean, true),
    'aceitaPix', coalesce((p_payload->>'aceitaPix')::boolean, (p_current->>'aceitaPix')::boolean, true),
    'aceitaCartao', coalesce((p_payload->>'aceitaCartao')::boolean, (p_current->>'aceitaCartao')::boolean, false),
    'checkoutAtivo', coalesce((p_payload->>'checkoutAtivo')::boolean, (p_current->>'checkoutAtivo')::boolean, true),
    'maxParcelas', least(greatest(coalesce((p_payload->>'maxParcelas')::integer, (p_current->>'maxParcelas')::integer, 12), 1), 12)
  );
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
  v_requested_ambiente text := CASE
    WHEN NULLIF(trim(coalesce(p_ambiente, '')), '') IS NULL THEN NULL
    ELSE public.normalize_asaas_environment(p_ambiente)
  END;
  v_ambiente text;
  v_empresa_id uuid;
  v_event_id text;
  v_event_type text;
  v_row public.asaas_webhook_eventos;
BEGIN
  IF NULLIF(trim(coalesce(p_token, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Token do webhook ausente.';
  END IF;

  SELECT c.empresa_id, env.ambiente
    INTO v_empresa_id, v_ambiente
  FROM public.configuracoes_integracao_bancaria c
  CROSS JOIN LATERAL (
    VALUES
      ('producao', c.configuracao->'environments'->'producao'->>'webhook_token_secret_id'),
      ('homologacao', c.configuracao->'environments'->'homologacao'->>'webhook_token_secret_id')
  ) AS env(ambiente, secret_id)
  JOIN vault.decrypted_secrets s
    ON s.id = NULLIF(env.secret_id, '')::uuid
  WHERE c.provedor = 'asaas'
    AND (v_requested_ambiente IS NULL OR env.ambiente = v_requested_ambiente)
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

REVOKE ALL ON FUNCTION public.build_asaas_environment_config(uuid, text, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_asaas_webhook_evento(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_asaas_webhook_evento(text, text, jsonb) TO service_role;
