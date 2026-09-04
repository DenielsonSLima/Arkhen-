-- Versiona credenciais gerenciadas e fecha o acesso ate concluir a senha.
ALTER TABLE public.configuracoes_usuarios ADD COLUMN IF NOT EXISTS
  auth_credential_version uuid;

UPDATE auth.users AS auth_user
SET raw_app_meta_data = COALESCE(auth_user.raw_app_meta_data, '{}'::jsonb)
      || pg_catalog.jsonb_build_object(
        'credential_version', extensions.gen_random_uuid()::text
      ),
    updated_at = pg_catalog.now()
WHERE (
    auth_user.raw_app_meta_data->>'login_method' = 'cpf'
    OR auth_user.raw_app_meta_data->>'account_type' = 'employee_cpf'
  )
  AND COALESCE(auth_user.raw_app_meta_data->>'credential_version', '')
    !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE public.configuracoes_usuarios AS usuario
SET auth_credential_version = (
      auth_user.raw_app_meta_data->>'credential_version'
    )::uuid,
    updated_at = pg_catalog.now()
FROM auth.users AS auth_user
WHERE usuario.login_method = 'cpf'
  AND auth_user.id = usuario.auth_user_id
  AND auth_user.raw_app_meta_data->>'login_method' = 'cpf'
  AND auth_user.raw_app_meta_data->>'account_type' = 'employee_cpf'
  AND auth_user.raw_app_meta_data->>'credential_version'
    ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.configuracoes_usuarios AS usuario
    WHERE usuario.login_method = 'cpf'
      AND usuario.auth_credential_version IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Backfill interrompido: funcionario CPF sem versao Auth valida.';
  END IF;
END;
$$;

ALTER TABLE public.configuracoes_usuarios
  DROP CONSTRAINT IF EXISTS configuracoes_usuarios_cpf_credential_version_check;
ALTER TABLE public.configuracoes_usuarios
  ADD CONSTRAINT configuracoes_usuarios_cpf_credential_version_check
  CHECK (login_method <> 'cpf' OR auth_credential_version IS NOT NULL);

COMMENT ON COLUMN public.configuracoes_usuarios.auth_credential_version IS
  'Versao opaca da credencial gerenciada; deve coincidir no banco, Auth e JWT.';

CREATE OR REPLACE FUNCTION public.proteger_credencial_usuario_gerenciado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auth_email text;
  v_login_method text;
  v_account_type text;
  v_auth_version_text text;
  v_auth_version uuid;
  v_request_role text := COALESCE(auth.jwt()->>'role', '');
  v_managed boolean;
BEGIN
  IF NEW.auth_user_id IS NULL THEN
    IF NEW.login_method = 'cpf' OR NEW.auth_credential_version IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514', MESSAGE = 'Configuracao de autenticacao incompleta.';
    END IF;
    RETURN NEW;
  END IF;

  SELECT
    pg_catalog.lower(auth_user.email),
    auth_user.raw_app_meta_data->>'login_method',
    auth_user.raw_app_meta_data->>'account_type',
    auth_user.raw_app_meta_data->>'credential_version'
  INTO v_auth_email, v_login_method, v_account_type, v_auth_version_text
  FROM auth.users AS auth_user
  WHERE auth_user.id = NEW.auth_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Conta Auth nao encontrada.';
  END IF;

  v_managed := COALESCE(v_account_type IN ('employee_cpf', 'employee_email'), false);
  IF NOT v_managed THEN
    IF NEW.login_method = 'cpf' OR NEW.auth_credential_version IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501', MESSAGE = 'Conta Auth nao corresponde a usuario gerenciado.';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND v_request_role <> 'service_role'
     AND (
       OLD.auth_user_id IS DISTINCT FROM NEW.auth_user_id
       OR OLD.empresa_id IS DISTINCT FROM NEW.empresa_id
       OR OLD.perfil_id IS DISTINCT FROM NEW.perfil_id
       OR OLD.login_method IS DISTINCT FROM NEW.login_method
       OR OLD.must_change_password IS DISTINCT FROM NEW.must_change_password
       OR OLD.auth_credential_version IS DISTINCT FROM NEW.auth_credential_version
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Campos de autenticacao nao podem ser alterados diretamente.';
  END IF;

  IF TG_OP = 'INSERT' AND v_request_role <> 'service_role' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Usuario gerenciado deve ser provisionado pelo servidor.';
  END IF;
  IF COALESCE(v_auth_version_text, '')
       !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514', MESSAGE = 'Versao de credencial Auth invalida.';
  END IF;
  v_auth_version := v_auth_version_text::uuid;

  IF v_account_type = 'employee_cpf' THEN
    IF NEW.login_method IS DISTINCT FROM 'cpf' OR v_login_method IS DISTINCT FROM 'cpf' THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501', MESSAGE = 'Metodo de autenticacao CPF inconsistente.';
    END IF;
  ELSE
    IF NEW.login_method IS DISTINCT FROM 'email' OR v_login_method IS DISTINCT FROM 'email'
       OR v_auth_email IS DISTINCT FROM pg_catalog.lower(NEW.email)
       OR NEW.cpf IS NULL
       OR NOT public.cpf_valido(NEW.cpf) THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501', MESSAGE = 'Identidade Auth de funcionario por email inconsistente.';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.auth_credential_version := v_auth_version;
    NEW.must_change_password := true;
    IF v_account_type = 'employee_email' THEN
      NEW.status := 'Pendente';
    END IF;
  ELSIF NEW.auth_credential_version IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514', MESSAGE = 'Usuario gerenciado requer versao de credencial.';
  END IF;

  IF TG_OP = 'UPDATE'
     AND v_account_type = 'employee_email'
     AND (
       OLD.auth_user_id IS DISTINCT FROM NEW.auth_user_id
       OR OLD.empresa_id IS DISTINCT FROM NEW.empresa_id
       OR pg_catalog.lower(OLD.email) IS DISTINCT FROM pg_catalog.lower(NEW.email)
       OR OLD.login_method IS DISTINCT FROM NEW.login_method
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Identidade do funcionario por email nao pode ser alterada.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.proteger_credencial_usuario_gerenciado()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS proteger_credencial_usuario_gerenciado_trigger
  ON public.configuracoes_usuarios;
CREATE TRIGGER proteger_credencial_usuario_gerenciado_trigger
BEFORE INSERT OR UPDATE OF auth_user_id, empresa_id, perfil_id, login_method,
  email, cpf, must_change_password, auth_credential_version
ON public.configuracoes_usuarios
FOR EACH ROW
EXECUTE FUNCTION public.proteger_credencial_usuario_gerenciado();

-- O cliente pode editar apenas dados operacionais; vinculos Auth e flags ficam
-- exclusivos de funcoes SECURITY DEFINER chamadas pela service role.
REVOKE UPDATE ON TABLE public.configuracoes_usuarios
  FROM PUBLIC, anon, authenticated;
GRANT UPDATE (
  empresa_id, nome, email, cpf, telefone, perfil_acesso_id, perfil, status,
  access_config
) ON TABLE public.configuracoes_usuarios TO authenticated;

DROP POLICY IF EXISTS configuracoes_usuarios_insert_manager
  ON public.configuracoes_usuarios;
CREATE POLICY configuracoes_usuarios_insert_manager
ON public.configuracoes_usuarios
FOR INSERT TO authenticated
WITH CHECK (
  login_method = 'email'
  AND auth_user_id IS NULL
  AND perfil_id IS NULL
  AND auth_credential_version IS NULL
  AND must_change_password = false
  AND public.current_user_has_permission(empresa_id, 'usuarios:manage')
);

CREATE OR REPLACE FUNCTION public.sincronizar_status_membership_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.auth_user_id IS NOT NULL
     AND (
       OLD.auth_user_id IS DISTINCT FROM NEW.auth_user_id
       OR OLD.empresa_id IS DISTINCT FROM NEW.empresa_id
     ) THEN
    UPDATE public.perfis
    SET ativo = false, updated_at = pg_catalog.now()
    WHERE user_id = OLD.auth_user_id AND empresa_id = OLD.empresa_id;
  END IF;

  IF NEW.auth_user_id IS NOT NULL THEN
    UPDATE public.perfis
    SET ativo = (NEW.status = 'Ativo' AND NOT NEW.must_change_password),
        updated_at = pg_catalog.now()
    WHERE user_id = NEW.auth_user_id AND empresa_id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sincronizar_status_membership_usuario()
  FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS sincronizar_status_membership_usuario_trigger
  ON public.configuracoes_usuarios;
CREATE TRIGGER sincronizar_status_membership_usuario_trigger
AFTER INSERT OR UPDATE OF status, must_change_password, auth_user_id, empresa_id
ON public.configuracoes_usuarios
FOR EACH ROW
EXECUTE FUNCTION public.sincronizar_status_membership_usuario();

CREATE OR REPLACE FUNCTION public.proteger_membership_funcionario_cpf()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_managed boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1 FROM public.configuracoes_usuarios AS usuario
      WHERE usuario.perfil_id = OLD.id
        AND usuario.auth_credential_version IS NOT NULL
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501', MESSAGE = 'A membership gerenciada nao pode ser excluida.';
    END IF;
    RETURN OLD;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM auth.users AS auth_user
    WHERE auth_user.id = NEW.user_id
      AND auth_user.raw_app_meta_data->>'account_type'
        IN ('employee_cpf', 'employee_email')
  ) INTO v_managed;

  IF v_managed AND NEW.papel IS DISTINCT FROM 'membro' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Conta gerenciada deve possuir papel de membro.';
  END IF;
  IF TG_OP = 'UPDATE'
     AND (
       OLD.id IS DISTINCT FROM NEW.id
       OR OLD.user_id IS DISTINCT FROM NEW.user_id
       OR OLD.empresa_id IS DISTINCT FROM NEW.empresa_id
     )
     AND EXISTS (
       SELECT 1 FROM public.configuracoes_usuarios AS usuario
       WHERE usuario.perfil_id = OLD.id
         AND usuario.auth_credential_version IS NOT NULL
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'A identidade da membership gerenciada nao pode ser alterada.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.configuracoes_usuarios AS usuario
    WHERE usuario.auth_user_id = NEW.user_id
      AND usuario.empresa_id = NEW.empresa_id
      AND usuario.auth_credential_version IS NOT NULL
      AND (
        NEW.papel IS DISTINCT FROM 'membro'
        OR NEW.ativo IS DISTINCT FROM (
          usuario.status = 'Ativo' AND NOT usuario.must_change_password
        )
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Membership inconsistente para usuario gerenciado.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.proteger_membership_funcionario_cpf()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_user_access_allowed(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.perfis AS membership
    JOIN public.empresas AS empresa ON empresa.id = membership.empresa_id
    JOIN public.configuracoes_usuarios AS usuario
      ON usuario.empresa_id = membership.empresa_id
     AND usuario.auth_user_id = membership.user_id
    JOIN auth.users AS auth_user ON auth_user.id = membership.user_id
    LEFT JOIN private.identidades_funcionarios_cpf AS identidade
      ON identidade.configuracao_usuario_id = usuario.id
    WHERE membership.user_id = auth.uid()
      AND membership.empresa_id = p_empresa_id
      AND membership.ativo = true
      AND membership.papel IN ('admin', 'contador', 'assistente', 'membro')
      AND empresa.status = 'ativo'
      AND usuario.status = 'Ativo'
      AND NOT usuario.must_change_password
      AND public.configuracao_acesso_permite_agora(usuario.access_config)
      AND (
        usuario.auth_credential_version IS NULL
        OR (
          auth_user.raw_app_meta_data->>'credential_version'
            = usuario.auth_credential_version::text
          AND auth.jwt()->'app_metadata'->>'credential_version'
            = usuario.auth_credential_version::text
        )
      )
      AND (
        (
          usuario.login_method = 'email'
          AND identidade.configuracao_usuario_id IS NULL
          AND (
            (
              usuario.auth_credential_version IS NULL
              AND COALESCE(auth_user.raw_app_meta_data->>'account_type', '')
                NOT IN ('employee_cpf', 'employee_email')
              AND COALESCE(auth_user.raw_app_meta_data->>'login_method', '') <> 'cpf'
            )
            OR (
              usuario.auth_credential_version IS NOT NULL
              AND membership.papel = 'membro'
              AND pg_catalog.lower(auth_user.email) = pg_catalog.lower(usuario.email)
              AND auth_user.email_confirmed_at IS NOT NULL
              AND auth_user.raw_app_meta_data->>'login_method' = 'email'
              AND auth_user.raw_app_meta_data->>'account_type' = 'employee_email'
              AND EXISTS (
                SELECT 1 FROM public.configuracoes_perfis_acesso AS acesso
                WHERE acesso.id = usuario.perfil_acesso_id
                  AND acesso.empresa_id = usuario.empresa_id AND acesso.ativo = true
              )
            )
          )
        )
        OR (
          usuario.login_method = 'cpf'
          AND membership.papel = 'membro'
          AND identidade.auth_user_id = usuario.auth_user_id
          AND identidade.empresa_id = usuario.empresa_id
          AND identidade.cpf_normalizado = usuario.cpf
          AND pg_catalog.lower(auth_user.email) = identidade.auth_alias
          AND auth_user.raw_app_meta_data->>'login_method' = 'cpf'
          AND auth_user.raw_app_meta_data->>'account_type' = 'employee_cpf'
          AND EXISTS (
            SELECT 1 FROM public.configuracoes_perfis_acesso AS acesso
            WHERE acesso.id = usuario.perfil_acesso_id
              AND acesso.empresa_id = usuario.empresa_id AND acesso.ativo = true
              AND pg_catalog.lower(COALESCE(acesso.codigo, ''))
                NOT IN ('gestor', 'admin', 'administrador')
              AND pg_catalog.lower(acesso.nome)
                NOT IN ('gestor', 'admin', 'administrador')
              AND NOT (acesso.permissoes && ARRAY[
                'usuarios:manage', 'perfis:manage', 'configuracoes:manage'
              ]::text[])
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_access_allowed(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_access_allowed(uuid)
  TO authenticated;

-- Reconcile memberships somente depois de instalar a nova invariavel.
UPDATE public.perfis AS membership
SET ativo = (usuario.status = 'Ativo' AND NOT usuario.must_change_password),
    updated_at = pg_catalog.now()
FROM public.configuracoes_usuarios AS usuario
WHERE usuario.auth_user_id = membership.user_id
  AND usuario.empresa_id = membership.empresa_id
  AND membership.ativo IS DISTINCT FROM (
    usuario.status = 'Ativo' AND NOT usuario.must_change_password
  );

CREATE OR REPLACE FUNCTION public.resolver_empresa_gestor_edge(p_actor_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresas uuid[];
BEGIN
  SELECT pg_catalog.array_agg(membership.empresa_id ORDER BY membership.empresa_id)
  INTO v_empresas
  FROM public.perfis AS membership
  JOIN public.empresas AS empresa ON empresa.id = membership.empresa_id
  JOIN public.configuracoes_usuarios AS usuario
    ON usuario.empresa_id = membership.empresa_id
   AND usuario.auth_user_id = membership.user_id
  JOIN auth.users AS auth_user ON auth_user.id = membership.user_id
  WHERE membership.user_id = p_actor_user_id
    AND membership.ativo = true
    AND empresa.status = 'ativo'
    AND usuario.status = 'Ativo'
    AND NOT usuario.must_change_password
    AND usuario.login_method = 'email'
    AND public.configuracao_acesso_permite_agora(usuario.access_config)
    AND (
      usuario.auth_credential_version IS NULL
      OR auth_user.raw_app_meta_data->>'credential_version'
        = usuario.auth_credential_version::text
    )
    AND (
      membership.papel = 'admin'
      OR EXISTS (
        SELECT 1 FROM public.configuracoes_perfis_acesso AS acesso
        WHERE acesso.empresa_id = usuario.empresa_id AND acesso.ativo = true
          AND (
            acesso.id = usuario.perfil_acesso_id
            OR (
              usuario.perfil_acesso_id IS NULL
              AND pg_catalog.lower(acesso.nome) = pg_catalog.lower(usuario.perfil)
            )
          )
          AND 'usuarios:manage' = ANY(acesso.permissoes)
      )
    );
  IF COALESCE(pg_catalog.array_length(v_empresas, 1), 0) <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Gestor sem empresa unica e ativa.';
  END IF;
  RETURN v_empresas[1];
END;
$$;

REVOKE ALL ON FUNCTION public.resolver_empresa_gestor_edge(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_empresa_gestor_edge(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_empresa_id_for_user(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT membership.empresa_id
  FROM public.perfis AS membership
  JOIN public.empresas AS empresa ON empresa.id = membership.empresa_id
  JOIN public.configuracoes_usuarios AS usuario
    ON usuario.empresa_id = membership.empresa_id
   AND usuario.auth_user_id = membership.user_id
  JOIN auth.users AS auth_user ON auth_user.id = membership.user_id
  WHERE membership.user_id = p_user_id
    AND membership.ativo = true
    AND empresa.status = 'ativo'
    AND usuario.status = 'Ativo'
    AND NOT usuario.must_change_password
    AND public.configuracao_acesso_permite_agora(usuario.access_config)
    AND (
      usuario.auth_credential_version IS NULL
      OR auth_user.raw_app_meta_data->>'credential_version'
        = usuario.auth_credential_version::text
    )
  ORDER BY membership.created_at, membership.id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_empresa_id_for_user(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_empresa_id_for_user(uuid)
  TO service_role;
