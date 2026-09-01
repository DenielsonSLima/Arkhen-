-- Leitura continua disponível aos membros internos que precisam preencher o
-- cadastro de parceiros; alterações exigem parametrizacao:manage no banco.

CREATE OR REPLACE FUNCTION public.parametrizacao_catalogo_internal_member(
  p_empresa_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_client_scoped boolean := false;
  v_internal_permission boolean := false;
BEGIN
  IF auth.uid() IS NULL
     OR p_empresa_id IS NULL
     OR NOT public.is_empresa_member(p_empresa_id) THEN
    RETURN false;
  END IF;

  v_internal_permission := COALESCE(
    public.current_user_has_permission(p_empresa_id, 'parametrizacao:view')
    OR public.current_user_has_permission(p_empresa_id, 'parametrizacao:manage')
    OR public.current_user_has_permission(p_empresa_id, 'clientes:view')
    OR public.current_user_has_permission(p_empresa_id, 'clientes:create')
    OR public.current_user_has_permission(p_empresa_id, 'clientes:update'),
    false
  );
  IF NOT v_internal_permission THEN
    RETURN false;
  END IF;

  IF pg_catalog.to_regprocedure('public.current_user_is_client_scoped(uuid)') IS NOT NULL THEN
    EXECUTE 'SELECT public.current_user_is_client_scoped($1)'
      INTO v_client_scoped
      USING p_empresa_id;
  END IF;
  RETURN NOT COALESCE(v_client_scoped, true);
END;
$$;

REVOKE ALL ON FUNCTION public.parametrizacao_catalogo_internal_member(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.parametrizacao_catalogo_internal_member(uuid)
  TO authenticated;

DROP POLICY IF EXISTS isolamento_cliente_interno
  ON public.parametrizacao_catalogos;
DROP POLICY IF EXISTS parametrizacao_catalogos_empresa_policy
  ON public.parametrizacao_catalogos;
DROP POLICY IF EXISTS tenant_membership_guard
  ON public.parametrizacao_catalogos;
DROP POLICY IF EXISTS parametrizacao_catalogos_select_internal
  ON public.parametrizacao_catalogos;
DROP POLICY IF EXISTS parametrizacao_catalogos_insert_manage
  ON public.parametrizacao_catalogos;
DROP POLICY IF EXISTS parametrizacao_catalogos_update_manage
  ON public.parametrizacao_catalogos;
DROP POLICY IF EXISTS parametrizacao_catalogos_delete_manage
  ON public.parametrizacao_catalogos;

CREATE POLICY parametrizacao_catalogos_select_internal
  ON public.parametrizacao_catalogos
  FOR SELECT TO authenticated
  USING (
    public.parametrizacao_catalogo_internal_member(empresa_id)
  );

CREATE POLICY parametrizacao_catalogos_insert_manage
  ON public.parametrizacao_catalogos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.parametrizacao_catalogo_internal_member(empresa_id)
    AND public.current_user_has_permission(empresa_id, 'parametrizacao:manage')
  );

CREATE POLICY parametrizacao_catalogos_update_manage
  ON public.parametrizacao_catalogos
  FOR UPDATE TO authenticated
  USING (
    public.parametrizacao_catalogo_internal_member(empresa_id)
    AND public.current_user_has_permission(empresa_id, 'parametrizacao:manage')
  )
  WITH CHECK (
    public.parametrizacao_catalogo_internal_member(empresa_id)
    AND public.current_user_has_permission(empresa_id, 'parametrizacao:manage')
  );

CREATE POLICY parametrizacao_catalogos_delete_manage
  ON public.parametrizacao_catalogos
  FOR DELETE TO authenticated
  USING (
    public.parametrizacao_catalogo_internal_member(empresa_id)
    AND public.current_user_has_permission(empresa_id, 'parametrizacao:manage')
  );

REVOKE ALL ON TABLE public.parametrizacao_catalogos FROM anon;
REVOKE ALL ON TABLE public.parametrizacao_catalogos FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.parametrizacao_catalogos TO authenticated;
