-- Corrige selecao/configuracao multi-banco sem reescrever migrations aplicadas.
CREATE OR REPLACE FUNCTION public.build_inter_environment_config(
  p_empresa_id uuid, p_ambiente text, p_current jsonb, p_payload jsonb
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
  v_conta text := ltrim(regexp_replace(coalesce(NULLIF(p_payload->>'contaCorrente', ''),
    NULLIF(p_payload->>'conta_corrente', ''), p_current->>'contaCorrente', ''), '[^0-9]', '', 'g'), '0');
  v_pix text := left(trim(coalesce(NULLIF(p_payload->>'chavePix', ''),
    NULLIF(p_payload->>'chave_pix', ''), p_current->>'chavePix', '')), 180);
  v_client_id_id uuid := NULLIF(p_current->>'client_id_secret_id', '')::uuid;
  v_client_secret_id uuid := NULLIF(p_current->>'client_secret_secret_id', '')::uuid;
  v_certificado_id uuid := NULLIF(p_current->>'certificado_pem_secret_id', '')::uuid;
  v_chave_id uuid := NULLIF(p_current->>'chave_privada_pem_secret_id', '')::uuid;
  v_base_url text; v_auth_url text;
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
  IF v_conta <> '' AND length(v_conta) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Conta corrente Inter invalida.'; END IF;
  v_client_id_id := public.upsert_vault_secret(v_client_id_id, v_client_id, v_prefix || '_client_id',
    'Client ID Banco Inter ' || v_ambiente || ' da empresa ' || p_empresa_id::text);
  v_client_secret_id := public.upsert_vault_secret(v_client_secret_id, v_client_secret, v_prefix || '_client_secret',
    'Client Secret Banco Inter ' || v_ambiente || ' da empresa ' || p_empresa_id::text);
  v_certificado_id := public.upsert_vault_secret(v_certificado_id, v_certificado, v_prefix || '_certificado_pem',
    'Certificado mTLS Banco Inter ' || v_ambiente || ' da empresa ' || p_empresa_id::text);
  v_chave_id := public.upsert_vault_secret(v_chave_id, v_chave, v_prefix || '_chave_privada_pem',
    'Chave privada mTLS Banco Inter ' || v_ambiente || ' da empresa ' || p_empresa_id::text);
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
CREATE OR REPLACE FUNCTION public.format_inter_environment_response(p_environment jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'clientId', '', 'clientIdConfigured', NULLIF(p_environment->>'client_id_secret_id', '') IS NOT NULL,
    'clientSecret', '', 'clientSecretConfigured', NULLIF(p_environment->>'client_secret_secret_id', '') IS NOT NULL,
    'certificadoPem', '', 'certificadoConfigurado', NULLIF(p_environment->>'certificado_pem_secret_id', '') IS NOT NULL,
    'certificateConfigured', NULLIF(p_environment->>'certificado_pem_secret_id', '') IS NOT NULL,
    'chavePrivadaPem', '', 'chavePrivadaConfigurada', NULLIF(p_environment->>'chave_privada_pem_secret_id', '') IS NOT NULL,
    'privateKeyConfigured', NULLIF(p_environment->>'chave_privada_pem_secret_id', '') IS NOT NULL,
    'contaCorrente', coalesce(p_environment->>'contaCorrente', ''), 'chavePix', coalesce(p_environment->>'chavePix', ''),
    'baseUrl', coalesce(p_environment->>'baseUrl', ''), 'authUrl', coalesce(p_environment->>'authUrl', ''),
    'boletoAtivo', public.inter_jsonb_boolean(p_environment, 'boletoAtivo', true),
    'pixAtivo', public.inter_jsonb_boolean(p_environment, 'pixAtivo', true),
    'webhookAtivo', public.inter_jsonb_boolean(p_environment, 'webhookAtivo', true),
    'notificacoesAtivas', public.inter_jsonb_boolean(p_environment, 'notificacoesAtivas', true),
    'webhookUrl', coalesce(p_environment->>'webhookUrl', ''),
    'ultimoTesteOk', public.inter_jsonb_boolean(p_environment, 'ultimoTesteOk', false),
    'ultimoTesteEm', p_environment->>'ultimoTesteEm')
$$;
CREATE OR REPLACE FUNCTION public.listar_integracoes_bancarias()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_empresa_id uuid := public.current_empresa_id(); v_resultado jsonb;
BEGIN
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuario sem empresa vinculada.'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'provedor', c.provedor,
    'ambiente', c.ambiente, 'ativo', c.ativo, 'status', c.status,
    'configurado', c.status <> 'nao_configurado', 'modulos', c.modulos,
    'ultimoErro', c.ultimo_erro, 'validadoEm', c.validado_em, 'atualizadoEm', c.updated_at)
    ORDER BY c.provedor), '[]'::jsonb) INTO v_resultado
  FROM public.configuracoes_integracao_bancaria c WHERE c.empresa_id = v_empresa_id;
  RETURN v_resultado;
END;
$$;
CREATE OR REPLACE FUNCTION public.listar_configuracao_inter()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_empresa_id uuid := public.current_empresa_id(); v_row public.configuracoes_integracao_bancaria; v_config jsonb := '{}'::jsonb;
BEGIN
  IF v_empresa_id IS NULL OR NOT public.configuracoes_modulos_can_manage() THEN
    RAISE EXCEPTION 'Somente gestor ou administrador pode consultar a configuracao bancaria.';
  END IF;
  SELECT * INTO v_row FROM public.configuracoes_integracao_bancaria c
  WHERE c.empresa_id = v_empresa_id AND c.provedor = 'inter' LIMIT 1;
  IF FOUND THEN v_config := coalesce(v_row.configuracao, '{}'::jsonb); END IF;
  RETURN jsonb_build_object('provedor', 'inter',
    'activeEnvironment', public.normalize_inter_environment(v_config->>'activeEnvironment'),
    'ativo', coalesce(v_row.ativo, false), 'status', coalesce(v_row.status, 'nao_configurado'),
    'configurado', coalesce(v_row.status <> 'nao_configurado', false),
    'modulos', coalesce(v_row.modulos, '{"boleto":true,"pix":true,"webhook":true}'::jsonb),
    'webhookId', v_row.webhook_route_id, 'ultimoErro', v_row.ultimo_erro, 'validadoEm', v_row.validado_em,
    'environments', jsonb_build_object(
      'producao', public.format_inter_environment_response(coalesce(v_config->'environments'->'producao', '{}'::jsonb)),
      'homologacao', public.format_inter_environment_response(coalesce(v_config->'environments'->'homologacao', '{}'::jsonb))));
END;
$$;
CREATE OR REPLACE FUNCTION public.upsert_configuracao_asaas(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id(); v_current public.configuracoes_integracao_bancaria;
  v_current_config jsonb := '{}'::jsonb; v_active text := public.normalize_asaas_environment(p_payload->>'activeEnvironment');
  v_prod jsonb; v_hml jsonb; v_selected jsonb; v_config jsonb; v_modulos jsonb; v_status text;
BEGIN
  IF v_empresa_id IS NULL OR NOT public.configuracoes_modulos_can_manage() THEN
    RAISE EXCEPTION 'Somente gestor ou administrador pode configurar a integracao bancaria.';
  END IF;
  SELECT * INTO v_current FROM public.configuracoes_integracao_bancaria c
  WHERE c.empresa_id = v_empresa_id AND c.provedor = 'asaas' LIMIT 1;
  IF FOUND THEN v_current_config := coalesce(v_current.configuracao, '{}'::jsonb); END IF;
  v_prod := public.build_asaas_environment_config(v_empresa_id, 'producao',
    coalesce(v_current_config->'environments'->'producao', '{}'::jsonb), coalesce(p_payload->'environments'->'producao', '{}'::jsonb));
  v_hml := public.build_asaas_environment_config(v_empresa_id, 'homologacao',
    coalesce(v_current_config->'environments'->'homologacao', '{}'::jsonb), coalesce(p_payload->'environments'->'homologacao', '{}'::jsonb));
  v_selected := CASE WHEN v_active = 'producao' THEN v_prod ELSE v_hml END;
  v_modulos := jsonb_build_object('boleto', coalesce((v_selected->>'aceitaBoleto')::boolean, true),
    'pix', coalesce((v_selected->>'aceitaPix')::boolean, true), 'webhook', true,
    'cartao', coalesce((v_selected->>'aceitaCartao')::boolean, false),
    'checkout', coalesce((v_selected->>'checkoutAtivo')::boolean, true));
  v_status := CASE WHEN NULLIF(v_selected->>'api_key_secret_id', '') IS NOT NULL THEN 'ativo' ELSE 'nao_configurado' END;
  v_config := jsonb_build_object('gateway', 'asaas', 'activeEnvironment', v_active,
    'environments', jsonb_build_object('producao', v_prod, 'homologacao', v_hml));
  INSERT INTO public.configuracoes_integracao_bancaria
    (empresa_id, provedor, ambiente, ativo, status, modulos, configuracao, ultimo_erro, validado_em)
  VALUES (v_empresa_id, 'asaas', CASE WHEN v_active = 'producao' THEN 'producao' ELSE 'sandbox' END,
    false, v_status, v_modulos, v_config, NULL, CASE WHEN v_status = 'ativo' THEN now() ELSE NULL END)
  ON CONFLICT (empresa_id, provedor) DO UPDATE SET ambiente = EXCLUDED.ambiente,
    status = EXCLUDED.status, modulos = EXCLUDED.modulos, configuracao = EXCLUDED.configuracao,
    ultimo_erro = NULL, validado_em = EXCLUDED.validado_em, updated_at = now();
  RETURN public.listar_configuracao_asaas();
END;
$$;
CREATE OR REPLACE FUNCTION public.selecionar_provedor_bancario(p_provedor text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_empresa_id uuid := public.current_empresa_id(); v_provedor text := lower(trim(coalesce(p_provedor, '')));
BEGIN
  IF v_empresa_id IS NULL OR NOT public.configuracoes_modulos_can_manage() THEN
    RAISE EXCEPTION 'Somente gestor ou administrador pode selecionar o provedor bancario.';
  END IF;
  IF v_provedor NOT IN ('asaas', 'inter') OR NOT EXISTS (SELECT 1 FROM public.configuracoes_integracao_bancaria c
    WHERE c.empresa_id = v_empresa_id AND c.provedor = v_provedor AND c.status = 'ativo') THEN
    RAISE EXCEPTION 'Provedor invalido ou ainda nao validado.';
  END IF;
  UPDATE public.configuracoes_integracao_bancaria SET ativo = false, updated_at = now()
  WHERE empresa_id = v_empresa_id AND ativo = true;
  UPDATE public.configuracoes_integracao_bancaria SET ativo = true, updated_at = now()
  WHERE empresa_id = v_empresa_id AND provedor = v_provedor;
  RETURN public.listar_integracoes_bancarias();
END;
$$;
CREATE OR REPLACE FUNCTION public.registrar_inter_teste_conexao(p_user_id uuid, p_ambiente text, p_resultado jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.resolve_inter_manager_empresa_id(p_user_id);
  v_ambiente text := public.normalize_inter_environment(p_ambiente);
  v_ok boolean := public.inter_jsonb_boolean(p_resultado, 'ok', false);
  v_erro text := CASE WHEN public.inter_jsonb_boolean(p_resultado, 'ok', false) THEN NULL
    ELSE left(coalesce(NULLIF(p_resultado->>'erro', ''), 'Falha ao validar a conexao.'), 1000) END;
  v_row public.configuracoes_integracao_bancaria; v_env jsonb; v_active text;
BEGIN
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuario sem permissao para configurar a integracao.'; END IF;
  SELECT * INTO v_row FROM public.configuracoes_integracao_bancaria c
  WHERE c.empresa_id = v_empresa_id AND c.provedor = 'inter';
  IF NOT FOUND THEN RAISE EXCEPTION 'Integracao Banco Inter nao configurada.'; END IF;
  v_active := public.normalize_inter_environment(v_row.configuracao->>'activeEnvironment');
  v_env := coalesce(v_row.configuracao->'environments'->v_ambiente, '{}'::jsonb);
  v_env := jsonb_set(jsonb_set(v_env, '{ultimoTesteOk}', to_jsonb(v_ok), true), '{ultimoTesteEm}', to_jsonb(now()), true);
  UPDATE public.configuracoes_integracao_bancaria c SET
    configuracao = jsonb_set(c.configuracao, ARRAY['environments', v_ambiente], v_env, true),
    status = CASE WHEN v_ambiente <> v_active THEN c.status WHEN v_ok THEN 'ativo' ELSE 'erro' END,
    ultimo_erro = CASE WHEN v_ambiente <> v_active THEN c.ultimo_erro ELSE v_erro END,
    validado_em = CASE WHEN v_ambiente = v_active AND v_ok THEN now() ELSE c.validado_em END,
    updated_at = now() WHERE c.id = v_row.id RETURNING * INTO v_row;
  RETURN jsonb_build_object('ok', v_ok, 'status', v_row.status, 'ambiente', v_ambiente,
    'ambienteAtivo', v_active, 'erro', v_erro);
END;
$$;
CREATE OR REPLACE FUNCTION public.preparar_configuracao_inter(
  p_user_id uuid, p_ambiente text, p_acao text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.resolve_inter_manager_empresa_id(p_user_id);
  v_ambiente text := public.normalize_inter_environment(p_ambiente);
  v_acao text := lower(trim(coalesce(p_acao, 'consultar')));
  v_row public.configuracoes_integracao_bancaria;
  v_env jsonb;
  v_modulo text;
BEGIN
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuario sem permissao para configurar a integracao.'; END IF;
  SELECT * INTO v_row FROM public.configuracoes_integracao_bancaria c
  WHERE c.empresa_id = v_empresa_id AND c.provedor = 'inter' LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Integracao Banco Inter nao configurada.'; END IF;
  v_env := coalesce(v_row.configuracao->'environments'->v_ambiente, '{}'::jsonb);
  v_modulo := CASE WHEN v_acao LIKE '%webhook%' THEN 'webhook'
    WHEN v_acao LIKE '%pix%' THEN 'pix'
    WHEN v_acao LIKE '%boleto%' OR v_acao LIKE '%cobranca%' THEN 'boleto' ELSE NULL END;
  IF v_modulo IS NOT NULL AND NOT public.inter_jsonb_boolean(v_row.modulos, v_modulo, false) THEN
    RAISE EXCEPTION 'Modulo Inter % desabilitado.', v_modulo;
  END IF;
  RETURN jsonb_build_object(
    'empresaId', v_empresa_id, 'ambiente', v_ambiente, 'acao', v_acao,
    'baseUrl', v_env->>'baseUrl', 'authUrl', v_env->>'authUrl',
    'clientId', (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.id = NULLIF(v_env->>'client_id_secret_id', '')::uuid),
    'clientSecret', (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.id = NULLIF(v_env->>'client_secret_secret_id', '')::uuid),
    'certificadoPem', (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.id = NULLIF(v_env->>'certificado_pem_secret_id', '')::uuid),
    'chavePrivadaPem', (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.id = NULLIF(v_env->>'chave_privada_pem_secret_id', '')::uuid),
    'contaCorrente', v_env->>'contaCorrente', 'chavePix', v_env->>'chavePix',
    'modulos', v_row.modulos, 'webhookId', v_row.webhook_route_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.build_inter_environment_config(uuid,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.listar_configuracao_inter() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_configuracao_asaas(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.selecionar_provedor_bancario(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_inter_teste_conexao(uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.preparar_configuracao_inter(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.listar_configuracao_inter() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_configuracao_asaas(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.selecionar_provedor_bancario(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_inter_teste_conexao(uuid,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.preparar_configuracao_inter(uuid,text,text) TO service_role;
REVOKE SELECT (webhook_route_id) ON public.configuracoes_integracao_bancaria FROM authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'configuracoes_integracao_bancaria') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.configuracoes_integracao_bancaria;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.configuracoes_integracao_bancaria (
      id, empresa_id, provedor, ambiente, ativo, status, modulos,
      ultimo_erro, validado_em, created_at, updated_at
    );
  END IF;
END;
$$;
