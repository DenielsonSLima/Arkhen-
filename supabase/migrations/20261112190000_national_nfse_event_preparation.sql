-- Durable offline cancellation preparation only. No submission or final note mutation.
BEGIN;
CREATE TABLE app_private.national_nfse_event_preparations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ledger_id uuid NOT NULL REFERENCES app_private.national_nfse_ledger(id),
 event_code text NOT NULL CHECK(event_code IN('101101','101103')),
 event_reference text NOT NULL, signed_xml text NOT NULL CHECK(octet_length(signed_xml) BETWEEN 100 AND 2097152),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(ledger_id,event_code), UNIQUE(event_reference)
);
ALTER TABLE app_private.national_nfse_event_preparations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.national_nfse_event_preparations FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.national_nfse_prepare_event_edge(p_user_id uuid,p_intent jsonb,p_event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid; l app_private.national_nfse_ledger; e app_private.national_nfse_event_preparations; reference text;
BEGIN
 t:=app_private.assert_national_nfse_scope(p_user_id,p_intent);
 SELECT * INTO l FROM app_private.national_nfse_ledger WHERE empresa_id=t AND fiscal_config_id=(p_intent->>'companyId')::uuid
 AND draft_id=(p_intent->>'draftId')::uuid AND dps_id=p_intent->>'dpsId' AND snapshot_hash=p_intent->>'snapshotHash';
 IF NOT FOUND OR l.outcome->>'state' IS DISTINCT FROM 'AUTHORIZED' OR l.authorized_xml IS NULL THEN RAISE EXCEPTION 'NATIONAL_AUTHORIZED_DOCUMENT_REQUIRED'; END IF;
 IF p_event->>'accessKey' IS DISTINCT FROM l.nfse_access_key OR coalesce(p_event->>'eventCode','') NOT IN('101101','101103') THEN RAISE EXCEPTION 'NATIONAL_EVENT_SCOPE_MISMATCH'; END IF;
 reference:='PRE' || l.nfse_access_key || (p_event->>'eventCode');
 IF p_event->>'eventReferenceId' IS DISTINCT FROM reference THEN RAISE EXCEPTION 'NATIONAL_EVENT_ID_MISMATCH'; END IF;
 INSERT INTO app_private.national_nfse_event_preparations(ledger_id,event_code,event_reference,signed_xml)
 VALUES(l.id,p_event->>'eventCode',reference,p_event->>'signedEventXml') ON CONFLICT(ledger_id,event_code) DO NOTHING;
 SELECT * INTO e FROM app_private.national_nfse_event_preparations WHERE ledger_id=l.id AND event_code=p_event->>'eventCode';
 IF e.signed_xml IS DISTINCT FROM p_event->>'signedEventXml' THEN RAISE EXCEPTION 'NATIONAL_EVENT_IMMUTABLE'; END IF;
 RETURN jsonb_build_object('id',e.id,'eventReferenceId',e.event_reference,'state','PREPARED_ONLY','submitted',false);
END;
$$;
REVOKE ALL ON FUNCTION public.national_nfse_prepare_event_edge(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.national_nfse_prepare_event_edge(uuid,jsonb,jsonb) TO service_role;
COMMIT;
