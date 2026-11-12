-- Read-only lookup of an existing national review. Never allocate a DPS or transmit.
BEGIN;
CREATE FUNCTION public.national_nfse_get_charge_review_edge(p_user_id uuid,p_fiscal_config_id uuid,p_charge_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ctx jsonb; t uuid; r app_private.national_nfse_reviewed_sources; prepared boolean; stale boolean;
BEGIN
 ctx:=public.national_nfse_review_context_edge(p_user_id,p_fiscal_config_id);
 PERFORM public.national_nfse_authorize_edge(p_user_id,ctx);
 t:=(ctx->>'tenantId')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.financeiro_cobrancas WHERE id=p_charge_id AND empresa_id=t AND status IS DISTINCT FROM 'Cancelado')
 THEN RAISE EXCEPTION 'NATIONAL_CHARGE_UNAVAILABLE'; END IF;
 -- Do not expose a review belonging to another issuer even inside the same tenant.
 SELECT * INTO r FROM app_private.national_nfse_reviewed_sources WHERE empresa_id=t AND cobranca_id=p_charge_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('review',NULL); END IF;
 IF r.fiscal_config_id IS DISTINCT FROM p_fiscal_config_id THEN RAISE EXCEPTION 'NATIONAL_CHARGE_OTHER_ISSUER'; END IF;
 prepared:=EXISTS(SELECT 1 FROM app_private.national_nfse_preparations WHERE empresa_id=t
 AND fiscal_config_id=r.fiscal_config_id AND draft_id=r.draft_id);
 stale:=r.invalidated_at IS NOT NULL OR r.source_revision IS DISTINCT FROM app_private.national_charge_revision(p_charge_id,t)
 OR r.config_revision IS DISTINCT FROM app_private.national_config_revision(r.fiscal_config_id,t);
 RETURN jsonb_build_object('review',jsonb_build_object('draftId',r.draft_id,'fields',r.snapshot,
 'state',CASE WHEN prepared THEN 'PREPARED_LOCKED' WHEN stale THEN 'REVIEW_REQUIRED' ELSE 'REVIEWED_ONLY' END,
 'editable',NOT prepared,'reviewedAt',r.reviewed_at));
END;
$$;
REVOKE ALL ON FUNCTION public.national_nfse_get_charge_review_edge(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.national_nfse_get_charge_review_edge(uuid,uuid,uuid) TO service_role;
COMMIT;
