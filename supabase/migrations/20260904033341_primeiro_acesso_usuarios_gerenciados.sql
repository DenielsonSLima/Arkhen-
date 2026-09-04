-- Handshake DB-primeiro: a confirmacao grava uma nova versao no banco e abre a
-- membership; o acesso continua fechado ate a Edge aplicar a mesma versao no Auth.

CREATE OR REPLACE FUNCTION public.preparar_primeiro_acesso_usuario_gerenciado(
  p_actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_usuario public.configuracoes_usuarios%ROWTYPE;
  v_membership public.perfis%ROWTYPE;
  v_identidade private.identidades_funcionarios_cpf%ROWTYPE;
  v_auth_email text;
  v_auth_login_method text;
  v_auth_account_type text;
  v_auth_version text;
  v_email_confirmed_at timestamptz;
  v_invited_at timestamptz;
  v_transition_state text;
  v_target_version uuid;
  v_quantidade integer;
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Usuario nao autenticado.';
  END IF;
  SELECT pg_catalog.count(*) INTO v_quantidade
  FROM public.configuracoes_usuarios AS usuario
  WHERE usuario.auth_user_id = p_actor_user_id;
  IF v_quantidade <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Configuracao de acesso indisponivel.';
  END IF;

  SELECT * INTO v_usuario
  FROM public.configuracoes_usuarios AS usuario
  WHERE usuario.auth_user_id = p_actor_user_id;
  SELECT * INTO v_membership
  FROM public.perfis AS membership
  WHERE membership.id = v_usuario.perfil_id
    AND membership.user_id = p_actor_user_id
    AND membership.empresa_id = v_usuario.empresa_id;
  SELECT * INTO v_identidade
  FROM private.identidades_funcionarios_cpf AS identidade
  WHERE identidade.configuracao_usuario_id = v_usuario.id;
  SELECT
    pg_catalog.lower(auth_user.email),
    auth_user.raw_app_meta_data->>'login_method',
    auth_user.raw_app_meta_data->>'account_type',
    auth_user.raw_app_meta_data->>'credential_version',
    auth_user.email_confirmed_at,
    auth_user.invited_at
  INTO v_auth_email, v_auth_login_method, v_auth_account_type, v_auth_version,
    v_email_confirmed_at, v_invited_at
  FROM auth.users AS auth_user
  WHERE auth_user.id = p_actor_user_id;

  IF v_membership.id IS NULL
     OR v_membership.papel <> 'membro'
     OR NOT EXISTS (
       SELECT 1 FROM public.empresas AS empresa
       WHERE empresa.id = v_usuario.empresa_id AND empresa.status = 'ativo'
     )
     OR v_usuario.auth_credential_version IS NULL
     OR COALESCE(v_auth_version, '')
       !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR v_email_confirmed_at IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Primeiro acesso nao autorizado.';
  END IF;

  IF v_usuario.login_method = 'email' THEN
    IF v_auth_login_method IS DISTINCT FROM 'email'
       OR v_auth_account_type IS DISTINCT FROM 'employee_email'
       OR v_auth_email IS DISTINCT FROM pg_catalog.lower(v_usuario.email)
       OR v_invited_at IS NULL
       OR v_identidade.configuracao_usuario_id IS NOT NULL
       OR v_usuario.cpf IS NULL
       OR NOT public.cpf_valido(v_usuario.cpf)
       OR NOT EXISTS (
         SELECT 1 FROM public.configuracoes_perfis_acesso AS acesso
         WHERE acesso.id = v_usuario.perfil_acesso_id
           AND acesso.empresa_id = v_usuario.empresa_id
           AND acesso.ativo = true
       ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501', MESSAGE = 'Convite por email inconsistente.';
    END IF;
  ELSIF v_usuario.login_method = 'cpf' THEN
    IF v_auth_login_method IS DISTINCT FROM 'cpf'
       OR v_auth_account_type IS DISTINCT FROM 'employee_cpf'
       OR v_identidade.auth_user_id IS DISTINCT FROM p_actor_user_id
       OR v_identidade.empresa_id IS DISTINCT FROM v_usuario.empresa_id
       OR v_identidade.cpf_normalizado IS DISTINCT FROM v_usuario.cpf
       OR v_auth_email IS DISTINCT FROM v_identidade.auth_alias
       OR NOT EXISTS (
         SELECT 1 FROM public.configuracoes_perfis_acesso AS acesso
         WHERE acesso.id = v_usuario.perfil_acesso_id
           AND acesso.empresa_id = v_usuario.empresa_id
           AND acesso.ativo = true
           AND pg_catalog.lower(COALESCE(acesso.codigo, ''))
             NOT IN ('gestor', 'admin', 'administrador')
           AND pg_catalog.lower(acesso.nome)
             NOT IN ('gestor', 'admin', 'administrador')
           AND NOT (acesso.permissoes && ARRAY[
             'usuarios:manage', 'perfis:manage', 'configuracoes:manage'
           ]::text[])
       ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501', MESSAGE = 'Conta CPF inconsistente.';
    END IF;
  ELSE
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Metodo de login invalido.';
  END IF;

  IF v_usuario.auth_credential_version::text = v_auth_version THEN
    IF NOT v_usuario.must_change_password
       OR v_membership.ativo
       OR v_usuario.status = 'Inativo' THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514', MESSAGE = 'Primeiro acesso ja concluido ou inconsistente.';
    END IF;
    v_transition_state := 'pending_database';
    v_target_version := NULL;
  ELSE
    IF v_usuario.must_change_password
       OR NOT v_membership.ativo
       OR v_usuario.status <> 'Ativo' THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501', MESSAGE = 'Transicao de credencial inconsistente.';
    END IF;
    v_transition_state := 'pending_auth';
    v_target_version := v_usuario.auth_credential_version;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'usuario_id', v_usuario.id,
    'auth_user_id', v_usuario.auth_user_id,
    'login_method', v_usuario.login_method,
    'cpf', v_usuario.cpf,
    'transition_state', v_transition_state,
    'credential_version', v_auth_version,
    'target_credential_version', v_target_version
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.confirmar_primeiro_acesso_usuario_gerenciado(
  p_actor_user_id uuid,
  p_credential_version uuid
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_preparado jsonb;
  v_usuario_id uuid;
  v_empresa_id uuid;
BEGIN
  IF p_actor_user_id IS NULL OR p_credential_version IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Versao invalida.';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('primeiro-acesso:' || p_actor_user_id::text, 0)
  );
  v_preparado := public.preparar_primeiro_acesso_usuario_gerenciado(
    p_actor_user_id
  );
  IF v_preparado->>'transition_state' <> 'pending_database'
     OR p_credential_version::text = v_preparado->>'credential_version' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514', MESSAGE = 'Transicao de credencial invalida.';
  END IF;
  v_usuario_id := (v_preparado->>'usuario_id')::uuid;

  UPDATE public.configuracoes_usuarios
  SET auth_credential_version = p_credential_version,
      must_change_password = false,
      status = CASE WHEN login_method = 'email' THEN 'Ativo' ELSE status END,
      updated_at = pg_catalog.now()
  WHERE id = v_usuario_id
    AND auth_user_id = p_actor_user_id
    AND must_change_password
    AND status <> 'Inativo'
    AND auth_credential_version::text = v_preparado->>'credential_version'
  RETURNING empresa_id INTO v_empresa_id;
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '40001', MESSAGE = 'Primeiro acesso sofreu alteracao concorrente.';
  END IF;

  INSERT INTO public.configuracoes_eventos_logs (
    empresa_id, usuario_id, acao, modulo, tipo, detalhes
  ) VALUES (
    v_empresa_id,
    p_actor_user_id,
    'Confirmou primeiro acesso de usuario gerenciado',
    'Configuracoes',
    'Sucesso',
    pg_catalog.jsonb_build_object('configuracao_usuario_id', v_usuario_id)
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.preparar_primeiro_acesso_usuario_gerenciado(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirmar_primeiro_acesso_usuario_gerenciado(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preparar_primeiro_acesso_usuario_gerenciado(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.confirmar_primeiro_acesso_usuario_gerenciado(uuid, uuid)
  TO service_role;

-- Mantem o contexto completo existente para contas ativas e intercepta somente
-- o login CPF que precisa chegar a tela obrigatoria de troca de senha.
ALTER FUNCTION public.obter_contexto_usuario_atual()
  RENAME TO _obter_contexto_usuario_ativo_interno;
REVOKE ALL ON FUNCTION public._obter_contexto_usuario_ativo_interno()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.obter_contexto_usuario_atual()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_usuario public.configuracoes_usuarios%ROWTYPE;
  v_membership public.perfis%ROWTYPE;
  v_identidade private.identidades_funcionarios_cpf%ROWTYPE;
  v_auth_email text;
  v_auth_login_method text;
  v_auth_account_type text;
  v_auth_version text;
  v_quantidade integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Usuario nao autenticado.';
  END IF;
  SELECT pg_catalog.count(*) INTO v_quantidade
  FROM public.configuracoes_usuarios AS usuario
  WHERE usuario.auth_user_id = v_user_id;
  IF v_quantidade = 0 THEN
    RETURN public._obter_contexto_usuario_ativo_interno();
  ELSIF v_quantidade > 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Configuracao de acesso indisponivel.';
  END IF;

  SELECT * INTO v_usuario
  FROM public.configuracoes_usuarios AS usuario
  WHERE usuario.auth_user_id = v_user_id;
  SELECT * INTO v_membership
  FROM public.perfis AS membership
  WHERE membership.id = v_usuario.perfil_id
    AND membership.user_id = v_user_id
    AND membership.empresa_id = v_usuario.empresa_id;
  SELECT * INTO v_identidade
  FROM private.identidades_funcionarios_cpf AS identidade
  WHERE identidade.configuracao_usuario_id = v_usuario.id;
  SELECT pg_catalog.lower(auth_user.email),
    auth_user.raw_app_meta_data->>'login_method',
    auth_user.raw_app_meta_data->>'account_type',
    auth_user.raw_app_meta_data->>'credential_version'
  INTO v_auth_email, v_auth_login_method, v_auth_account_type, v_auth_version
  FROM auth.users AS auth_user WHERE auth_user.id = v_user_id;

  IF v_usuario.auth_credential_version IS NOT NULL
     AND (
       v_auth_version IS DISTINCT FROM v_usuario.auth_credential_version::text
       OR auth.jwt()->'app_metadata'->>'credential_version'
         IS DISTINCT FROM v_usuario.auth_credential_version::text
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Sessao de credencial desatualizada.';
  END IF;

  IF v_usuario.login_method = 'cpf' AND v_usuario.must_change_password THEN
    IF v_usuario.status <> 'Ativo'
       OR v_membership.id IS NULL
       OR v_membership.ativo
       OR v_membership.papel <> 'membro'
       OR v_usuario.auth_credential_version IS NULL
       OR v_auth_login_method IS DISTINCT FROM 'cpf'
       OR v_auth_account_type IS DISTINCT FROM 'employee_cpf'
       OR v_identidade.auth_user_id IS DISTINCT FROM v_user_id
       OR v_identidade.empresa_id IS DISTINCT FROM v_usuario.empresa_id
       OR v_identidade.cpf_normalizado IS DISTINCT FROM v_usuario.cpf
       OR v_auth_email IS DISTINCT FROM v_identidade.auth_alias
       OR NOT EXISTS (
         SELECT 1 FROM public.empresas AS empresa
         WHERE empresa.id = v_usuario.empresa_id AND empresa.status = 'ativo'
       )
       OR NOT EXISTS (
         SELECT 1 FROM public.configuracoes_perfis_acesso AS acesso
         WHERE acesso.id = v_usuario.perfil_acesso_id
           AND acesso.empresa_id = v_usuario.empresa_id
           AND acesso.ativo = true
           AND pg_catalog.lower(COALESCE(acesso.codigo, ''))
             NOT IN ('gestor', 'admin', 'administrador')
           AND pg_catalog.lower(acesso.nome)
             NOT IN ('gestor', 'admin', 'administrador')
           AND NOT (acesso.permissoes && ARRAY[
             'usuarios:manage', 'perfis:manage', 'configuracoes:manage'
           ]::text[])
       ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501', MESSAGE = 'Primeiro acesso CPF indisponivel.';
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'id', v_usuario.id,
      'empresa_id', v_usuario.empresa_id,
      'auth_user_id', v_usuario.auth_user_id,
      'nome', v_usuario.nome,
      'email', NULL,
      'cpf', v_usuario.cpf,
      'telefone', v_usuario.telefone,
      'login_method', 'cpf',
      'perfil', v_usuario.perfil,
      'status', v_usuario.status,
      'must_change_password', true,
      'membership_id', v_membership.id,
      'membership_papel', v_membership.papel
    );
  END IF;

  IF v_usuario.must_change_password THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Troca de senha obrigatoria.';
  END IF;
  RETURN public._obter_contexto_usuario_ativo_interno();
END;
$$;

REVOKE ALL ON FUNCTION public.obter_contexto_usuario_atual()
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.obter_contexto_usuario_atual()
  TO authenticated;

CREATE OR REPLACE FUNCTION public.finalizar_cadastro_auth(
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_login_method text;
  v_account_type text;
  v_invited_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Usuario nao autenticado.';
  END IF;
  SELECT auth_user.raw_app_meta_data->>'login_method',
    auth_user.raw_app_meta_data->>'account_type', auth_user.invited_at
  INTO v_login_method, v_account_type, v_invited_at
  FROM auth.users AS auth_user WHERE auth_user.id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Usuario nao autenticado.';
  END IF;
  IF v_account_type IN ('employee_email', 'employee_cpf')
     OR v_login_method = 'cpf'
     OR v_invited_at IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Usuario convidado ja e provisionado pelo gestor.';
  END IF;
  RETURN public._finalizar_cadastro_auth_email_interno(p_payload);
END;
$$;

REVOKE ALL ON FUNCTION public.finalizar_cadastro_auth(jsonb)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.finalizar_cadastro_auth(jsonb)
  TO authenticated;

-- RPCs legadas continuam disponiveis para trocas normais, mas nunca podem
-- limpar uma pendencia inicial sem a rotacao versionada acima.
CREATE OR REPLACE FUNCTION public.confirmar_reset_senha_funcionario_cpf(
  p_actor_user_id uuid,
  p_usuario_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_preparado jsonb;
  v_pendente boolean;
BEGIN
  v_preparado := public.preparar_reset_senha_funcionario_cpf(
    p_actor_user_id, p_usuario_id
  );
  SELECT usuario.must_change_password INTO v_pendente
  FROM public.configuracoes_usuarios AS usuario
  WHERE usuario.id = p_usuario_id;
  INSERT INTO public.configuracoes_eventos_logs (
    empresa_id, usuario_id, acao, modulo, tipo, detalhes
  ) VALUES (
    (v_preparado->>'empresa_id')::uuid,
    p_actor_user_id,
    CASE WHEN v_pendente
      THEN 'Redefiniu senha temporaria de funcionario CPF'
      ELSE 'Redefiniu senha de funcionario CPF ativo'
    END,
    'Configuracoes',
    'Sucesso',
    pg_catalog.jsonb_build_object('configuracao_usuario_id', p_usuario_id)
  );
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirmar_alteracao_senha_propria_funcionario_cpf(
  p_actor_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_preparado jsonb;
BEGIN
  v_preparado := public.preparar_alteracao_senha_propria_funcionario_cpf(
    p_actor_user_id
  );
  IF EXISTS (
    SELECT 1 FROM public.configuracoes_usuarios AS usuario
    WHERE usuario.id = (v_preparado->>'usuario_id')::uuid
      AND usuario.must_change_password
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Use o fluxo versionado de primeiro acesso.';
  END IF;
  INSERT INTO public.configuracoes_eventos_logs (
    empresa_id, usuario_id, acao, modulo, tipo, detalhes
  ) VALUES (
    (v_preparado->>'empresa_id')::uuid,
    p_actor_user_id,
    'Alterou a propria senha de funcionario CPF ativo',
    'Configuracoes',
    'Sucesso',
    pg_catalog.jsonb_build_object(
      'configuracao_usuario_id', v_preparado->>'usuario_id'
    )
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.confirmar_reset_senha_funcionario_cpf(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirmar_alteracao_senha_propria_funcionario_cpf(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_reset_senha_funcionario_cpf(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.confirmar_alteracao_senha_propria_funcionario_cpf(uuid)
  TO service_role;
