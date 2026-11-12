-- Fail-closed national fiscal permissions. No grants/production access are seeded.
BEGIN;
CREATE TABLE app_private.national_nfse_permissions (
 empresa_id uuid NOT NULL REFERENCES public.empresas(id), fiscal_config_id uuid NOT NULL REFERENCES public.configuracoes_integracao_fiscal(id),
 user_id uuid NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz,
 PRIMARY KEY(empresa_id,fiscal_config_id,user_id)
);
CREATE TABLE app_private.national_nfse_reviewed_sources (
 empresa_id uuid NOT NULL REFERENCES public.empresas(id), fiscal_config_id uuid NOT NULL REFERENCES public.configuracoes_integracao_fiscal(id),
 draft_id uuid NOT NULL, source_revision text NOT NULL, snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 reviewed_by uuid NOT NULL, reviewed_at timestamptz NOT NULL, invalidated_at timestamptz,
 PRIMARY KEY(empresa_id,fiscal_config_id,draft_id)
);
ALTER TABLE app_private.national_nfse_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.national_nfse_reviewed_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.national_nfse_permissions,app_private.national_nfse_reviewed_sources FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.national_nfse_authorize_edge(p_user_id uuid,p_intent jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid;
BEGIN
 t:=app_private.assert_national_nfse_scope(p_user_id,p_intent);
 IF NOT EXISTS(SELECT 1 FROM app_private.national_nfse_permissions WHERE empresa_id=t
 AND fiscal_config_id=(p_intent->>'companyId')::uuid AND user_id=p_user_id AND revoked_at IS NULL AND expires_at>now()) THEN
 RAISE EXCEPTION 'NATIONAL_FISCAL_PERMISSION_DENIED'; END IF;
 RETURN true;
END;
$$;
CREATE FUNCTION public.national_nfse_reviewed_source_edge(p_user_id uuid,p_intent jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r app_private.national_nfse_reviewed_sources;
BEGIN
 PERFORM public.national_nfse_authorize_edge(p_user_id,p_intent);
 SELECT * INTO r FROM app_private.national_nfse_reviewed_sources WHERE empresa_id=(p_intent->>'tenantId')::uuid
 AND fiscal_config_id=(p_intent->>'companyId')::uuid AND draft_id=(p_intent->>'draftId')::uuid AND invalidated_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'NATIONAL_REVIEW_REQUIRED'; END IF;
 RETURN jsonb_build_object('snapshot',r.snapshot,'sourceRevision',r.source_revision);
END;
$$;
REVOKE ALL ON FUNCTION public.national_nfse_authorize_edge(uuid,jsonb),public.national_nfse_reviewed_source_edge(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.national_nfse_authorize_edge(uuid,jsonb),public.national_nfse_reviewed_source_edge(uuid,jsonb) TO service_role;
COMMIT;
