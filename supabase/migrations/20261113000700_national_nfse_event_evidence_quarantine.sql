-- Durable raw evidence is not verified acceptance and never changes a note's fiscal state.
BEGIN;
CREATE TABLE app_private.national_nfse_event_evidence(
 ledger_id uuid NOT NULL REFERENCES app_private.national_nfse_ledger(id),
 content_sha256 text NOT NULL,raw_xml text NOT NULL CHECK(octet_length(raw_xml) BETWEEN 1 AND 4194304),
 verification_state text NOT NULL DEFAULT 'UNVERIFIED' CHECK(verification_state='UNVERIFIED'),
 received_by uuid NOT NULL,received_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(ledger_id,content_sha256)
);
ALTER TABLE app_private.national_nfse_event_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.national_nfse_event_evidence FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.national_nfse_quarantine_events_edge(p_user_id uuid,p_intent jsonb,p_access_key text,p_documents jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l app_private.national_nfse_ledger;doc jsonb;raw text;h text;existing text;
BEGIN
 PERFORM public.national_nfse_authorize_edge(p_user_id,p_intent);
 IF jsonb_typeof(p_documents) IS DISTINCT FROM 'array' OR jsonb_array_length(p_documents)>100 OR octet_length(p_documents::text)>16777216 THEN RAISE EXCEPTION 'NATIONAL_INVALID_EVIDENCE_BATCH'; END IF;
 SELECT * INTO l FROM app_private.national_nfse_ledger WHERE empresa_id=(p_intent->>'tenantId')::uuid
 AND fiscal_config_id=(p_intent->>'companyId')::uuid AND draft_id=(p_intent->>'draftId')::uuid
 AND dps_id=p_intent->>'dpsId' AND snapshot_hash=p_intent->>'snapshotHash'
 AND nfse_access_key=p_access_key AND outcome->>'state'='AUTHORIZED' AND authorized_xml IS NOT NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NATIONAL_AUTHORIZED_DOCUMENT_REQUIRED'; END IF;
 FOR doc IN SELECT value FROM jsonb_array_elements(p_documents) LOOP
  IF jsonb_typeof(doc) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'NATIONAL_INVALID_EVIDENCE'; END IF;
  raw:=doc#>>'{}';IF octet_length(raw) NOT BETWEEN 1 AND 4194304 THEN RAISE EXCEPTION 'NATIONAL_INVALID_EVIDENCE'; END IF;
  h:=encode(sha256(convert_to(raw,'UTF8')),'hex');
  INSERT INTO app_private.national_nfse_event_evidence(ledger_id,content_sha256,raw_xml,received_by)
  VALUES(l.id,h,raw,p_user_id) ON CONFLICT(ledger_id,content_sha256) DO NOTHING;
  SELECT raw_xml INTO existing FROM app_private.national_nfse_event_evidence WHERE ledger_id=l.id AND content_sha256=h;
  IF existing IS DISTINCT FROM raw THEN RAISE EXCEPTION 'NATIONAL_EVIDENCE_CONTENT_CONFLICT'; END IF;
 END LOOP;
 RETURN jsonb_build_object('state','UNVERIFIED','fiscalStateChanged',false,'receivedCount',jsonb_array_length(p_documents));
END;
$$;
REVOKE ALL ON FUNCTION public.national_nfse_quarantine_events_edge(uuid,jsonb,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.national_nfse_quarantine_events_edge(uuid,jsonb,text,jsonb) TO service_role;
COMMIT;
