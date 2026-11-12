-- Reuse existing manager/accountant authorization, no parallel national grants.
BEGIN;
CREATE OR REPLACE FUNCTION public.national_nfse_authorize_edge(p_user_id uuid,p_intent jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid;
BEGIN
 -- Current tenant resolver checks active user/membership/credential state.
 t:=app_private.assert_national_nfse_scope(p_user_id,p_intent);
 -- Existing banking manager resolver recognizes active admin/contador or gestor/administrador.
 -- Require same resolved tenant; never accept a broad role across another company.
 IF public.resolve_inter_manager_empresa_id(p_user_id) IS DISTINCT FROM t THEN
  RAISE EXCEPTION 'NATIONAL_FISCAL_PERMISSION_DENIED';
 END IF;
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.national_nfse_authorize_edge(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.national_nfse_authorize_edge(uuid,jsonb) TO service_role;
COMMIT;
