-- Provisionamento compensavel de funcionario por email. A conta Auth deve ser
-- criada e marcada pela Edge antes desta transacao; o convite e enviado depois.

CREATE OR REPLACE FUNCTION public.preparar_provisionamento_funcionario_email(
  p_actor_user_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.resolver_empresa_gestor_edge(p_actor_user_id);
  v_nome text := pg_catalog.btrim(COALESCE(p_payload->>'nome', ''));
  v_email text := pg_catalog.lower(NULLIF(pg_catalog.btrim(p_payload->>'email'), ''));
  v_cpf text := public.normalizar_cpf(COALESCE(p_payload->>'cpf', ''));
  v_telefone text := NULLIF(
    pg_catalog.regexp_replace(COALESCE(p_payload->>'telefone', ''), '[^0-9]', '', 'g'),
    ''
  );
  v_perfil_id uuid;
  v_credential_version uuid;
  v_perfil public.configuracoes_perfis_acesso%ROWTYPE;
  v_access_config jsonb := COALESCE(
    p_payload->'access_config',
    '{"enabled":false,"days":[1,2,3,4,5],"intervals":[{"start":"08:00","end":"18:00"}],"message":"Seu acesso nao esta permitido neste dia ou horario. Entre em contato com o gestor."}'::jsonb
  );
BEGIN
  IF p_payload IS NULL OR pg_catalog.jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Payload invalido.';
  END IF;
  BEGIN
    v_perfil_id := (p_payload->>'perfil_id')::uuid;
    v_credential_version := (p_payload->>'credential_version')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Perfil ou versao invalida.';
  END;

  IF pg_catalog.length(v_nome) NOT BETWEEN 2 AND 150
     OR v_nome !~ '[[:alpha:]]'
     OR v_nome ~ '[[:cntrl:]<>]' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Nome invalido.';
  END IF;
  IF v_email IS NULL
     OR pg_catalog.length(v_email) > 150
     OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     OR v_email ~ '[[:cntrl:]<>]' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Email invalido.';
  END IF;
  IF NOT public.cpf_valido(v_cpf) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CPF invalido.';
  END IF;
  IF v_telefone IS NULL OR pg_catalog.length(v_telefone) NOT IN (10, 11) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Telefone invalido.';
  END IF;
  IF v_perfil_id IS NULL OR v_credential_version IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Perfil ou versao invalida.';
  END IF;
  IF NOT public.configuracao_acesso_valida(v_access_config) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023', MESSAGE = 'Configuracao de acesso invalida.';
  END IF;

  SELECT * INTO v_perfil
  FROM public.configuracoes_perfis_acesso AS acesso
  WHERE acesso.id = v_perfil_id
    AND acesso.empresa_id = v_empresa_id
    AND acesso.ativo = true
  FOR SHARE;
  IF v_perfil.id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Perfil de acesso invalido para a empresa.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.configuracoes_usuarios AS usuario
    WHERE pg_catalog.lower(usuario.email) = v_email
       OR public.normalizar_cpf(COALESCE(usuario.cpf, '')) = v_cpf
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505', MESSAGE = 'Email ou CPF ja cadastrado.';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'empresa_id', v_empresa_id,
    'nome', v_nome,
    'email', v_email,
    'cpf', v_cpf,
    'telefone', v_telefone,
    'perfil_id', v_perfil.id,
    'perfil_nome', v_perfil.nome,
    'access_config', v_access_config,
    'credential_version', v_credential_version
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.provisionar_usuario_funcionario_email(
  p_actor_user_id uuid,
  p_auth_user_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_preparado jsonb;
  v_empresa_id uuid;
  v_email text;
  v_cpf text;
  v_credential_version uuid;
  v_membership_id uuid;
  v_usuario public.configuracoes_usuarios%ROWTYPE;
  v_auth_email text;
  v_auth_login_method text;
  v_auth_account_type text;
  v_auth_version text;
  v_email_confirmed_at timestamptz;
  v_invited_at timestamptz;
BEGIN
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Conta Auth invalida.';
  END IF;
  v_preparado := public.preparar_provisionamento_funcionario_email(
    p_actor_user_id, p_payload
  );
  v_empresa_id := (v_preparado->>'empresa_id')::uuid;
  v_email := v_preparado->>'email';
  v_cpf := v_preparado->>'cpf';
  v_credential_version := (v_preparado->>'credential_version')::uuid;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('funcionario-email:' || v_email, 0)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('funcionario-cpf:' || v_cpf, 0)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('funcionario-auth:' || p_auth_user_id::text, 0)
  );

  IF EXISTS (
    SELECT 1 FROM public.configuracoes_usuarios AS usuario
    WHERE usuario.auth_user_id = p_auth_user_id
       OR pg_catalog.lower(usuario.email) = v_email
       OR public.normalizar_cpf(COALESCE(usuario.cpf, '')) = v_cpf
  ) OR EXISTS (
    SELECT 1 FROM public.perfis AS membership
    WHERE membership.user_id = p_auth_user_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Usuario ja cadastrado.';
  END IF;

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
  WHERE auth_user.id = p_auth_user_id
  FOR SHARE;

  IF NOT FOUND
     OR v_auth_email IS DISTINCT FROM v_email
     OR v_auth_login_method IS DISTINCT FROM 'email'
     OR v_auth_account_type IS DISTINCT FROM 'employee_email'
     OR v_auth_version IS DISTINCT FROM v_credential_version::text
     OR v_email_confirmed_at IS NOT NULL
     OR v_invited_at IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Conta Auth nao corresponde ao convite.';
  END IF;

  INSERT INTO public.perfis (user_id, empresa_id, nome, papel, ativo)
  VALUES (
    p_auth_user_id, v_empresa_id, v_preparado->>'nome', 'membro', false
  )
  RETURNING id INTO v_membership_id;

  INSERT INTO public.configuracoes_usuarios (
    empresa_id, perfil_id, perfil_acesso_id, auth_user_id, nome, email,
    login_method, cpf, telefone, perfil, status, access_config,
    must_change_password, auth_credential_version
  ) VALUES (
    v_empresa_id,
    v_membership_id,
    (v_preparado->>'perfil_id')::uuid,
    p_auth_user_id,
    v_preparado->>'nome',
    v_email,
    'email',
    v_cpf,
    v_preparado->>'telefone',
    v_preparado->>'perfil_nome',
    'Pendente',
    v_preparado->'access_config',
    true,
    v_credential_version
  )
  RETURNING * INTO v_usuario;

  INSERT INTO public.configuracoes_eventos_logs (
    empresa_id, usuario_id, acao, modulo, tipo, detalhes
  ) VALUES (
    v_empresa_id,
    p_actor_user_id,
    'Provisionou convite de funcionario por email',
    'Configuracoes',
    'Sucesso',
    pg_catalog.jsonb_build_object(
      'configuracao_usuario_id', v_usuario.id,
      'auth_user_id', p_auth_user_id,
      'perfil_acesso_id', v_usuario.perfil_acesso_id
    )
  );

  RETURN pg_catalog.to_jsonb(v_usuario) || pg_catalog.jsonb_build_object(
    'membership_id', v_membership_id,
    'membership_papel', 'membro'
  );
END;
$$;

-- Permite remover apenas o vinculo de um convite que comprovadamente ainda nao
-- foi enviado, confirmado ou usado. Qualquer incerteza mantem o estado pendente.
CREATE OR REPLACE FUNCTION public.proteger_exclusao_usuario_auth_vinculado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.auth_user_id IS NULL THEN
    RETURN OLD;
  END IF;
  IF COALESCE(auth.jwt()->>'role', '') = 'service_role'
     AND OLD.login_method = 'email'
     AND OLD.status = 'Pendente'
     AND OLD.must_change_password
     AND OLD.auth_credential_version IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM auth.users AS auth_user
       WHERE auth_user.id = OLD.auth_user_id
         AND auth_user.email_confirmed_at IS NULL
         AND auth_user.invited_at IS NULL
         AND auth_user.last_sign_in_at IS NULL
         AND auth_user.raw_app_meta_data->>'login_method' = 'email'
         AND auth_user.raw_app_meta_data->>'account_type' = 'employee_email'
         AND auth_user.raw_app_meta_data->>'credential_version'
           = OLD.auth_credential_version::text
     ) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION USING
    ERRCODE = '42501',
    MESSAGE = 'Usuario com conta Auth deve ser inativado, nao excluido.';
END;
$$;

REVOKE ALL ON FUNCTION public.proteger_exclusao_usuario_auth_vinculado()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.desfazer_provisionamento_funcionario_email(
  p_actor_user_id uuid,
  p_auth_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.resolver_empresa_gestor_edge(p_actor_user_id);
  v_usuario public.configuracoes_usuarios%ROWTYPE;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('funcionario-auth:' || p_auth_user_id::text, 0)
  );
  SELECT usuario.* INTO v_usuario
  FROM public.configuracoes_usuarios AS usuario
  JOIN public.perfis AS membership ON membership.id = usuario.perfil_id
  JOIN auth.users AS auth_user ON auth_user.id = usuario.auth_user_id
  WHERE usuario.empresa_id = v_empresa_id
    AND usuario.auth_user_id = p_auth_user_id
    AND usuario.login_method = 'email'
    AND usuario.status = 'Pendente'
    AND usuario.must_change_password
    AND usuario.auth_credential_version IS NOT NULL
    AND membership.user_id = p_auth_user_id
    AND membership.empresa_id = v_empresa_id
    AND membership.papel = 'membro'
    AND membership.ativo = false
    AND auth_user.email_confirmed_at IS NULL
    AND auth_user.invited_at IS NULL
    AND auth_user.last_sign_in_at IS NULL
    AND auth_user.raw_app_meta_data->>'login_method' = 'email'
    AND auth_user.raw_app_meta_data->>'account_type' = 'employee_email'
    AND auth_user.raw_app_meta_data->>'credential_version'
      = usuario.auth_credential_version::text
  FOR UPDATE OF usuario;

  IF v_usuario.id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Convite nao pode ser desfeito automaticamente.';
  END IF;
  DELETE FROM public.configuracoes_usuarios WHERE id = v_usuario.id;
  DELETE FROM public.perfis WHERE id = v_usuario.perfil_id;

  INSERT INTO public.configuracoes_eventos_logs (
    empresa_id, usuario_id, acao, modulo, tipo, detalhes
  ) VALUES (
    v_empresa_id,
    p_actor_user_id,
    'Desfez provisionamento de convite nao enviado',
    'Configuracoes',
    'Sucesso',
    pg_catalog.jsonb_build_object('auth_user_id', p_auth_user_id)
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.preparar_provisionamento_funcionario_email(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.provisionar_usuario_funcionario_email(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.desfazer_provisionamento_funcionario_email(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preparar_provisionamento_funcionario_email(uuid, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.provisionar_usuario_funcionario_email(uuid, uuid, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.desfazer_provisionamento_funcionario_email(uuid, uuid)
  TO service_role;
