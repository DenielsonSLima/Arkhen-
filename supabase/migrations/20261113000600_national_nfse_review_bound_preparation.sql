-- Offline preparation may consume only the exact current server-owned review.
-- This does not enable emission/claim for standalone services.
BEGIN;
CREATE OR REPLACE FUNCTION public.national_nfse_reviewed_source_edge(p_user_id uuid,p_intent jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r app_private.national_nfse_reviewed_sources;revision text;
BEGIN
 PERFORM public.national_nfse_authorize_edge(p_user_id,p_intent);
 SELECT * INTO r FROM app_private.national_nfse_reviewed_sources WHERE empresa_id=(p_intent->>'tenantId')::uuid
 AND fiscal_config_id=(p_intent->>'companyId')::uuid AND draft_id=(p_intent->>'draftId')::uuid AND invalidated_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'NATIONAL_REVIEW_REQUIRED'; END IF;
 IF r.cobranca_id IS NOT NULL THEN revision:=app_private.national_charge_revision(r.cobranca_id,r.empresa_id);
 ELSIF r.service_reference IS NOT NULL THEN revision:=encode(sha256(convert_to(r.snapshot::text,'UTF8')),'hex');
 ELSE RAISE EXCEPTION 'NATIONAL_REVIEW_REQUIRED'; END IF;
 IF r.source_revision IS DISTINCT FROM revision OR r.config_revision IS NULL
 OR r.config_revision IS DISTINCT FROM app_private.national_config_revision(r.fiscal_config_id,r.empresa_id)
 THEN RAISE EXCEPTION 'NATIONAL_REVIEW_STALE'; END IF;
 RETURN jsonb_build_object('snapshot',r.snapshot,'sourceRevision',r.source_revision);
END;
$$;
ALTER FUNCTION public.national_nfse_prepare_edge(uuid,jsonb,jsonb) SET SCHEMA app_private;
REVOKE ALL ON FUNCTION app_private.national_nfse_prepare_edge(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.national_nfse_prepare_edge(p_user_id uuid,p_intent jsonb,p_snapshot jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid;f uuid;d uuid;r app_private.national_nfse_reviewed_sources;review jsonb;
BEGIN
 PERFORM public.national_nfse_authorize_edge(p_user_id,p_intent);t:=(p_intent->>'tenantId')::uuid;f:=(p_intent->>'companyId')::uuid;d:=(p_intent->>'draftId')::uuid;
 SELECT * INTO r FROM app_private.national_nfse_reviewed_sources WHERE empresa_id=t AND fiscal_config_id=f AND draft_id=d;
 IF NOT FOUND THEN RAISE EXCEPTION 'NATIONAL_REVIEW_REQUIRED'; END IF;
 -- Match the order of source writers; no payload-controlled source identifier.
 IF r.cobranca_id IS NOT NULL THEN
  PERFORM 1 FROM public.financeiro_cobrancas WHERE id=r.cobranca_id AND empresa_id=t AND status IS DISTINCT FROM 'Cancelado' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NATIONAL_CHARGE_UNAVAILABLE'; END IF;
 ELSIF r.service_reference IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('national-service:'||t::text||f::text,0));
 ELSE RAISE EXCEPTION 'NATIONAL_REVIEW_REQUIRED';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||f::text||d::text,0));
 PERFORM 1 FROM public.configuracoes_integracao_fiscal WHERE id=f AND empresa_id=t FOR UPDATE;
 IF r.cobranca_id IS NOT NULL THEN
  PERFORM 1 FROM public.clientes WHERE empresa_id=t AND id=(SELECT cliente_empresa_id FROM public.financeiro_cobrancas WHERE id=r.cobranca_id AND empresa_id=t) FOR UPDATE;
 END IF;
 SELECT * INTO r FROM app_private.national_nfse_reviewed_sources WHERE empresa_id=t AND fiscal_config_id=f AND draft_id=d FOR UPDATE;
 review:=public.national_nfse_reviewed_source_edge(p_user_id,p_intent);
 IF review->'snapshot' IS DISTINCT FROM p_snapshot THEN RAISE EXCEPTION 'NATIONAL_PREPARATION_REVIEW_MISMATCH'; END IF;
 RETURN app_private.national_nfse_prepare_edge(p_user_id,p_intent,p_snapshot);
END;
$$;
REVOKE ALL ON FUNCTION public.national_nfse_prepare_edge(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.national_nfse_prepare_edge(uuid,jsonb,jsonb) TO service_role;
COMMIT;
