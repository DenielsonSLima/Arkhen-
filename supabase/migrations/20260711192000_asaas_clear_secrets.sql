-- Permite remover credenciais Asaas desvinculando os segredos da configuracao.

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
  v_clear_api_key boolean := coalesce((p_payload->>'clearApiKey')::boolean, false);
  v_clear_webhook_token boolean := coalesce((p_payload->>'clearWebhookToken')::boolean, false);
BEGIN
  IF v_clear_api_key THEN
    IF v_api_key_secret_id IS NOT NULL THEN
      PERFORM vault.update_secret(
        v_api_key_secret_id,
        'removed-' || gen_random_uuid()::text,
        v_secret_prefix || '_api_key_removed_' || replace(gen_random_uuid()::text, '-', ''),
        'Chave de API Asaas removida da configuracao em ' || now()::text
      );
    END IF;
    v_api_key_secret_id := NULL;
  ELSE
    v_api_key_secret_id := public.upsert_vault_secret(
      v_api_key_secret_id,
      v_api_key,
      v_secret_prefix || '_api_key',
      'Chave de API Asaas ' || v_ambiente || ' da empresa ' || p_empresa_id::text
    );
  END IF;

  IF v_clear_webhook_token THEN
    IF v_webhook_token_secret_id IS NOT NULL THEN
      PERFORM vault.update_secret(
        v_webhook_token_secret_id,
        'removed-' || gen_random_uuid()::text,
        v_secret_prefix || '_webhook_token_removed_' || replace(gen_random_uuid()::text, '-', ''),
        'Token de webhook Asaas removido da configuracao em ' || now()::text
      );
    END IF;
    v_webhook_token_secret_id := NULL;
  ELSE
    v_webhook_token_secret_id := public.upsert_vault_secret(
      v_webhook_token_secret_id,
      v_webhook_token,
      v_secret_prefix || '_webhook_token',
      'Token de webhook Asaas ' || v_ambiente || ' da empresa ' || p_empresa_id::text
    );
  END IF;

  RETURN jsonb_build_object(
    'api_key_secret_id', v_api_key_secret_id,
    'apiKeyConfigured', v_api_key_secret_id IS NOT NULL,
    'clearApiKey', false,
    'apiVersion', CASE WHEN p_payload->>'apiVersion' = 'v2' THEN 'v2' ELSE 'v3' END,
    'webhookUrl', coalesce(NULLIF(p_payload->>'webhookUrl', ''), NULLIF(p_current->>'webhookUrl', '')),
    'webhook_token_secret_id', v_webhook_token_secret_id,
    'webhookTokenConfigured', v_webhook_token_secret_id IS NOT NULL,
    'clearWebhookToken', false,
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

REVOKE ALL ON FUNCTION public.build_asaas_environment_config(uuid, text, jsonb, jsonb) FROM PUBLIC;
