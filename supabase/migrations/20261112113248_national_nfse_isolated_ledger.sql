-- Staging only. No public/client write access and production is deliberately blocked.
BEGIN;
CREATE TABLE app_private.national_nfse_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  fiscal_config_id uuid NOT NULL REFERENCES public.configuracoes_integracao_fiscal(id),
  draft_id uuid NOT NULL,
  ambiente text NOT NULL CHECK (ambiente = 'homologacao'),
  issuer_cnpj text NOT NULL CHECK (issuer_cnpj ~ '^[0-9]{14}$'),
  dps_id text NOT NULL CHECK (dps_id ~ '^DPS[0-9]{42}$'),
  snapshot_hash text NOT NULL CHECK (snapshot_hash ~ '^[a-f0-9]{64}$'),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  signed_dps_xml text NOT NULL CHECK (octet_length(signed_dps_xml) BETWEEN 100 AND 2097152),
  dispatched boolean NOT NULL DEFAULT false,
  outcome jsonb,
  authorized_xml text CHECK (octet_length(authorized_xml) BETWEEN 100 AND 4194304),
  nfse_access_key text CHECK (nfse_access_key ~ '^[0-9]{50}$'),
  nfse_number text CHECK (nfse_number ~ '^[0-9]{1,15}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, fiscal_config_id, ambiente, draft_id),
  UNIQUE (empresa_id, issuer_cnpj, ambiente, dps_id)
);
ALTER TABLE app_private.national_nfse_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.national_nfse_ledger FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION app_private.assert_national_nfse_scope(p_user_id uuid, p_intent jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t uuid := public.resolve_empresa_id_for_user(p_user_id); f public.configuracoes_integracao_fiscal;
BEGIN
  IF t IS NULL OR t IS DISTINCT FROM (p_intent->>'tenantId')::uuid THEN RAISE EXCEPTION 'NATIONAL_TENANT_DENIED'; END IF;
  IF p_intent->>'environment' IS DISTINCT FROM 'homologacao' THEN RAISE EXCEPTION 'NATIONAL_PRODUCTION_NOT_ENABLED'; END IF;
  SELECT * INTO f FROM public.configuracoes_integracao_fiscal WHERE id=(p_intent->>'companyId')::uuid AND empresa_id=t;
  IF NOT FOUND THEN RAISE EXCEPTION 'NATIONAL_COMPANY_DENIED'; END IF;
  -- The configuration id identifies the exact client/office issuer within the tenant.
  IF f.certificado_metadata->>'certificadoCNPJ' IS DISTINCT FROM p_intent->>'issuerCnpj' THEN
    RAISE EXCEPTION 'NATIONAL_ISSUER_MISMATCH';
  END IF;
  RETURN t;
END;
$$;
CREATE FUNCTION app_private.national_nfse_record(p app_private.national_nfse_ledger)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
 SELECT jsonb_build_object('intent', jsonb_build_object('tenantId',p.empresa_id,'companyId',p.fiscal_config_id,
 'draftId',p.draft_id,'environment',p.ambiente,'issuerCnpj',p.issuer_cnpj,'dpsId',p.dps_id,'snapshotHash',p.snapshot_hash),
 'dispatched',p.dispatched,'outcome',p.outcome);
$$;
CREATE FUNCTION public.national_nfse_reserve_edge(p_user_id uuid,p_intent jsonb,p_snapshot jsonb,p_signed_xml text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t uuid; r app_private.national_nfse_ledger; h text;
BEGIN
 t:=app_private.assert_national_nfse_scope(p_user_id,p_intent);
 h:=encode(sha256(convert_to(p_snapshot::text,'UTF8')),'hex');
 IF h IS DISTINCT FROM p_intent->>'snapshotHash' THEN RAISE EXCEPTION 'NATIONAL_SNAPSHOT_HASH_MISMATCH'; END IF;
 INSERT INTO app_private.national_nfse_ledger(empresa_id,fiscal_config_id,draft_id,ambiente,issuer_cnpj,dps_id,snapshot_hash,snapshot,signed_dps_xml)
 VALUES(t,(p_intent->>'companyId')::uuid,(p_intent->>'draftId')::uuid,'homologacao',p_intent->>'issuerCnpj',p_intent->>'dpsId',h,p_snapshot,p_signed_xml)
 ON CONFLICT (empresa_id,fiscal_config_id,ambiente,draft_id) DO NOTHING;
 SELECT * INTO r FROM app_private.national_nfse_ledger WHERE empresa_id=t AND fiscal_config_id=(p_intent->>'companyId')::uuid
  AND ambiente='homologacao' AND draft_id=(p_intent->>'draftId')::uuid FOR UPDATE;
 IF r.snapshot_hash IS DISTINCT FROM h OR r.dps_id IS DISTINCT FROM p_intent->>'dpsId' OR
    r.issuer_cnpj IS DISTINCT FROM p_intent->>'issuerCnpj' OR r.signed_dps_xml IS DISTINCT FROM p_signed_xml THEN
   RAISE EXCEPTION 'NATIONAL_IDENTITY_CONFLICT';
 END IF;
 RETURN app_private.national_nfse_record(r);
END;
$$;
CREATE FUNCTION public.national_nfse_claim_edge(p_user_id uuid,p_intent jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t uuid; count_updated integer;
BEGIN
 t:=app_private.assert_national_nfse_scope(p_user_id,p_intent);
 UPDATE app_private.national_nfse_ledger SET dispatched=true,updated_at=now()
 WHERE empresa_id=t AND fiscal_config_id=(p_intent->>'companyId')::uuid AND draft_id=(p_intent->>'draftId')::uuid
 AND ambiente='homologacao' AND dps_id=p_intent->>'dpsId' AND issuer_cnpj=p_intent->>'issuerCnpj'
 AND snapshot_hash=p_intent->>'snapshotHash' AND NOT dispatched AND outcome IS NULL;
 GET DIAGNOSTICS count_updated=ROW_COUNT;
 RETURN count_updated=1;
END;
$$;
CREATE FUNCTION public.national_nfse_settle_edge(p_user_id uuid,p_intent jsonb,p_outcome jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t uuid; r app_private.national_nfse_ledger;
BEGIN
 t:=app_private.assert_national_nfse_scope(p_user_id,p_intent);
 IF p_outcome->>'state' NOT IN ('AUTHORIZED','REJECTED','AWAITING_CONFIRMATION') OR p_outcome->>'state' IS NULL THEN
   RAISE EXCEPTION 'NATIONAL_INVALID_OUTCOME';
 END IF;
 IF p_outcome->>'state'='AUTHORIZED' AND coalesce(p_outcome->>'accessKey','')!~'^[0-9]{50}$' THEN RAISE EXCEPTION 'NATIONAL_INVALID_ACCESS_KEY'; END IF;
 SELECT * INTO r FROM app_private.national_nfse_ledger WHERE empresa_id=t AND fiscal_config_id=(p_intent->>'companyId')::uuid
 AND draft_id=(p_intent->>'draftId')::uuid AND ambiente='homologacao' AND dps_id=p_intent->>'dpsId'
 AND issuer_cnpj=p_intent->>'issuerCnpj' AND snapshot_hash=p_intent->>'snapshotHash' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NATIONAL_IDENTITY_CONFLICT'; END IF;
 IF p_outcome->>'state'='AUTHORIZED' AND (r.authorized_xml IS NULL OR r.nfse_access_key IS DISTINCT FROM p_outcome->>'accessKey') THEN RAISE EXCEPTION 'NATIONAL_ARCHIVE_REQUIRED'; END IF;
 IF r.outcome->>'state' IN ('AUTHORIZED','REJECTED') AND r.outcome IS DISTINCT FROM p_outcome THEN
   RAISE EXCEPTION 'NATIONAL_FINAL_OUTCOME_IMMUTABLE';
 END IF;
 UPDATE app_private.national_nfse_ledger SET outcome=p_outcome,updated_at=now() WHERE id=r.id;
END;
$$;
REVOKE ALL ON FUNCTION app_private.assert_national_nfse_scope(uuid,jsonb),app_private.national_nfse_record(app_private.national_nfse_ledger) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.national_nfse_reserve_edge(uuid,jsonb,jsonb,text),public.national_nfse_claim_edge(uuid,jsonb),public.national_nfse_settle_edge(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.national_nfse_reserve_edge(uuid,jsonb,jsonb,text),public.national_nfse_claim_edge(uuid,jsonb),public.national_nfse_settle_edge(uuid,jsonb,jsonb) TO service_role;
CREATE FUNCTION public.national_nfse_archive_edge(p_user_id uuid,p_intent jsonb,p_document jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t uuid; r app_private.national_nfse_ledger;
BEGIN
 t:=app_private.assert_national_nfse_scope(p_user_id,p_intent);
 IF coalesce(p_document->>'accessKey','')!~'^[0-9]{50}$' OR coalesce(p_document->>'number','')!~'^[0-9]{1,15}$'
 OR octet_length(coalesce(p_document->>'authorizedXml','')) NOT BETWEEN 100 AND 4194304
 THEN RAISE EXCEPTION 'NATIONAL_INVALID_ARCHIVE'; END IF;
 SELECT * INTO r FROM app_private.national_nfse_ledger WHERE empresa_id=t AND fiscal_config_id=(p_intent->>'companyId')::uuid
 AND draft_id=(p_intent->>'draftId')::uuid AND ambiente='homologacao' AND dps_id=p_intent->>'dpsId'
 AND issuer_cnpj=p_intent->>'issuerCnpj' AND snapshot_hash=p_intent->>'snapshotHash' FOR UPDATE;
 IF NOT FOUND OR r.signed_dps_xml IS DISTINCT FROM p_document->>'signedDpsXml' THEN RAISE EXCEPTION 'NATIONAL_IDENTITY_CONFLICT'; END IF;
 IF r.outcome->>'state'='REJECTED' THEN RAISE EXCEPTION 'NATIONAL_FINAL_OUTCOME_IMMUTABLE'; END IF;
 IF r.authorized_xml IS NOT NULL AND (r.authorized_xml IS DISTINCT FROM p_document->>'authorizedXml'
 OR r.nfse_access_key IS DISTINCT FROM p_document->>'accessKey' OR r.nfse_number IS DISTINCT FROM p_document->>'number')
 THEN RAISE EXCEPTION 'NATIONAL_ARCHIVE_IMMUTABLE'; END IF;
 UPDATE app_private.national_nfse_ledger SET authorized_xml=p_document->>'authorizedXml',
 nfse_access_key=p_document->>'accessKey',nfse_number=p_document->>'number',updated_at=now() WHERE id=r.id;
END;
$$;
REVOKE ALL ON FUNCTION public.national_nfse_archive_edge(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.national_nfse_archive_edge(uuid,jsonb,jsonb) TO service_role;
CREATE FUNCTION public.national_nfse_readiness_edge(p_user_id uuid,p_fiscal_config_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE t uuid:=public.resolve_empresa_id_for_user(p_user_id); f public.configuracoes_integracao_fiscal;
BEGIN
 SELECT * INTO f FROM public.configuracoes_integracao_fiscal WHERE id=p_fiscal_config_id AND empresa_id=t;
 IF t IS NULL OR NOT FOUND THEN RAISE EXCEPTION 'NATIONAL_COMPANY_DENIED'; END IF;
 RETURN jsonb_build_object('companyId',f.id,'tenantId',t,'certificateConfigured',
   f.certificado_arquivo_secret_id IS NOT NULL AND f.certificado_senha_secret_id IS NOT NULL,
   'certificateValidUntil',f.certificado_metadata->>'certificadoValidade',
   'provider','NATIONAL','liveReady',false,'productionEnabled',false,
   'blockers',jsonb_build_array('NATIONAL_TRANSPORT_NOT_ENABLED','NATIONAL_SCHEMA_SIGNATURE_INTEGRATION_PENDING'));
END;
$$;
REVOKE ALL ON FUNCTION public.national_nfse_readiness_edge(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.national_nfse_readiness_edge(uuid,uuid) TO service_role;
COMMIT;
