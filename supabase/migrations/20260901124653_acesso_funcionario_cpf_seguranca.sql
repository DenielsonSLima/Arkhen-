CREATE OR REPLACE FUNCTION public.normalizar_identidade_funcionario_cpf()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_perfil public.configuracoes_perfis_acesso%ROWTYPE;
  v_identidade private.identidades_funcionarios_cpf%ROWTYPE;
  v_membership_id uuid;
  v_papel text;
  v_auth_email text;
  v_auth_login_method text;
  v_auth_account_type text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.login_method IS DISTINCT FROM NEW.login_method THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'A forma de login nao pode ser alterada.';
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.login_method = 'cpf'
     AND (
       OLD.auth_user_id IS DISTINCT FROM NEW.auth_user_id
       OR public.normalizar_cpf(COALESCE(OLD.cpf, ''))
         IS DISTINCT FROM public.normalizar_cpf(COALESCE(NEW.cpf, ''))
       OR OLD.empresa_id IS DISTINCT FROM NEW.empresa_id
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'A identidade de login por CPF nao pode ser alterada.';
  END IF;

  NEW.nome := pg_catalog.btrim(NEW.nome);
  NEW.email := pg_catalog.lower(NULLIF(pg_catalog.btrim(NEW.email), ''));
  NEW.telefone := NULLIF(
    pg_catalog.regexp_replace(COALESCE(NEW.telefone, ''), '[^0-9]', '', 'g'),
    ''
  );

  IF pg_catalog.length(NEW.nome) NOT BETWEEN 2 AND 150
     OR NEW.nome !~ '[[:alpha:]]'
     OR NEW.nome ~ '[[:cntrl:]]'
     OR NEW.nome ~ '[<>]' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023', MESSAGE = 'Nome invalido.';
  END IF;

  IF NEW.email IS NOT NULL
     AND (
       pg_catalog.length(NEW.email) > 150
       OR NEW.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
       OR NEW.email ~ '[[:cntrl:]<>]'
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023', MESSAGE = 'Email de contato invalido.';
  END IF;
  IF NEW.telefone IS NOT NULL
     AND pg_catalog.length(NEW.telefone) NOT IN (10, 11) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023', MESSAGE = 'Telefone de contato invalido.';
  END IF;
  IF NOT public.configuracao_acesso_valida(NEW.access_config) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023', MESSAGE = 'Configuracao de acesso invalida.';
  END IF;

  IF NEW.cpf IS NULL OR pg_catalog.btrim(NEW.cpf) = '' THEN
    NEW.cpf := NULL;
  ELSE
    NEW.cpf := public.normalizar_cpf(NEW.cpf);
    IF NOT public.cpf_valido(NEW.cpf) THEN
      RAISE EXCEPTION USING
        ERRCODE = '22023', MESSAGE = 'CPF invalido.';
    END IF;
  END IF;

  IF NEW.auth_user_id IS NOT NULL THEN
    SELECT
      pg_catalog.lower(auth_user.email),
      auth_user.raw_app_meta_data->>'login_method',
      auth_user.raw_app_meta_data->>'account_type'
    INTO v_auth_email, v_auth_login_method, v_auth_account_type
    FROM auth.users auth_user
    WHERE auth_user.id = NEW.auth_user_id;
  END IF;

  SELECT * INTO v_identidade
  FROM private.identidades_funcionarios_cpf identidade
  WHERE identidade.configuracao_usuario_id = NEW.id;

  IF NEW.login_method <> 'cpf' THEN
    IF v_identidade.configuracao_usuario_id IS NOT NULL
       OR v_auth_login_method = 'cpf'
       OR v_auth_account_type = 'employee_cpf' THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501', MESSAGE = 'Conta de funcionario CPF nao pode usar onboarding por email.';
    END IF;
    RETURN NEW;
  END IF;
  IF v_identidade.configuracao_usuario_id IS NULL
     OR v_identidade.auth_user_id IS DISTINCT FROM NEW.auth_user_id
     OR v_identidade.empresa_id IS DISTINCT FROM NEW.empresa_id
     OR v_identidade.cpf_normalizado IS DISTINCT FROM NEW.cpf
     OR v_auth_email IS DISTINCT FROM v_identidade.auth_alias
     OR v_auth_login_method IS DISTINCT FROM 'cpf'
     OR v_auth_account_type IS DISTINCT FROM 'employee_cpf' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Identidade Auth de funcionario CPF inconsistente.';
  END IF;
  IF NEW.email IS NOT NULL
     AND NEW.email = v_identidade.auth_alias THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'O alias tecnico nao pode ser usado como email de contato.';
  END IF;
  IF NEW.perfil_acesso_id IS NULL OR NEW.auth_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514', MESSAGE = 'Funcionario CPF requer perfil e conta Auth vinculados.';
  END IF;

  SELECT * INTO v_perfil
  FROM public.configuracoes_perfis_acesso
  WHERE id = NEW.perfil_acesso_id
    AND empresa_id = NEW.empresa_id
    AND ativo = true
  FOR SHARE;

  IF v_perfil.id IS NULL
     OR pg_catalog.lower(COALESCE(v_perfil.codigo, '')) IN ('gestor', 'admin', 'administrador')
     OR pg_catalog.lower(v_perfil.nome) IN ('gestor', 'admin', 'administrador')
     OR v_perfil.permissoes && ARRAY[
       'usuarios:manage', 'perfis:manage', 'configuracoes:manage'
     ]::text[] THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Perfil privilegiado nao permitido para acesso por CPF.';
  END IF;

  NEW.perfil := v_perfil.nome;

  SELECT id, papel INTO v_membership_id, v_papel
  FROM public.perfis
  WHERE user_id = NEW.auth_user_id
    AND empresa_id = NEW.empresa_id;

  IF v_membership_id IS DISTINCT FROM NEW.perfil_id
     OR v_papel IS DISTINCT FROM 'membro' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Funcionario CPF deve possuir papel de membro.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.normalizar_identidade_funcionario_cpf()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS normalizar_identidade_funcionario_cpf_trigger
  ON public.configuracoes_usuarios;
CREATE TRIGGER normalizar_identidade_funcionario_cpf_trigger
BEFORE INSERT OR UPDATE OF nome, email, cpf, login_method, auth_user_id, empresa_id,
  perfil_id, perfil_acesso_id, perfil, telefone, access_config
ON public.configuracoes_usuarios
FOR EACH ROW
EXECUTE FUNCTION public.normalizar_identidade_funcionario_cpf();

CREATE OR REPLACE FUNCTION public.proteger_membership_funcionario_cpf()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1
      FROM public.configuracoes_usuarios usuario
      WHERE usuario.perfil_id = OLD.id
        AND usuario.login_method = 'cpf'
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501', MESSAGE = 'A membership de funcionario CPF nao pode ser excluida.';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.papel IS DISTINCT FROM 'membro' AND EXISTS (
    SELECT 1
    FROM auth.users auth_user
    WHERE auth_user.id = NEW.user_id
      AND (
        auth_user.raw_app_meta_data->>'login_method' = 'cpf'
        OR auth_user.raw_app_meta_data->>'account_type' = 'employee_cpf'
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Conta de funcionario CPF deve possuir papel de membro.';
  END IF;

  IF TG_OP = 'UPDATE'
     AND (
       OLD.id IS DISTINCT FROM NEW.id
       OR OLD.user_id IS DISTINCT FROM NEW.user_id
       OR OLD.empresa_id IS DISTINCT FROM NEW.empresa_id
     )
     AND EXISTS (
       SELECT 1
       FROM public.configuracoes_usuarios usuario
       WHERE usuario.perfil_id = OLD.id
         AND usuario.login_method = 'cpf'
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'A identidade da membership CPF nao pode ser alterada.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.configuracoes_usuarios usuario
    WHERE usuario.auth_user_id = NEW.user_id
      AND usuario.empresa_id = NEW.empresa_id
      AND usuario.login_method = 'cpf'
      AND (
        NEW.papel IS DISTINCT FROM 'membro'
        OR NEW.ativo IS DISTINCT FROM (usuario.status = 'Ativo')
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Membership privilegiada ou inconsistente para funcionario CPF.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.proteger_membership_funcionario_cpf()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS proteger_membership_funcionario_cpf_trigger ON public.perfis;
CREATE TRIGGER proteger_membership_funcionario_cpf_trigger
BEFORE INSERT OR UPDATE OF id, papel, ativo, user_id, empresa_id
ON public.perfis
FOR EACH ROW
EXECUTE FUNCTION public.proteger_membership_funcionario_cpf();

DROP TRIGGER IF EXISTS proteger_exclusao_membership_funcionario_cpf_trigger
  ON public.perfis;
CREATE TRIGGER proteger_exclusao_membership_funcionario_cpf_trigger
BEFORE DELETE ON public.perfis
FOR EACH ROW
EXECUTE FUNCTION public.proteger_membership_funcionario_cpf();

CREATE OR REPLACE FUNCTION public.proteger_exclusao_usuario_auth_vinculado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.auth_user_id IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Usuario com conta Auth deve ser inativado, nao excluido.';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.proteger_exclusao_usuario_auth_vinculado()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS proteger_exclusao_usuario_auth_vinculado_trigger
  ON public.configuracoes_usuarios;
CREATE TRIGGER proteger_exclusao_usuario_auth_vinculado_trigger
BEFORE DELETE ON public.configuracoes_usuarios
FOR EACH ROW
EXECUTE FUNCTION public.proteger_exclusao_usuario_auth_vinculado();

CREATE OR REPLACE FUNCTION public.current_user_access_allowed(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.perfis membership
      JOIN public.empresas empresa ON empresa.id = membership.empresa_id
      JOIN public.configuracoes_usuarios usuario
        ON usuario.empresa_id = membership.empresa_id
       AND usuario.auth_user_id = membership.user_id
      JOIN auth.users auth_user ON auth_user.id = membership.user_id
      LEFT JOIN private.identidades_funcionarios_cpf identidade
        ON identidade.configuracao_usuario_id = usuario.id
      WHERE membership.user_id = auth.uid()
        AND membership.empresa_id = p_empresa_id
        AND membership.ativo = true
        AND membership.papel IN ('admin', 'contador', 'assistente', 'membro')
        AND empresa.status = 'ativo'
        AND usuario.status = 'Ativo'
        AND public.configuracao_acesso_permite_agora(usuario.access_config)
        AND (
          (
            usuario.login_method = 'email'
            AND identidade.configuracao_usuario_id IS NULL
            AND COALESCE(auth_user.raw_app_meta_data->>'login_method', '') <> 'cpf'
            AND COALESCE(auth_user.raw_app_meta_data->>'account_type', '')
              <> 'employee_cpf'
          )
          OR (
            usuario.login_method = 'cpf'
            AND identidade.auth_user_id = usuario.auth_user_id
            AND identidade.empresa_id = usuario.empresa_id
            AND identidade.cpf_normalizado = usuario.cpf
            AND pg_catalog.lower(auth_user.email) = identidade.auth_alias
            AND auth_user.raw_app_meta_data->>'login_method' = 'cpf'
            AND auth_user.raw_app_meta_data->>'account_type' = 'employee_cpf'
            AND EXISTS (
              SELECT 1
              FROM public.configuracoes_perfis_acesso acesso
              WHERE acesso.id = usuario.perfil_acesso_id
                AND acesso.empresa_id = usuario.empresa_id
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
        )
    );
$$;

REVOKE ALL ON FUNCTION public.current_user_access_allowed(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_access_allowed(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.is_empresa_member(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.current_user_access_allowed(p_empresa_id);
$$;

REVOKE ALL ON FUNCTION public.is_empresa_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_empresa_member(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.current_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT membership.empresa_id
  FROM public.perfis membership
  WHERE membership.user_id = auth.uid()
    AND public.current_user_access_allowed(membership.empresa_id)
  ORDER BY membership.created_at, membership.id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_empresa_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_empresa_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_has_permission(
  p_empresa_id uuid,
  p_permission text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.current_user_access_allowed(p_empresa_id)
    AND (
      EXISTS (
        SELECT 1
        FROM public.perfis membership
        WHERE membership.user_id = auth.uid()
          AND membership.empresa_id = p_empresa_id
          AND membership.ativo = true
          AND membership.papel = 'admin'
      )
      OR EXISTS (
        SELECT 1
        FROM public.configuracoes_usuarios usuario
        JOIN public.configuracoes_perfis_acesso acesso
          ON acesso.empresa_id = usuario.empresa_id
         AND acesso.ativo = true
         AND (
           acesso.id = usuario.perfil_acesso_id
           OR (
             usuario.perfil_acesso_id IS NULL
             AND pg_catalog.lower(acesso.nome) = pg_catalog.lower(usuario.perfil)
           )
         )
        WHERE usuario.empresa_id = p_empresa_id
          AND usuario.auth_user_id = auth.uid()
          AND usuario.status = 'Ativo'
          AND p_permission = ANY(acesso.permissoes)
      )
    );
$$;

REVOKE ALL ON FUNCTION public.current_user_has_permission(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_has_permission(uuid, text)
  TO authenticated;
