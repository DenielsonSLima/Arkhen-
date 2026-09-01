CREATE OR REPLACE FUNCTION public.preparar_reset_senha_funcionario_cpf(
  p_actor_user_id uuid,
  p_usuario_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.resolver_empresa_gestor_edge(p_actor_user_id);
  v_usuario public.configuracoes_usuarios%ROWTYPE;
  v_identidade private.identidades_funcionarios_cpf%ROWTYPE;
BEGIN
  SELECT * INTO v_usuario
  FROM public.configuracoes_usuarios usuario
  WHERE usuario.id = p_usuario_id
    AND usuario.empresa_id = v_empresa_id
    AND usuario.login_method = 'cpf'
    AND usuario.auth_user_id IS NOT NULL;

  SELECT * INTO v_identidade
  FROM private.identidades_funcionarios_cpf identidade
  WHERE identidade.configuracao_usuario_id = v_usuario.id;

  IF v_usuario.id IS NULL OR v_identidade.configuracao_usuario_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002', MESSAGE = 'Funcionario CPF nao encontrado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.perfis membership
    JOIN auth.users auth_user ON auth_user.id = membership.user_id
    WHERE membership.id = v_usuario.perfil_id
      AND membership.user_id = v_usuario.auth_user_id
      AND membership.empresa_id = v_usuario.empresa_id
      AND membership.papel = 'membro'
      AND v_identidade.auth_user_id = v_usuario.auth_user_id
      AND v_identidade.empresa_id = v_usuario.empresa_id
      AND v_identidade.cpf_normalizado = v_usuario.cpf
      AND pg_catalog.lower(auth_user.email) = v_identidade.auth_alias
      AND auth_user.raw_app_meta_data->>'login_method' = 'cpf'
      AND auth_user.raw_app_meta_data->>'account_type' = 'employee_cpf'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Vinculo Auth do funcionario CPF esta inconsistente.';
  END IF;

  IF NOT EXISTS (
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
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Perfil privilegiado nao permitido.';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'usuario_id', v_usuario.id,
    'auth_user_id', v_usuario.auth_user_id,
    'empresa_id', v_empresa_id,
    'cpf', v_identidade.cpf_normalizado
  );
END;
$$;

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
BEGIN
  v_preparado := public.preparar_reset_senha_funcionario_cpf(
    p_actor_user_id,
    p_usuario_id
  );

  UPDATE public.configuracoes_usuarios
  SET must_change_password = false
  WHERE id = p_usuario_id
    AND empresa_id = (v_preparado->>'empresa_id')::uuid;

  INSERT INTO public.configuracoes_eventos_logs (
    empresa_id, usuario_id, acao, modulo, tipo, detalhes
  ) VALUES (
    (v_preparado->>'empresa_id')::uuid,
    p_actor_user_id,
    'Redefiniu senha de funcionario CPF',
    'Configuracoes',
    'Sucesso',
    pg_catalog.jsonb_build_object(
      'configuracao_usuario_id', p_usuario_id,
      'auth_user_id', v_preparado->>'auth_user_id'
    )
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.preparar_reset_senha_funcionario_cpf(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirmar_reset_senha_funcionario_cpf(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preparar_reset_senha_funcionario_cpf(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.confirmar_reset_senha_funcionario_cpf(uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.preparar_alteracao_senha_propria_funcionario_cpf(
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
  v_identidade private.identidades_funcionarios_cpf%ROWTYPE;
BEGIN
  SELECT usuario.* INTO v_usuario
  FROM public.configuracoes_usuarios usuario
  JOIN private.identidades_funcionarios_cpf identidade
    ON identidade.configuracao_usuario_id = usuario.id
  WHERE identidade.auth_user_id = p_actor_user_id
    AND usuario.auth_user_id = p_actor_user_id
    AND usuario.login_method = 'cpf';

  IF v_usuario.id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Alteracao de senha nao autorizada.';
  END IF;

  SELECT * INTO v_identidade
  FROM private.identidades_funcionarios_cpf identidade
  WHERE identidade.configuracao_usuario_id = v_usuario.id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.perfis membership
    JOIN public.empresas empresa ON empresa.id = membership.empresa_id
    JOIN auth.users auth_user ON auth_user.id = membership.user_id
    JOIN public.configuracoes_perfis_acesso acesso
      ON acesso.id = v_usuario.perfil_acesso_id
     AND acesso.empresa_id = v_usuario.empresa_id
    WHERE membership.id = v_usuario.perfil_id
      AND membership.user_id = p_actor_user_id
      AND membership.empresa_id = v_usuario.empresa_id
      AND membership.papel = 'membro'
      AND membership.ativo = true
      AND empresa.status = 'ativo'
      AND v_usuario.status = 'Ativo'
      AND public.configuracao_acesso_permite_agora(v_usuario.access_config)
      AND v_identidade.auth_user_id = p_actor_user_id
      AND v_identidade.empresa_id = v_usuario.empresa_id
      AND v_identidade.cpf_normalizado = v_usuario.cpf
      AND pg_catalog.lower(auth_user.email) = v_identidade.auth_alias
      AND auth_user.raw_app_meta_data->>'login_method' = 'cpf'
      AND auth_user.raw_app_meta_data->>'account_type' = 'employee_cpf'
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
      ERRCODE = '42501', MESSAGE = 'Alteracao de senha nao autorizada.';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'usuario_id', v_usuario.id,
    'auth_user_id', p_actor_user_id,
    'empresa_id', v_usuario.empresa_id,
    'cpf', v_identidade.cpf_normalizado
  );
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

  UPDATE public.configuracoes_usuarios
  SET must_change_password = false
  WHERE id = (v_preparado->>'usuario_id')::uuid
    AND auth_user_id = p_actor_user_id;

  INSERT INTO public.configuracoes_eventos_logs (
    empresa_id, usuario_id, acao, modulo, tipo, detalhes
  ) VALUES (
    (v_preparado->>'empresa_id')::uuid,
    p_actor_user_id,
    'Alterou a propria senha de funcionario CPF',
    'Configuracoes',
    'Sucesso',
    pg_catalog.jsonb_build_object(
      'configuracao_usuario_id', v_preparado->>'usuario_id',
      'auth_user_id', p_actor_user_id
    )
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION
  public.preparar_alteracao_senha_propria_funcionario_cpf(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION
  public.confirmar_alteracao_senha_propria_funcionario_cpf(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.preparar_alteracao_senha_propria_funcionario_cpf(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION
  public.confirmar_alteracao_senha_propria_funcionario_cpf(uuid)
  TO service_role;
