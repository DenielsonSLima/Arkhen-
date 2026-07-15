-- Autoriza gestores do tenant nas rotinas server-side e impede cobranca no provedor inativo.
CREATE OR REPLACE FUNCTION public.resolve_inter_manager_empresa_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT empresa_id
  FROM (
    SELECT p.empresa_id, 1 AS prioridade, p.created_at
    FROM public.perfis p
    WHERE p.user_id = p_user_id
      AND p.ativo = true
      AND p.papel IN ('admin', 'contador')
    UNION ALL
    SELECT u.empresa_id, 2 AS prioridade, u.created_at
    FROM public.configuracoes_usuarios u
    WHERE u.auth_user_id = p_user_id
      AND u.status = 'Ativo'
      AND lower(u.perfil) IN ('gestor', 'administrador')
  ) autorizacoes
  ORDER BY prioridade, created_at
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.validar_provedor_bancario_ativo(
  p_user_id uuid,
  p_provedor text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.resolve_empresa_id_for_user(p_user_id);
  v_provedor text := lower(trim(coalesce(p_provedor, '')));
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;
  IF v_provedor NOT IN ('asaas', 'inter') THEN
    RAISE EXCEPTION 'Provedor bancario invalido.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.configuracoes_integracao_bancaria c
    WHERE c.empresa_id = v_empresa_id
      AND c.provedor = v_provedor
      AND c.ativo = true
      AND c.status = 'ativo'
  ) THEN
    RAISE EXCEPTION 'O provedor % nao esta selecionado como banco padrao.', v_provedor;
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'empresaId', v_empresa_id,
    'provedor', v_provedor
  );
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
  v_empresa_id uuid := public.resolve_inter_manager_empresa_id(p_user_id);
  v_ambiente text := public.normalize_inter_environment(p_ambiente);
  v_acao text := lower(trim(coalesce(p_acao, 'consultar')));
  v_row public.configuracoes_integracao_bancaria;
  v_env jsonb;
  v_modulo text;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Usuario obrigatorio.'; END IF;
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuario sem permissao para configurar a integracao.'; END IF;
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

CREATE OR REPLACE FUNCTION public.registrar_inter_teste_conexao(
  p_user_id uuid,
  p_ambiente text,
  p_resultado jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.resolve_inter_manager_empresa_id(p_user_id);
  v_ambiente text := public.normalize_inter_environment(p_ambiente);
  v_ok boolean := public.inter_jsonb_boolean(p_resultado, 'ok', false);
  v_erro text := CASE WHEN public.inter_jsonb_boolean(p_resultado, 'ok', false)
    THEN NULL ELSE left(coalesce(NULLIF(p_resultado->>'erro', ''), 'Falha ao validar a conexao.'), 1000) END;
  v_env jsonb;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Usuario obrigatorio.'; END IF;
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuario sem permissao para configurar a integracao.'; END IF;
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
  RETURN jsonb_build_object(
    'ok', v_ok,
    'status', CASE WHEN v_ok THEN 'ativo' ELSE 'erro' END,
    'ambiente', v_ambiente,
    'erro', v_erro
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_inter_manager_empresa_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validar_provedor_bancario_ativo(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.preparar_configuracao_inter(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_inter_teste_conexao(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_inter_manager_empresa_id(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.validar_provedor_bancario_ativo(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.preparar_configuracao_inter(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_inter_teste_conexao(uuid, text, jsonb) TO service_role;
