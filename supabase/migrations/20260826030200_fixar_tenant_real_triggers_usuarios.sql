-- Em UPDATE/DELETE, todas as decisoes usam o tenant persistido em OLD.
-- Isso impede que um payload tente escolher outro tenant antes da normalizacao.
BEGIN;

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

  IF OLD.papel = 'admin'
     AND OLD.ativo = true
     AND EXISTS (
       SELECT 1
       FROM public.configuracoes_usuarios target_user
       WHERE target_user.empresa_id = OLD.empresa_id
         AND target_user.auth_user_id = OLD.user_id
         AND target_user.status = 'Ativo'
         AND lower(COALESCE(target_user.access_config ->> 'enabled', 'false')) <> 'true'
     )
     AND (
       TG_OP = 'DELETE'
       OR NEW.papel <> 'admin'
       OR NEW.ativo = false
     )
     AND NOT EXISTS (
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
      RAISE EXCEPTION 'O e-mail de uma conta Auth vinculada e imutavel.'
        USING ERRCODE = '23514';
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

REVOKE ALL ON FUNCTION public.enforce_membership_privilege_integrity()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.enforce_user_configuration_privilege_integrity()
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
