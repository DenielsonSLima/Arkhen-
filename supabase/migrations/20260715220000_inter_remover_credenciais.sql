-- Permite remover credenciais Inter sem expor ou preservar o segredo anterior.
CREATE OR REPLACE FUNCTION public.build_inter_environment_config(
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
  v_ambiente text := public.normalize_inter_environment(p_ambiente);
  v_prefix text := 'empresa_' || p_empresa_id::text || '_inter_' || v_ambiente;
  v_client_id text := coalesce(p_payload->>'clientId', p_payload->>'client_id');
  v_client_secret text := coalesce(p_payload->>'clientSecret', p_payload->>'client_secret');
  v_certificado text := coalesce(p_payload->>'certificadoPem', p_payload->>'certificado_pem');
  v_chave text := coalesce(p_payload->>'chavePrivadaPem', p_payload->>'chave_privada_pem');
  v_conta text := '';
  v_pix text := left(trim(coalesce(NULLIF(p_payload->>'chavePix', ''),
    NULLIF(p_payload->>'chave_pix', ''), p_current->>'chavePix', '')), 180);
  v_client_id_id uuid := NULLIF(p_current->>'client_id_secret_id', '')::uuid;
  v_client_secret_id uuid := NULLIF(p_current->>'client_secret_secret_id', '')::uuid;
  v_certificado_id uuid := NULLIF(p_current->>'certificado_pem_secret_id', '')::uuid;
  v_chave_id uuid := NULLIF(p_current->>'chave_privada_pem_secret_id', '')::uuid;
  v_clear_client_secret boolean := public.inter_jsonb_boolean(p_payload, 'clearClientSecret', false);
  v_clear_certificado boolean := public.inter_jsonb_boolean(p_payload, 'clearCertificate', false);
  v_clear_chave boolean := public.inter_jsonb_boolean(p_payload, 'clearPrivateKey', false);
  v_base_url text;
  v_auth_url text;
BEGIN
  IF length(coalesce(v_client_id, '')) > 5000 OR length(coalesce(v_client_secret, '')) > 5000
    OR length(coalesce(v_certificado, '')) > 100000 OR length(coalesce(v_chave, '')) > 100000 THEN
    RAISE EXCEPTION 'Credencial Inter excede o limite permitido.';
  END IF;
  IF NULLIF(v_certificado, '') IS NOT NULL AND v_certificado NOT LIKE '%BEGIN CERTIFICATE%' THEN
    RAISE EXCEPTION 'Certificado PEM invalido.';
  END IF;
  IF NULLIF(v_chave, '') IS NOT NULL AND v_chave NOT LIKE '%BEGIN%PRIVATE KEY%' THEN
    RAISE EXCEPTION 'Chave privada PEM invalida.';
  END IF;

  v_client_id_id := public.upsert_vault_secret(v_client_id_id, v_client_id, v_prefix || '_client_id',
    'Client ID Banco Inter ' || v_ambiente || ' da empresa ' || p_empresa_id::text);

  IF v_clear_client_secret THEN
    IF v_client_secret_id IS NOT NULL THEN
      PERFORM vault.update_secret(v_client_secret_id, 'removed-' || gen_random_uuid()::text,
        v_prefix || '_client_secret_removed_' || replace(gen_random_uuid()::text, '-', ''),
        'Client Secret Banco Inter removido da configuracao em ' || now()::text);
    END IF;
    v_client_secret_id := NULL;
  ELSE
    v_client_secret_id := public.upsert_vault_secret(v_client_secret_id, v_client_secret, v_prefix || '_client_secret',
      'Client Secret Banco Inter ' || v_ambiente || ' da empresa ' || p_empresa_id::text);
  END IF;

  IF v_clear_certificado THEN
    IF v_certificado_id IS NOT NULL THEN
      PERFORM vault.update_secret(v_certificado_id, 'removed-' || gen_random_uuid()::text,
        v_prefix || '_certificado_pem_removed_' || replace(gen_random_uuid()::text, '-', ''),
        'Certificado mTLS Banco Inter removido da configuracao em ' || now()::text);
    END IF;
    v_certificado_id := NULL;
  ELSE
    v_certificado_id := public.upsert_vault_secret(v_certificado_id, v_certificado, v_prefix || '_certificado_pem',
      'Certificado mTLS Banco Inter ' || v_ambiente || ' da empresa ' || p_empresa_id::text);
  END IF;

  IF v_clear_chave THEN
    IF v_chave_id IS NOT NULL THEN
      PERFORM vault.update_secret(v_chave_id, 'removed-' || gen_random_uuid()::text,
        v_prefix || '_chave_privada_pem_removed_' || replace(gen_random_uuid()::text, '-', ''),
        'Chave privada mTLS Banco Inter removida da configuracao em ' || now()::text);
    END IF;
    v_chave_id := NULL;
  ELSE
    v_chave_id := public.upsert_vault_secret(v_chave_id, v_chave, v_prefix || '_chave_privada_pem',
      'Chave privada mTLS Banco Inter ' || v_ambiente || ' da empresa ' || p_empresa_id::text);
  END IF;

  v_base_url := coalesce(NULLIF(p_payload->>'baseUrl', ''), NULLIF(p_payload->>'base_url', ''),
    NULLIF(p_current->>'baseUrl', ''), CASE WHEN v_ambiente = 'producao'
    THEN 'https://cdpj.partners.bancointer.com.br' ELSE 'https://cdpj-sandbox.partners.uatinter.co' END);
  v_auth_url := coalesce(NULLIF(p_payload->>'authUrl', ''), NULLIF(p_payload->>'auth_url', ''),
    NULLIF(p_current->>'authUrl', ''), v_base_url || '/oauth/v2/token');

  RETURN jsonb_build_object(
    'client_id_secret_id', v_client_id_id, 'client_secret_secret_id', v_client_secret_id,
    'certificado_pem_secret_id', v_certificado_id, 'chave_privada_pem_secret_id', v_chave_id,
    'contaCorrente', v_conta, 'chavePix', v_pix, 'baseUrl', v_base_url, 'authUrl', v_auth_url,
    'boletoAtivo', public.inter_jsonb_boolean(p_payload, 'boletoAtivo', public.inter_jsonb_boolean(p_current, 'boletoAtivo', true)),
    'pixAtivo', public.inter_jsonb_boolean(p_payload, 'pixAtivo', public.inter_jsonb_boolean(p_current, 'pixAtivo', true)),
    'webhookAtivo', public.inter_jsonb_boolean(p_payload, 'webhookAtivo', public.inter_jsonb_boolean(p_current, 'webhookAtivo', true)),
    'notificacoesAtivas', public.inter_jsonb_boolean(p_payload, 'notificacoesAtivas', public.inter_jsonb_boolean(p_current, 'notificacoesAtivas', true)),
    'webhookUrl', left(coalesce(NULLIF(p_payload->>'webhookUrl', ''), p_current->>'webhookUrl', ''), 2048),
    'ultimoTesteOk', public.inter_jsonb_boolean(p_current, 'ultimoTesteOk', false),
    'ultimoTesteEm', p_current->>'ultimoTesteEm');
END;
$$;
