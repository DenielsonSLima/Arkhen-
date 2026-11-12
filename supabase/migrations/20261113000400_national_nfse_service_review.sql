-- Review-only standalone services: stable declared source identity, no artificial charge.
BEGIN;
ALTER TABLE app_private.national_nfse_reviewed_sources ADD COLUMN service_reference text;
ALTER TABLE app_private.national_nfse_reviewed_sources ADD CONSTRAINT national_service_source_exclusive CHECK(service_reference IS NULL OR cobranca_id IS NULL);
CREATE UNIQUE INDEX national_service_reference ON app_private.national_nfse_reviewed_sources(empresa_id,fiscal_config_id,service_reference) WHERE service_reference IS NOT NULL;
CREATE FUNCTION public.national_nfse_review_service_edge(p_user_id uuid,p_intent jsonb,p_service_reference text,p_snapshot jsonb,p_expected_reviewed_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid; f uuid; d uuid; r app_private.national_nfse_reviewed_sources;
BEGIN
 PERFORM public.national_nfse_authorize_edge(p_user_id,p_intent);
 t:=(p_intent->>'tenantId')::uuid;f:=(p_intent->>'companyId')::uuid;d:=(p_intent->>'draftId')::uuid;
 IF p_service_reference IS NULL OR p_service_reference !~ '^[A-Z0-9][A-Z0-9._/-]{2,79}$' THEN RAISE EXCEPTION 'NATIONAL_SERVICE_REFERENCE_REQUIRED'; END IF;
 -- Shared namespace lock serializes reference/draft races without relying on browser IDs.
 PERFORM pg_advisory_xact_lock(hashtextextended('national-service:'||t::text||f::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||f::text||d::text,0));
 SELECT * INTO r FROM app_private.national_nfse_reviewed_sources WHERE empresa_id=t AND fiscal_config_id=f
 AND (draft_id=d OR service_reference=p_service_reference) FOR UPDATE;
 IF FOUND THEN
  IF r.draft_id IS DISTINCT FROM d OR r.service_reference IS DISTINCT FROM p_service_reference OR r.cobranca_id IS NOT NULL THEN RAISE EXCEPTION 'NATIONAL_SERVICE_IDENTITY_CONFLICT'; END IF;
  IF r.reviewed_at IS DISTINCT FROM p_expected_reviewed_at THEN RAISE EXCEPTION 'NATIONAL_REVIEW_VERSION_CONFLICT'; END IF;
 ELSIF p_expected_reviewed_at IS NOT NULL THEN RAISE EXCEPTION 'NATIONAL_REVIEW_VERSION_CONFLICT'; END IF;
 IF EXISTS(SELECT 1 FROM app_private.national_nfse_preparations WHERE empresa_id=t AND fiscal_config_id=f AND draft_id=d) THEN RAISE EXCEPTION 'NATIONAL_PREPARATION_IMMUTABLE'; END IF;
 IF jsonb_typeof(p_snapshot) IS DISTINCT FROM 'object' OR p_snapshot->>'environment' IS DISTINCT FROM 'HOMOLOGACAO'
 OR p_snapshot#>>'{issuer,taxId,type}' IS DISTINCT FROM 'CNPJ' OR p_snapshot#>>'{issuer,taxId,value}' IS DISTINCT FROM p_intent->>'issuerCnpj'
 OR p_snapshot ?| ARRAY['number','series','issuedAt'] THEN RAISE EXCEPTION 'NATIONAL_SERVICE_SNAPSHOT_MISMATCH'; END IF;
 INSERT INTO app_private.national_nfse_reviewed_sources(empresa_id,fiscal_config_id,draft_id,source_revision,snapshot,reviewed_by,reviewed_at,service_reference)
 VALUES(t,f,d,encode(sha256(convert_to(p_snapshot::text,'UTF8')),'hex'),p_snapshot,p_user_id,clock_timestamp(),p_service_reference)
 ON CONFLICT(empresa_id,fiscal_config_id,draft_id) DO UPDATE SET snapshot=excluded.snapshot,source_revision=excluded.source_revision,
 reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,invalidated_at=NULL RETURNING * INTO r;
 RETURN jsonb_build_object('state','REVIEWED_ONLY','submitted',false,'draftId',r.draft_id,'reviewedAt',r.reviewed_at);
END;
$$;
CREATE FUNCTION public.national_nfse_get_service_review_edge(p_user_id uuid,p_fiscal_config_id uuid,p_service_reference text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ctx jsonb;r app_private.national_nfse_reviewed_sources;prepared boolean;stale boolean;
BEGIN
 ctx:=public.national_nfse_review_context_edge(p_user_id,p_fiscal_config_id);PERFORM public.national_nfse_authorize_edge(p_user_id,ctx);
 SELECT * INTO r FROM app_private.national_nfse_reviewed_sources WHERE empresa_id=(ctx->>'tenantId')::uuid AND fiscal_config_id=p_fiscal_config_id AND service_reference=p_service_reference;
 IF NOT FOUND THEN RETURN jsonb_build_object('review',NULL); END IF;
 prepared:=EXISTS(SELECT 1 FROM app_private.national_nfse_preparations WHERE empresa_id=r.empresa_id AND fiscal_config_id=r.fiscal_config_id AND draft_id=r.draft_id);
 stale:=r.invalidated_at IS NOT NULL OR r.config_revision IS DISTINCT FROM app_private.national_config_revision(r.fiscal_config_id,r.empresa_id);
 RETURN jsonb_build_object('review',jsonb_build_object('draftId',r.draft_id,'fields',r.snapshot,'reviewedAt',r.reviewed_at,'editable',NOT prepared,
 'state',CASE WHEN prepared THEN 'PREPARED_LOCKED' WHEN stale THEN 'REVIEW_REQUIRED' ELSE 'REVIEWED_ONLY' END));
END;
$$;
REVOKE ALL ON FUNCTION public.national_nfse_review_service_edge(uuid,jsonb,text,jsonb,timestamptz),public.national_nfse_get_service_review_edge(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.national_nfse_review_service_edge(uuid,jsonb,text,jsonb,timestamptz),public.national_nfse_get_service_review_edge(uuid,uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.national_nfse_list_reviews_edge(p_user_id uuid,p_fiscal_config_id uuid,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ctx jsonb; t uuid; row record; review jsonb; items jsonb:='[]'; more boolean:=false; n integer:=0;
BEGIN
 IF p_offset IS NULL OR p_offset<0 OR p_offset>10000 THEN RAISE EXCEPTION 'NATIONAL_INVALID_PAGE'; END IF;
 ctx:=public.national_nfse_review_context_edge(p_user_id,p_fiscal_config_id);
 PERFORM public.national_nfse_authorize_edge(p_user_id,ctx);t:=(ctx->>'tenantId')::uuid;
 FOR row IN SELECT r.cobranca_id,r.service_reference FROM app_private.national_nfse_reviewed_sources r
 LEFT JOIN public.financeiro_cobrancas c ON c.id=r.cobranca_id AND c.empresa_id=r.empresa_id
 WHERE r.empresa_id=t AND r.fiscal_config_id=p_fiscal_config_id AND (r.service_reference IS NOT NULL OR (c.id IS NOT NULL AND c.status IS DISTINCT FROM 'Cancelado'))
 ORDER BY r.reviewed_at DESC,r.draft_id LIMIT 26 OFFSET p_offset LOOP
  n:=n+1;IF n>25 THEN more:=true;EXIT;END IF;
  IF row.service_reference IS NOT NULL THEN review:=public.national_nfse_get_service_review_edge(p_user_id,p_fiscal_config_id,row.service_reference)->'review';
  ELSE review:=public.national_nfse_get_charge_review_edge(p_user_id,p_fiscal_config_id,row.cobranca_id)->'review';END IF;
  items:=items||jsonb_build_array(jsonb_build_object('chargeId',coalesce(row.cobranca_id::text,''),'serviceReference',coalesce(row.service_reference,''),'draftId',review->>'draftId',
   'recipientName',review#>>'{fields,recipient,name}','competence',review#>>'{fields,competence}',
   'amount',review#>>'{fields,values,serviceAmount}','state',review->>'state','reviewedAt',review->>'reviewedAt'));
 END LOOP;
 RETURN jsonb_build_object('items',items,'hasMore',more);
END;
$$;

-- Existing source/preparation/claim RPCs intentionally still reject no-charge reviews.
COMMIT;
