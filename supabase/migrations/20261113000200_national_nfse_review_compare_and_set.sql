-- Prevent reopening/editing from overwriting another operator's newer fiscal review.
BEGIN;
ALTER FUNCTION public.national_nfse_review_charge_edge(uuid,jsonb,uuid,jsonb) SET SCHEMA app_private;
REVOKE ALL ON FUNCTION app_private.national_nfse_review_charge_edge(uuid,jsonb,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.national_nfse_review_charge_edge(p_user_id uuid,p_intent jsonb,p_charge_id uuid,p_snapshot jsonb,p_expected_reviewed_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid; r app_private.national_nfse_reviewed_sources; result jsonb;
BEGIN
 PERFORM public.national_nfse_authorize_edge(p_user_id,p_intent);t:=(p_intent->>'tenantId')::uuid;
 PERFORM 1 FROM public.financeiro_cobrancas WHERE id=p_charge_id AND empresa_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NATIONAL_CHARGE_UNAVAILABLE'; END IF;
 SELECT * INTO r FROM app_private.national_nfse_reviewed_sources WHERE empresa_id=t AND cobranca_id=p_charge_id;
 IF FOUND THEN
  IF r.fiscal_config_id IS DISTINCT FROM (p_intent->>'companyId')::uuid OR r.draft_id IS DISTINCT FROM (p_intent->>'draftId')::uuid
  THEN RAISE EXCEPTION 'NATIONAL_CHARGE_LINK_IMMUTABLE'; END IF;
  IF r.reviewed_at IS DISTINCT FROM p_expected_reviewed_at THEN RAISE EXCEPTION 'NATIONAL_REVIEW_VERSION_CONFLICT'; END IF;
 ELSIF p_expected_reviewed_at IS NOT NULL THEN RAISE EXCEPTION 'NATIONAL_REVIEW_VERSION_CONFLICT'; END IF;
 result:=app_private.national_nfse_review_charge_edge(p_user_id,p_intent,p_charge_id,p_snapshot);
 SELECT * INTO r FROM app_private.national_nfse_reviewed_sources WHERE empresa_id=t AND cobranca_id=p_charge_id;
 RETURN result||jsonb_build_object('draftId',r.draft_id,'reviewedAt',r.reviewed_at);
END;
$$;
REVOKE ALL ON FUNCTION public.national_nfse_review_charge_edge(uuid,jsonb,uuid,jsonb,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.national_nfse_review_charge_edge(uuid,jsonb,uuid,jsonb,timestamptz) TO service_role;
COMMIT;
