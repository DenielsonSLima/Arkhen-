CREATE OR REPLACE FUNCTION public.obter_contexto_usuario_atual()
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
  v_empresa_status text;
  v_auth_email text;
  v_auth_login_method text;
  v_auth_account_type text;
  v_quantidade integer;
  v_agora timestamptz := pg_catalog.now();
  v_mensagem text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Usuario nao autenticado.';
  END IF;

  SELECT pg_catalog.count(*) INTO v_quantidade
  FROM public.configuracoes_usuarios usuario
  WHERE usuario.auth_user_id = v_user_id;

  IF v_quantidade = 0 THEN
    RETURN NULL;
  END IF;

  IF v_quantidade > 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Configuracao de acesso indisponivel.';
  END IF;

  SELECT * INTO v_usuario
  FROM public.configuracoes_usuarios usuario
  WHERE usuario.auth_user_id = v_user_id
  FOR UPDATE;

  SELECT * INTO v_membership
  FROM public.perfis membership
  WHERE membership.user_id = v_user_id
    AND membership.empresa_id = v_usuario.empresa_id;

  SELECT * INTO v_identidade
  FROM private.identidades_funcionarios_cpf identidade
  WHERE identidade.configuracao_usuario_id = v_usuario.id;

  SELECT status INTO v_empresa_status
  FROM public.empresas
  WHERE id = v_usuario.empresa_id;

  SELECT
    pg_catalog.lower(email),
    raw_app_meta_data->>'login_method',
    raw_app_meta_data->>'account_type'
  INTO v_auth_email, v_auth_login_method, v_auth_account_type
  FROM auth.users
  WHERE id = v_user_id;

  IF v_membership.id IS NULL
     OR NOT v_membership.ativo
     OR v_empresa_status IS DISTINCT FROM 'ativo'
     OR v_usuario.status <> 'Ativo'
     OR (
       v_usuario.login_method = 'email'
       AND (
         v_identidade.configuracao_usuario_id IS NOT NULL
         OR v_auth_login_method = 'cpf'
         OR v_auth_account_type = 'employee_cpf'
       )
     )
     OR (
       v_usuario.login_method = 'cpf'
       AND (
         v_identidade.configuracao_usuario_id IS NULL
         OR v_identidade.auth_user_id IS DISTINCT FROM v_usuario.auth_user_id
         OR v_identidade.empresa_id IS DISTINCT FROM v_usuario.empresa_id
         OR v_identidade.cpf_normalizado IS DISTINCT FROM v_usuario.cpf
         OR v_auth_email IS DISTINCT FROM v_identidade.auth_alias
         OR v_auth_login_method IS DISTINCT FROM 'cpf'
         OR v_auth_account_type IS DISTINCT FROM 'employee_cpf'
         OR NOT EXISTS (
           SELECT 1
           FROM public.configuracoes_perfis_acesso acesso
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
         )
       )
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Acesso indisponivel. Entre em contato com o gestor.';
  END IF;

  IF NOT public.configuracao_acesso_permite_agora(v_usuario.access_config, v_agora) THEN
    v_mensagem := NULLIF(
      pg_catalog.btrim(v_usuario.access_config->>'message'), ''
    );
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = COALESCE(
        v_mensagem,
        'Seu acesso nao esta permitido neste dia ou horario. Entre em contato com o gestor.'
      );
  END IF;

  UPDATE public.configuracoes_usuarios
  SET ultimo_acesso_em = v_agora
  WHERE id = v_usuario.id;

  RETURN pg_catalog.jsonb_build_object(
    'id', v_usuario.id,
    'empresa_id', v_usuario.empresa_id,
    'auth_user_id', v_usuario.auth_user_id,
    'nome', v_usuario.nome,
    'email', v_usuario.email,
    'cpf', v_usuario.cpf,
    'telefone', v_usuario.telefone,
    'login_method', v_usuario.login_method,
    'perfil', v_usuario.perfil,
    'perfil_acesso_id', v_usuario.perfil_acesso_id,
    'status', v_usuario.status,
    'access_config', v_usuario.access_config,
    'must_change_password', v_usuario.must_change_password,
    'ultimo_acesso_em', v_agora,
    'created_at', v_usuario.created_at,
    'membership_id', v_membership.id,
    'membership_papel', v_membership.papel
  );
END;
$$;

REVOKE ALL ON FUNCTION public.obter_contexto_usuario_atual()
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.obter_contexto_usuario_atual()
  TO authenticated;
