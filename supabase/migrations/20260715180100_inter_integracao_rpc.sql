-- RPCs da integracao Banco Inter. Segredos entram e saem somente pelo Vault.
CREATE OR REPLACE FUNCTION public.normalize_inter_environment(p_ambiente text)
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
CREATE OR REPLACE FUNCTION public.inter_jsonb_boolean(
  p_payload jsonb,
  p_chave text,
  p_padrao boolean
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN jsonb_typeof(coalesce(p_payload, '{}'::jsonb)->p_chave) = 'boolean'
      THEN (p_payload->>p_chave)::boolean
    ELSE p_padrao
  END
$$;
CREATE OR REPLACE FUNCTION public.format_inter_environment_response(p_environment jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'clientId', '',
    'clientIdConfigured', NULLIF(p_environment->>'client_id_secret_id', '') IS NOT NULL,
    'clientSecret', '',
    'clientSecretConfigured', NULLIF(p_environment->>'client_secret_secret_id', '') IS NOT NULL,
    'certificadoPem', '',
    'certificadoConfigurado', NULLIF(p_environment->>'certificado_pem_secret_id', '') IS NOT NULL,
    'certificateConfigured', NULLIF(p_environment->>'certificado_pem_secret_id', '') IS NOT NULL,
    'chavePrivadaPem', '',
    'chavePrivadaConfigurada', NULLIF(p_environment->>'chave_privada_pem_secret_id', '') IS NOT NULL,
    'privateKeyConfigured', NULLIF(p_environment->>'chave_privada_pem_secret_id', '') IS NOT NULL,
    'contaCorrente', coalesce(p_environment->>'contaCorrente', ''),
    'baseUrl', coalesce(p_environment->>'baseUrl', ''),
    'authUrl', coalesce(p_environment->>'authUrl', ''),
    'boletoAtivo', public.inter_jsonb_boolean(p_environment, 'boletoAtivo', true),
    'pixAtivo', public.inter_jsonb_boolean(p_environment, 'pixAtivo', true),
    'webhookAtivo', public.inter_jsonb_boolean(p_environment, 'webhookAtivo', true),
    'notificacoesAtivas', public.inter_jsonb_boolean(p_environment, 'notificacoesAtivas', true),
    'webhookUrl', coalesce(p_environment->>'webhookUrl', ''),
    'ultimoTesteOk', coalesce((p_environment->>'ultimoTesteOk')::boolean, false),
    'ultimoTesteEm', p_environment->>'ultimoTesteEm'
  )
$$;
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
  v_conta text := ltrim(regexp_replace(
    coalesce(NULLIF(p_payload->>'contaCorrente', ''), NULLIF(p_payload->>'conta_corrente', ''), p_current->>'contaCorrente', ''),
    '[^0-9]', '', 'g'
  ), '0');
  v_client_id_secret_id uuid := NULLIF(p_current->>'client_id_secret_id', '')::uuid;
  v_client_secret_secret_id uuid := NULLIF(p_current->>'client_secret_secret_id', '')::uuid;
  v_certificado_secret_id uuid := NULLIF(p_current->>'certificado_pem_secret_id', '')::uuid;
  v_chave_secret_id uuid := NULLIF(p_current->>'chave_privada_pem_secret_id', '')::uuid;
  v_base_url text;
  v_auth_url text;
BEGIN
  IF length(coalesce(v_client_id, '')) > 5000 OR length(coalesce(v_client_secret, '')) > 5000 THEN
    RAISE EXCEPTION 'Credencial Inter excede o limite permitido.';
  END IF;
  IF length(coalesce(v_certificado, '')) > 100000 OR length(coalesce(v_chave, '')) > 100000 THEN
    RAISE EXCEPTION 'Certificado Inter excede o limite permitido.';
  END IF;
  IF NULLIF(v_certificado, '') IS NOT NULL AND v_certificado NOT LIKE '%BEGIN CERTIFICATE%' THEN
    RAISE EXCEPTION 'Certificado PEM invalido.';
  END IF;
  IF NULLIF(v_chave, '') IS NOT NULL AND v_chave NOT LIKE '%BEGIN%PRIVATE KEY%' THEN
    RAISE EXCEPTION 'Chave privada PEM invalida.';
  END IF;
  IF v_conta <> '' AND length(v_conta) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'Conta corrente Inter invalida.';
  END IF;
  v_client_id_secret_id := public.upsert_vault_secret(
    v_client_id_secret_id, v_client_id, v_prefix || '_client_id',
    'Client ID Banco Inter ' || v_ambiente || ' da empresa ' || p_empresa_id::text
  );
  v_client_secret_secret_id := public.upsert_vault_secret(
    v_client_secret_secret_id, v_client_secret, v_prefix || '_client_secret',
    'Client Secret Banco Inter ' || v_ambiente || ' da empresa ' || p_empresa_id::text
  );
  v_certificado_secret_id := public.upsert_vault_secret(
    v_certificado_secret_id, v_certificado, v_prefix || '_certificado_pem',
    'Certificado mTLS Banco Inter ' || v_ambiente || ' da empresa ' || p_empresa_id::text
  );
  v_chave_secret_id := public.upsert_vault_secret(
    v_chave_secret_id, v_chave, v_prefix || '_chave_privada_pem',
    'Chave privada mTLS Banco Inter ' || v_ambiente || ' da empresa ' || p_empresa_id::text
  );
  v_base_url := coalesce(
    NULLIF(p_payload->>'baseUrl', ''), NULLIF(p_payload->>'base_url', ''),
    NULLIF(p_current->>'baseUrl', ''),
    CASE WHEN v_ambiente = 'producao'
      THEN 'https://cdpj.partners.bancointer.com.br'
      ELSE 'https://cdpj-sandbox.partners.uatinter.co'
    END
  );
  v_auth_url := coalesce(
    NULLIF(p_payload->>'authUrl', ''), NULLIF(p_payload->>'auth_url', ''),
    NULLIF(p_current->>'authUrl', ''), v_base_url || '/oauth/v2/token'
  );
  RETURN jsonb_build_object(
    'client_id_secret_id', v_client_id_secret_id,
    'client_secret_secret_id', v_client_secret_secret_id,
    'certificado_pem_secret_id', v_certificado_secret_id,
    'chave_privada_pem_secret_id', v_chave_secret_id,
    'contaCorrente', v_conta,
    'baseUrl', v_base_url,
    'authUrl', v_auth_url,
    'boletoAtivo', public.inter_jsonb_boolean(p_payload, 'boletoAtivo', public.inter_jsonb_boolean(p_current, 'boletoAtivo', true)),
    'pixAtivo', public.inter_jsonb_boolean(p_payload, 'pixAtivo', public.inter_jsonb_boolean(p_current, 'pixAtivo', true)),
    'webhookAtivo', public.inter_jsonb_boolean(p_payload, 'webhookAtivo', public.inter_jsonb_boolean(p_current, 'webhookAtivo', true)),
    'notificacoesAtivas', public.inter_jsonb_boolean(p_payload, 'notificacoesAtivas', public.inter_jsonb_boolean(p_current, 'notificacoesAtivas', true)),
    'webhookUrl', left(coalesce(NULLIF(p_payload->>'webhookUrl', ''), p_current->>'webhookUrl', ''), 2048),
    'ultimoTesteOk', coalesce((p_current->>'ultimoTesteOk')::boolean, false),
    'ultimoTesteEm', p_current->>'ultimoTesteEm'
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.registrar_inter_teste_conexao(
  p_user_id uuid, p_ambiente text, p_resultado jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid;
  v_ambiente text := public.normalize_inter_environment(p_ambiente);
  v_ok boolean := public.inter_jsonb_boolean(p_resultado, 'ok', false);
  v_erro text := CASE WHEN public.inter_jsonb_boolean(p_resultado, 'ok', false)
    THEN NULL ELSE left(coalesce(NULLIF(p_resultado->>'erro', ''), 'Falha ao validar a conexao.'), 1000) END;
  v_env jsonb;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Usuario obrigatorio.'; END IF;
  SELECT p.empresa_id INTO v_empresa_id FROM public.perfis p
  WHERE p.user_id = p_user_id AND p.ativo = true AND p.papel = 'admin' ORDER BY p.created_at LIMIT 1;
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuario sem empresa ativa vinculada.'; END IF;
  SELECT coalesce(c.configuracao->'environments'->v_ambiente, '{}'::jsonb) INTO v_env
  FROM public.configuracoes_integracao_bancaria c
  WHERE c.empresa_id = v_empresa_id AND c.provedor = 'inter';
  IF NOT FOUND THEN RAISE EXCEPTION 'Integracao Banco Inter nao configurada.'; END IF;
  v_env := jsonb_set(jsonb_set(v_env, '{ultimoTesteOk}', to_jsonb(v_ok), true),
    '{ultimoTesteEm}', to_jsonb(now()), true);
  UPDATE public.configuracoes_integracao_bancaria c
  SET configuracao = jsonb_set(c.configuracao, ARRAY['environments', v_ambiente], v_env, true),
      status = CASE WHEN v_ok THEN 'ativo' ELSE 'erro' END,
      ultimo_erro = v_erro,
      validado_em = CASE WHEN v_ok THEN now() ELSE c.validado_em END,
      updated_at = now()
  WHERE c.empresa_id = v_empresa_id AND c.provedor = 'inter';
  RETURN jsonb_build_object('ok', v_ok, 'status', CASE WHEN v_ok THEN 'ativo' ELSE 'erro' END,
    'ambiente', v_ambiente, 'erro', v_erro);
END;
$$;
CREATE OR REPLACE FUNCTION public.registrar_inter_webhook_eventos(
  p_webhook_id uuid, p_conta_corrente text, p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.configuracoes_integracao_bancaria;
  v_conta text := ltrim(regexp_replace(coalesce(p_conta_corrente, ''), '[^0-9]', '', 'g'), '0');
  v_ambiente text;
  v_event_type text;
  v_external_id text;
  v_evento public.inter_webhook_eventos;
  v_items jsonb;
  v_item jsonb;
  v_total integer := 0;
  v_duplicados integer := 0;
BEGIN
  IF p_webhook_id IS NULL OR v_conta = '' THEN RAISE EXCEPTION 'Rota ou conta do webhook ausente.'; END IF;
  v_items := CASE WHEN jsonb_typeof(p_payload) = 'object' THEN jsonb_build_array(p_payload) ELSE p_payload END;
  IF jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Payload do webhook deve conter de 1 a 100 eventos.';
  END IF;
  SELECT * INTO v_row FROM public.configuracoes_integracao_bancaria c
  WHERE c.provedor = 'inter' AND c.webhook_route_id = p_webhook_id
    AND public.inter_jsonb_boolean(c.modulos, 'webhook', false)
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rota de webhook Inter invalida.'; END IF;
  v_ambiente := CASE
    WHEN ltrim(regexp_replace(coalesce(v_row.configuracao->'environments'->'producao'->>'contaCorrente', ''), '[^0-9]', '', 'g'), '0') = v_conta
      THEN 'producao'
    WHEN ltrim(regexp_replace(coalesce(v_row.configuracao->'environments'->'homologacao'->>'contaCorrente', ''), '[^0-9]', '', 'g'), '0') = v_conta
      THEN 'homologacao'
    ELSE NULL END;
  IF v_ambiente IS NULL THEN RAISE EXCEPTION 'Conta corrente nao pertence a rota informada.'; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN RAISE EXCEPTION 'Evento do webhook invalido.'; END IF;
    v_event_type := left(coalesce(NULLIF(v_item->>'tipo', ''), NULLIF(v_item->>'event', ''),
      NULLIF(v_item->>'situacao', ''), 'UNKNOWN'), 120);
    v_external_id := v_event_type || ':' || coalesce(NULLIF(v_item->>'id', ''),
      NULLIF(v_item->>'codigoSolicitacao', ''), NULLIF(v_item->>'nossoNumero', ''),
      NULLIF(v_item->>'txid', ''), encode(digest(v_item::text, 'sha256'), 'hex'));
    INSERT INTO public.inter_webhook_eventos (
      empresa_id, integracao_id, ambiente, external_event_id, event_type, conta_corrente, payload, tentativas
    ) VALUES (v_row.empresa_id, v_row.id, v_ambiente, v_external_id, v_event_type, v_conta, v_item, 1)
    ON CONFLICT (empresa_id, ambiente, external_event_id) DO UPDATE SET
      status = CASE WHEN inter_webhook_eventos.status = 'processado' THEN 'processado' ELSE 'duplicado' END,
      tentativas = inter_webhook_eventos.tentativas + 1, updated_at = now()
    RETURNING * INTO v_evento;
    v_total := v_total + 1;
    IF v_evento.status <> 'recebido' THEN v_duplicados := v_duplicados + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'ambiente', v_ambiente, 'recebidos', v_total,
    'duplicados', v_duplicados, 'aceitos', v_total - v_duplicados);
END;
$$;
CREATE OR REPLACE FUNCTION public.listar_integracoes_bancarias()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_resultado jsonb;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'provedor', c.provedor,
    'ambiente', c.ambiente,
    'ativo', c.ativo,
    'status', c.status,
    'configurado', c.status <> 'nao_configurado',
    'modulos', c.modulos,
    'webhookId', c.webhook_route_id,
    'ultimoErro', c.ultimo_erro,
    'validadoEm', c.validado_em,
    'atualizadoEm', c.updated_at
  ) ORDER BY c.provedor), '[]'::jsonb)
  INTO v_resultado
  FROM public.configuracoes_integracao_bancaria c
  WHERE c.empresa_id = v_empresa_id;
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
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_row public.configuracoes_integracao_bancaria;
  v_config jsonb := '{}'::jsonb;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;
  SELECT * INTO v_row
  FROM public.configuracoes_integracao_bancaria c
  WHERE c.empresa_id = v_empresa_id AND c.provedor = 'inter'
  LIMIT 1;
  IF FOUND THEN v_config := coalesce(v_row.configuracao, '{}'::jsonb); END IF;
  RETURN jsonb_build_object(
    'provedor', 'inter',
    'activeEnvironment', public.normalize_inter_environment(v_config->>'activeEnvironment'),
    'ativo', coalesce(v_row.ativo, false),
    'status', coalesce(v_row.status, 'nao_configurado'),
    'configurado', coalesce(v_row.status <> 'nao_configurado', false),
    'modulos', coalesce(v_row.modulos, '{"boleto":true,"pix":true,"webhook":true}'::jsonb),
    'webhookId', v_row.webhook_route_id,
    'ultimoErro', v_row.ultimo_erro,
    'validadoEm', v_row.validado_em,
    'environments', jsonb_build_object(
      'producao', public.format_inter_environment_response(coalesce(v_config->'environments'->'producao', '{}'::jsonb)),
      'homologacao', public.format_inter_environment_response(coalesce(v_config->'environments'->'homologacao', '{}'::jsonb))
    )
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.upsert_configuracao_inter(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_current_row public.configuracoes_integracao_bancaria;
  v_current jsonb := '{}'::jsonb;
  v_active text := public.normalize_inter_environment(p_payload->>'activeEnvironment');
  v_prod jsonb; v_hml jsonb;
  v_selected jsonb;
  v_modulos jsonb;
  v_status text; v_keep_active boolean := false;
BEGIN
  IF v_empresa_id IS NULL OR NOT public.configuracoes_modulos_can_manage() THEN
    RAISE EXCEPTION 'Somente gestor ou administrador pode configurar a integracao bancaria.';
  END IF;
  IF jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Configuracao Inter invalida.';
  END IF;
  SELECT * INTO v_current_row
  FROM public.configuracoes_integracao_bancaria c
  WHERE c.empresa_id = v_empresa_id AND c.provedor = 'inter'
  LIMIT 1;
  IF FOUND THEN v_current := coalesce(v_current_row.configuracao, '{}'::jsonb); END IF;
  v_current := coalesce(v_current, '{}'::jsonb);
  v_prod := public.build_inter_environment_config(
    v_empresa_id, 'producao', coalesce(v_current->'environments'->'producao', '{}'::jsonb),
    coalesce(p_payload->'environments'->'producao', '{}'::jsonb)
  );
  v_hml := public.build_inter_environment_config(
    v_empresa_id, 'homologacao', coalesce(v_current->'environments'->'homologacao', '{}'::jsonb),
    coalesce(p_payload->'environments'->'homologacao', '{}'::jsonb)
  );
  v_selected := CASE WHEN v_active = 'producao' THEN v_prod ELSE v_hml END;
  v_modulos := CASE WHEN jsonb_typeof(p_payload->'modulos') = 'object' THEN jsonb_build_object(
    'boleto', public.inter_jsonb_boolean(p_payload->'modulos', 'boleto', true),
    'pix', public.inter_jsonb_boolean(p_payload->'modulos', 'pix', true),
    'webhook', public.inter_jsonb_boolean(p_payload->'modulos', 'webhook', true)) ELSE jsonb_build_object(
    'boleto', public.inter_jsonb_boolean(v_selected, 'boletoAtivo', true),
    'pix', public.inter_jsonb_boolean(v_selected, 'pixAtivo', true),
    'webhook', public.inter_jsonb_boolean(v_selected, 'webhookAtivo', true)) END;
  v_status := CASE WHEN NULLIF(v_selected->>'client_id_secret_id', '') IS NOT NULL
    AND NULLIF(v_selected->>'client_secret_secret_id', '') IS NOT NULL
    AND NULLIF(v_selected->>'certificado_pem_secret_id', '') IS NOT NULL
    AND NULLIF(v_selected->>'chave_privada_pem_secret_id', '') IS NOT NULL
    AND NULLIF(v_selected->>'contaCorrente', '') IS NOT NULL
    THEN 'em_validacao' ELSE 'nao_configurado' END;
  v_keep_active := coalesce(v_current_row.ativo, false) AND v_current_row.status = 'ativo'
    AND v_active = public.normalize_inter_environment(v_current->>'activeEnvironment')
    AND (coalesce(v_current->'environments'->v_active, '{}'::jsonb)
      - 'ultimoTesteOk' - 'ultimoTesteEm' - 'boletoAtivo' - 'pixAtivo' - 'webhookAtivo'
      - 'notificacoesAtivas' - 'webhookUrl') = (v_selected
      - 'ultimoTesteOk' - 'ultimoTesteEm' - 'boletoAtivo' - 'pixAtivo' - 'webhookAtivo'
      - 'notificacoesAtivas' - 'webhookUrl');
  IF coalesce(v_current_row.ativo, false) AND NOT v_keep_active AND NOT EXISTS (
    SELECT 1 FROM public.configuracoes_integracao_bancaria c
    WHERE c.empresa_id = v_empresa_id AND c.provedor = 'asaas' AND c.status = 'ativo'
  ) THEN RAISE EXCEPTION 'Selecione um provedor validado antes de alterar credenciais do banco ativo.'; END IF;
  IF v_keep_active THEN v_status := 'ativo'; END IF;
  INSERT INTO public.configuracoes_integracao_bancaria (
    empresa_id, provedor, ambiente, ativo, status, modulos, configuracao, ultimo_erro, validado_em
  ) VALUES (
    v_empresa_id, 'inter', CASE WHEN v_active = 'producao' THEN 'producao' ELSE 'sandbox' END,
    v_keep_active, v_status, v_modulos,
    jsonb_build_object('gateway', 'inter', 'activeEnvironment', v_active,
      'environments', jsonb_build_object('producao', v_prod, 'homologacao', v_hml)),
    NULL, NULL
  )
  ON CONFLICT (empresa_id, provedor) DO UPDATE SET
    ambiente = EXCLUDED.ambiente,
    ativo = EXCLUDED.ativo,
    status = EXCLUDED.status,
    modulos = EXCLUDED.modulos,
    configuracao = EXCLUDED.configuracao,
    ultimo_erro = NULL,
    validado_em = CASE WHEN EXCLUDED.ativo THEN configuracoes_integracao_bancaria.validado_em ELSE NULL END,
    updated_at = now();
  IF coalesce(v_current_row.ativo, false) AND NOT v_keep_active THEN
    UPDATE public.configuracoes_integracao_bancaria SET ativo = true, updated_at = now()
    WHERE empresa_id = v_empresa_id AND provedor = 'asaas' AND status = 'ativo';
  END IF;
  RETURN public.listar_configuracao_inter();
END;
$$;
CREATE OR REPLACE FUNCTION public.selecionar_provedor_bancario(p_provedor text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_provedor text := lower(trim(coalesce(p_provedor, '')));
BEGIN
  IF v_empresa_id IS NULL OR NOT public.configuracoes_modulos_can_manage() THEN
    RAISE EXCEPTION 'Somente gestor ou administrador pode selecionar o provedor bancario.';
  END IF;
  IF v_provedor NOT IN ('asaas', 'inter') THEN RAISE EXCEPTION 'Provedor bancario invalido.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.configuracoes_integracao_bancaria c
    WHERE c.empresa_id = v_empresa_id AND c.provedor = v_provedor AND c.status = 'ativo'
  ) THEN
    RAISE EXCEPTION 'O provedor precisa estar validado antes de ser selecionado.';
  END IF;
  UPDATE public.configuracoes_integracao_bancaria
  SET ativo = (provedor = v_provedor), updated_at = now()
  WHERE empresa_id = v_empresa_id
    AND ativo IS DISTINCT FROM (provedor = v_provedor);
  RETURN public.listar_integracoes_bancarias();
END;
$$;
CREATE OR REPLACE FUNCTION public.preparar_configuracao_inter(
  p_user_id uuid,
  p_ambiente text,
  p_acao text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_empresa_id uuid;
  v_ambiente text := public.normalize_inter_environment(p_ambiente);
  v_acao text := lower(trim(coalesce(p_acao, 'consultar')));
  v_row public.configuracoes_integracao_bancaria;
  v_env jsonb;
  v_modulo text;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Usuario obrigatorio.'; END IF;
  SELECT p.empresa_id INTO v_empresa_id
  FROM public.perfis p
  WHERE p.user_id = p_user_id AND p.ativo = true AND p.papel = 'admin'
  ORDER BY p.created_at LIMIT 1;
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuario sem empresa ativa vinculada.'; END IF;
  SELECT * INTO v_row
  FROM public.configuracoes_integracao_bancaria c
  WHERE c.empresa_id = v_empresa_id AND c.provedor = 'inter'
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Integracao Banco Inter nao configurada.'; END IF;
  v_env := coalesce(v_row.configuracao->'environments'->v_ambiente, '{}'::jsonb);
  v_modulo := CASE
    WHEN v_acao LIKE '%webhook%' THEN 'webhook'
    WHEN v_acao LIKE '%pix%' THEN 'pix'
    WHEN v_acao LIKE '%boleto%' OR v_acao LIKE '%cobranca%' THEN 'boleto'
    ELSE NULL
  END;
  IF v_modulo IS NOT NULL AND NOT public.inter_jsonb_boolean(v_row.modulos, v_modulo, false) THEN
    RAISE EXCEPTION 'Modulo Inter % desabilitado.', v_modulo;
  END IF;
  RETURN jsonb_build_object(
    'empresaId', v_empresa_id,
    'ambiente', v_ambiente,
    'acao', v_acao,
    'baseUrl', v_env->>'baseUrl',
    'authUrl', v_env->>'authUrl',
    'clientId', (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.id = NULLIF(v_env->>'client_id_secret_id', '')::uuid),
    'clientSecret', (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.id = NULLIF(v_env->>'client_secret_secret_id', '')::uuid),
    'certificadoPem', (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.id = NULLIF(v_env->>'certificado_pem_secret_id', '')::uuid),
    'chavePrivadaPem', (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.id = NULLIF(v_env->>'chave_privada_pem_secret_id', '')::uuid),
    'contaCorrente', v_env->>'contaCorrente',
    'modulos', v_row.modulos,
    'webhookId', v_row.webhook_route_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.upsert_vault_secret(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inter_jsonb_boolean(jsonb, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.build_inter_environment_config(uuid, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.preparar_configuracao_inter(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_inter_teste_conexao(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_inter_webhook_eventos(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.listar_integracoes_bancarias() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.listar_configuracao_inter() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_configuracao_inter(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.selecionar_provedor_bancario(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_integracoes_bancarias() TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_configuracao_inter() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_configuracao_inter(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.selecionar_provedor_bancario(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preparar_configuracao_inter(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_inter_teste_conexao(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_inter_webhook_eventos(uuid, text, jsonb) TO service_role;
