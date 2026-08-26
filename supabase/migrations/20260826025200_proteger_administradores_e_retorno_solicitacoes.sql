-- Guardas pontuais para administradores configurados e para o RETURNING das
-- solicitacoes documentais. Nao substitui o trigger geral criado em 024600.
BEGIN;

CREATE OR REPLACE FUNCTION public.proteger_administrador_configurado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := OLD.empresa_id;
  v_target_is_admin boolean;
  v_target_remains_active_admin boolean := false;
  v_has_other_unrestricted_admin boolean := false;
  v_service_role boolean := COALESCE((SELECT auth.role()) = 'service_role', false);
BEGIN
  v_target_is_admin := lower(btrim(COALESCE(OLD.perfil, ''))) IN (
    'admin', 'administrador', 'gestor'
  ) OR EXISTS (
    SELECT 1
    FROM public.perfis membership
    WHERE membership.empresa_id = OLD.empresa_id
      AND membership.papel = 'admin'
      AND (
        membership.id = OLD.perfil_id
        OR (
          OLD.auth_user_id IS NOT NULL
          AND membership.user_id = OLD.auth_user_id
        )
      )
  );

  v_has_other_unrestricted_admin := EXISTS (
    SELECT 1
    FROM public.configuracoes_usuarios other_user
    JOIN public.perfis other_membership
      ON other_membership.empresa_id = other_user.empresa_id
     AND other_membership.user_id = other_user.auth_user_id
     AND other_membership.papel = 'admin'
     AND other_membership.ativo = true
    WHERE other_user.empresa_id = OLD.empresa_id
      AND other_user.id <> OLD.id
      AND other_user.status = 'Ativo'
      AND other_user.auth_user_id IS NOT NULL
      AND lower(COALESCE(other_user.access_config ->> 'enabled', 'false')) <> 'true'
  );

  IF v_target_is_admin
     AND NOT v_service_role
     AND NOT public.current_user_is_empresa_admin(v_empresa_id) THEN
    RAISE EXCEPTION 'Somente administradores podem alterar ou excluir outro administrador.'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_target_remains_active_admin := NEW.status = 'Ativo'
      AND NEW.auth_user_id IS NOT NULL
      AND (
        lower(btrim(COALESCE(NEW.perfil, ''))) IN ('admin', 'administrador', 'gestor')
        OR EXISTS (
          SELECT 1
          FROM public.perfis membership
          WHERE membership.empresa_id = NEW.empresa_id
            AND membership.papel = 'admin'
            AND membership.ativo = true
            AND (
              membership.id = NEW.perfil_id
              OR membership.user_id = NEW.auth_user_id
            )
        )
      );
  END IF;

  IF v_target_is_admin
     AND OLD.status = 'Ativo'
     AND OLD.auth_user_id IS NOT NULL
     AND NOT v_target_remains_active_admin
     AND NOT v_has_other_unrestricted_admin THEN
    RAISE EXCEPTION 'A empresa deve manter ao menos um administrador configurado, ativo e sem janela de acesso.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE'
     AND v_target_remains_active_admin
     AND lower(COALESCE(NEW.access_config ->> 'enabled', 'false')) = 'true'
     AND NOT v_has_other_unrestricted_admin THEN
    RAISE EXCEPTION 'O único administrador ativo não pode ter janela de acesso restrita.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.proteger_administrador_configurado()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS proteger_administrador_configurado_trigger
  ON public.configuracoes_usuarios;
CREATE TRIGGER proteger_administrador_configurado_trigger
  BEFORE UPDATE OR DELETE ON public.configuracoes_usuarios
  FOR EACH ROW EXECUTE FUNCTION public.proteger_administrador_configurado();

DROP POLICY IF EXISTS documentos_solicitacoes_select
  ON public.documentos_solicitacoes;
CREATE POLICY documentos_solicitacoes_select
  ON public.documentos_solicitacoes
  FOR SELECT TO authenticated
  USING (
    empresa_id = (SELECT public.current_empresa_id())
    AND public.current_user_can_access_client_row(empresa_id, cliente_id)
    AND (
      public.current_user_has_permission(empresa_id, 'documentos:view')
      OR public.current_user_has_permission(empresa_id, 'documentos:manage')
      OR (
        criado_por = (SELECT auth.uid())
        AND public.current_user_has_permission(empresa_id, 'documentos:create')
      )
    )
  );

DROP POLICY IF EXISTS documentos_solicitacoes_update
  ON public.documentos_solicitacoes;
CREATE POLICY documentos_solicitacoes_update
  ON public.documentos_solicitacoes
  FOR UPDATE TO authenticated
  USING (
    empresa_id = (SELECT public.current_empresa_id())
    AND public.current_user_can_access_client_row(empresa_id, cliente_id)
    AND (
      public.current_user_has_permission(empresa_id, 'documentos:manage')
      OR (
        criado_por = (SELECT auth.uid())
        AND public.current_user_has_permission(empresa_id, 'documentos:create')
      )
    )
  )
  WITH CHECK (
    empresa_id = (SELECT public.current_empresa_id())
    AND public.current_user_can_access_client_row(empresa_id, cliente_id)
    AND (
      public.current_user_has_permission(empresa_id, 'documentos:manage')
      OR (
        criado_por = (SELECT auth.uid())
        AND public.current_user_has_permission(empresa_id, 'documentos:create')
      )
    )
  );

COMMENT ON POLICY documentos_solicitacoes_select ON public.documentos_solicitacoes IS
  'View/manage leem o escopo permitido; create le apenas as linhas do proprio autor, inclusive no RETURNING.';

COMMIT;
