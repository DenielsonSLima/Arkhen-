-- Corrige flags de configuracao para considerar apenas secret_id preenchido.

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
    'webhookUrl', coalesce(NULLIF(p_environment->>'webhookUrl', ''), NULLIF(p_environment->>'webhook_url', ''), p_default_webhook_url),
    'webhookToken', '',
    'webhookTokenConfigured', NULLIF(p_environment->>'webhook_token_secret_id', '') IS NOT NULL
      OR coalesce((p_environment->>'webhookTokenConfigured')::boolean, false),
    'emailNotificacao', coalesce((p_environment->>'emailNotificacao')::boolean, true),
    'aceitaBoleto', coalesce((p_environment->>'aceitaBoleto')::boolean, true),
    'aceitaPix', coalesce((p_environment->>'aceitaPix')::boolean, true),
    'aceitaCartao', coalesce((p_environment->>'aceitaCartao')::boolean, false),
    'checkoutAtivo', coalesce((p_environment->>'checkoutAtivo')::boolean, true),
    'maxParcelas', least(greatest(coalesce((p_environment->>'maxParcelas')::integer, 12), 1), 12)
  )
$$;
