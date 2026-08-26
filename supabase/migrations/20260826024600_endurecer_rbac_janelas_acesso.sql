-- Impede bypass de horario via API/JWT e separa gestao de usuarios de concessao de privilegios.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.perfis p
    LEFT JOIN public.configuracoes_usuarios u
      ON u.empresa_id = p.empresa_id
     AND u.auth_user_id = p.user_id
     AND u.status = 'Ativo'
    WHERE p.ativo = true
      AND u.id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Existem memberships ativas sem configuracao de usuario ativa; corrija-as antes desta migration.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.configuracoes_usuarios u
    JOIN public.perfis p ON p.id = u.perfil_id
    WHERE u.auth_user_id IS NOT NULL
      AND (
        p.empresa_id <> u.empresa_id
        OR p.user_id <> u.auth_user_id
      )
  ) THEN
    RAISE EXCEPTION
      'Existem configuracoes de usuario ligadas a membership de outro tenant ou usuario.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS perfis_id_empresa_user_unique
  ON public.perfis (id, empresa_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS configuracoes_usuarios_empresa_auth_unique
  ON public.configuracoes_usuarios (empresa_id, auth_user_id)
  WHERE auth_user_id IS NOT NULL;

ALTER TABLE public.configuracoes_usuarios
  DROP CONSTRAINT IF EXISTS configuracoes_usuarios_perfil_id_fkey,
  DROP CONSTRAINT IF EXISTS configuracoes_usuarios_membership_tenant_fkey;

ALTER TABLE public.configuracoes_usuarios
  ADD CONSTRAINT configuracoes_usuarios_membership_tenant_fkey
  FOREIGN KEY (perfil_id, empresa_id, auth_user_id)
  REFERENCES public.perfis (id, empresa_id, user_id)
  ON DELETE SET NULL (perfil_id);

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
      FROM public.perfis p
      JOIN public.configuracoes_usuarios u
        ON u.empresa_id = p.empresa_id
       AND u.auth_user_id = p.user_id
      WHERE p.user_id = auth.uid()
        AND p.empresa_id = p_empresa_id
        AND p.ativo = true
        AND u.status = 'Ativo'
        AND (
          lower(COALESCE(u.access_config ->> 'enabled', 'false')) <> 'true'
          OR (
            EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(
                CASE
                  WHEN jsonb_typeof(u.access_config -> 'days') = 'array'
                    THEN u.access_config -> 'days'
                  ELSE '[]'::jsonb
                END
              ) allowed_day(value)
              WHERE allowed_day.value ~ '^[0-6]$'
                AND allowed_day.value::integer = extract(
                  dow FROM now() AT TIME ZONE 'America/Sao_Paulo'
                )::integer
            )
            AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements(
                CASE
                  WHEN jsonb_typeof(u.access_config -> 'intervals') = 'array'
                    THEN u.access_config -> 'intervals'
                  ELSE '[]'::jsonb
                END
              ) allowed_interval(value)
              WHERE jsonb_typeof(allowed_interval.value) = 'object'
                AND COALESCE(allowed_interval.value ->> 'start', '')
                  ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                AND COALESCE(allowed_interval.value ->> 'end', '')
                  ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                AND (allowed_interval.value ->> 'start')::time
                  <= (now() AT TIME ZONE 'America/Sao_Paulo')::time
                AND (allowed_interval.value ->> 'end')::time
                  >= (now() AT TIME ZONE 'America/Sao_Paulo')::time
            )
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.current_user_access_allowed(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_access_allowed(uuid)
  TO authenticated, service_role;

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
GRANT EXECUTE ON FUNCTION public.is_empresa_member(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_user_is_empresa_admin(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.current_user_access_allowed(p_empresa_id)
    AND EXISTS (
      SELECT 1
      FROM public.perfis p
      WHERE p.user_id = auth.uid()
        AND p.empresa_id = p_empresa_id
        AND p.ativo = true
        AND p.papel = 'admin'
    );
$$;

REVOKE ALL ON FUNCTION public.current_user_is_empresa_admin(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_empresa_admin(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_membership_privilege_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := CASE
    WHEN TG_OP = 'INSERT' THEN NEW.empresa_id
    ELSE OLD.empresa_id
  END;
  v_is_admin boolean;
BEGIN
  IF auth.role() = 'service_role' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessao autenticada obrigatoria.' USING ERRCODE = '42501';
  END IF;

  v_is_admin := public.current_user_is_empresa_admin(v_empresa_id);
  IF TG_OP = 'INSERT'
     AND NOT v_is_admin
     AND NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Somente administradores podem criar memberships de terceiros.'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.empresa_id := OLD.empresa_id;
    NEW.user_id := OLD.user_id;
    NEW.created_at := OLD.created_at;
    IF NEW.papel IS DISTINCT FROM OLD.papel AND NOT v_is_admin THEN
      RAISE EXCEPTION 'Somente administradores podem alterar o papel da membership.'
        USING ERRCODE = '42501';
    END IF;
    IF OLD.papel = 'admin' AND NOT v_is_admin THEN
      RAISE EXCEPTION 'Somente administradores podem alterar outro administrador.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Somente administradores podem excluir memberships.'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.papel = 'admin' AND OLD.ativo = true AND EXISTS (
    SELECT 1
    FROM public.configuracoes_usuarios target_user
    WHERE target_user.empresa_id = OLD.empresa_id
      AND target_user.auth_user_id = OLD.user_id
      AND target_user.status = 'Ativo'
      AND lower(COALESCE(target_user.access_config ->> 'enabled', 'false')) <> 'true'
  ) AND (
    TG_OP = 'DELETE'
    OR NEW.papel <> 'admin'
    OR NEW.ativo = false
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.perfis other_admin
    JOIN public.configuracoes_usuarios other_user
      ON other_user.empresa_id = other_admin.empresa_id
     AND other_user.auth_user_id = other_admin.user_id
     AND other_user.status = 'Ativo'
     AND lower(COALESCE(other_user.access_config ->> 'enabled', 'false')) <> 'true'
    WHERE other_admin.empresa_id = OLD.empresa_id
      AND other_admin.id <> OLD.id
      AND other_admin.papel = 'admin'
      AND other_admin.ativo = true
  ) THEN
    RAISE EXCEPTION 'A empresa deve manter ao menos um administrador ativo e sem janela de acesso.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_membership_privilege_integrity_trigger
  ON public.perfis;
CREATE TRIGGER enforce_membership_privilege_integrity_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.perfis
  FOR EACH ROW EXECUTE FUNCTION public.enforce_membership_privilege_integrity();

CREATE OR REPLACE FUNCTION public.enforce_user_configuration_privilege_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := CASE
    WHEN TG_OP = 'INSERT' THEN NEW.empresa_id
    ELSE OLD.empresa_id
  END;
  v_self_onboarding boolean := false;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  v_self_onboarding := (
    TG_OP = 'INSERT'
    AND NEW.auth_user_id = auth.uid()
  ) OR (
    TG_OP = 'UPDATE'
    AND (OLD.auth_user_id = auth.uid() OR (
      OLD.auth_user_id IS NULL
      AND NEW.auth_user_id = auth.uid()
    ))
    AND NEW.empresa_id = OLD.empresa_id
    AND NEW.perfil IS NOT DISTINCT FROM OLD.perfil
    AND NEW.status IS NOT DISTINCT FROM OLD.status
    AND NEW.access_config IS NOT DISTINCT FROM OLD.access_config
  );
  IF auth.uid() IS NULL OR (
    NOT v_self_onboarding
    AND NOT public.current_user_has_permission(v_empresa_id, 'usuarios:manage')
  ) THEN
    RAISE EXCEPTION 'Permissao para gerenciar usuarios obrigatoria.' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.empresa_id := OLD.empresa_id;
    IF NOT (
      OLD.auth_user_id IS NULL
      AND NEW.auth_user_id = auth.uid()
      AND v_self_onboarding
    ) THEN
      NEW.auth_user_id := OLD.auth_user_id;
    END IF;
    NEW.created_at := OLD.created_at;
    IF OLD.auth_user_id IS NOT NULL AND lower(NEW.email) <> lower(OLD.email) THEN
      RAISE EXCEPTION 'O e-mail de uma conta Auth vinculada e imutavel.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF (
    TG_OP = 'INSERT'
    OR NEW.perfil IS DISTINCT FROM OLD.perfil
    OR NEW.perfil_id IS DISTINCT FROM OLD.perfil_id
  ) AND NOT v_self_onboarding
    AND NOT public.current_user_is_empresa_admin(v_empresa_id) THEN
    RAISE EXCEPTION 'Somente administradores podem conceder perfis de acesso.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_user_configuration_privilege_integrity_trigger
  ON public.configuracoes_usuarios;
CREATE TRIGGER enforce_user_configuration_privilege_integrity_trigger
  BEFORE INSERT OR UPDATE ON public.configuracoes_usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_configuration_privilege_integrity();

DROP POLICY IF EXISTS perfis_insert_manager ON public.perfis;
DROP POLICY IF EXISTS perfis_update_manager ON public.perfis;
DROP POLICY IF EXISTS perfis_delete_manager ON public.perfis;

CREATE POLICY perfis_insert_admin ON public.perfis
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_empresa_admin(empresa_id));
CREATE POLICY perfis_update_manager ON public.perfis
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission(empresa_id, 'usuarios:manage'))
  WITH CHECK (public.current_user_has_permission(empresa_id, 'usuarios:manage'));
CREATE POLICY perfis_delete_admin ON public.perfis
  FOR DELETE TO authenticated
  USING (public.current_user_is_empresa_admin(empresa_id));

DROP POLICY IF EXISTS configuracoes_perfis_acesso_insert_manager
  ON public.configuracoes_perfis_acesso;
DROP POLICY IF EXISTS configuracoes_perfis_acesso_update_manager
  ON public.configuracoes_perfis_acesso;
DROP POLICY IF EXISTS configuracoes_perfis_acesso_delete_manager
  ON public.configuracoes_perfis_acesso;

CREATE POLICY configuracoes_perfis_acesso_insert_admin
  ON public.configuracoes_perfis_acesso FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_empresa_admin(empresa_id));
CREATE POLICY configuracoes_perfis_acesso_update_admin
  ON public.configuracoes_perfis_acesso FOR UPDATE TO authenticated
  USING (public.current_user_is_empresa_admin(empresa_id))
  WITH CHECK (public.current_user_is_empresa_admin(empresa_id));
CREATE POLICY configuracoes_perfis_acesso_delete_admin
  ON public.configuracoes_perfis_acesso FOR DELETE TO authenticated
  USING (public.current_user_is_empresa_admin(empresa_id));

COMMIT;
