CREATE OR REPLACE FUNCTION public.obter_contexto_usuario_atual()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  -- Somente o formulario de troca e liberado; membership e RLS permanecem fechadas.
  IF v_usuario.login_method = 'email' AND v_usuario.must_change_password THEN
    PERFORM public.preparar_primeiro_acesso_usuario_gerenciado(v_user_id);
    RETURN pg_catalog.jsonb_build_object(
      'id', v_usuario.id,
      'empresa_id', v_usuario.empresa_id,
      'auth_user_id', v_usuario.auth_user_id,
      'nome', v_usuario.nome,
      'email', v_usuario.email,
      'cpf', v_usuario.cpf,
      'telefone', v_usuario.telefone,
      'login_method', 'email',
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
$function$
;
