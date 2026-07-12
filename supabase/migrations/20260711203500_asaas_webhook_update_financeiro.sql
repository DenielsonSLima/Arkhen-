-- Atualiza contas a receber a partir dos eventos de webhook Asaas.

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
  v_financeiro_result jsonb := '{}'::jsonb;
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

  v_financeiro_result := public.atualizar_cobranca_asaas_webhook(v_empresa_id, v_ambiente, p_payload);

  RETURN jsonb_build_object(
    'ok', true,
    'empresa_id', v_row.empresa_id,
    'ambiente', v_row.ambiente,
    'event_id', v_row.external_event_id,
    'event_type', v_row.event_type,
    'status', v_row.status,
    'financeiro', v_financeiro_result
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_asaas_webhook_evento(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_asaas_webhook_evento(text, text, jsonb) TO service_role;
