-- Offline staging: no endpoint consumes these RPCs until the live readiness gates pass.
BEGIN;
CREATE TABLE app_private.national_nfse_sequences (
 empresa_id uuid NOT NULL REFERENCES public.empresas(id), issuer_cnpj text NOT NULL,
 ambiente text NOT NULL CHECK(ambiente='homologacao'), serie text NOT NULL CHECK(serie='80000'),
 last_number bigint NOT NULL CHECK(last_number BETWEEN 1 AND 999999999999999),
 PRIMARY KEY(empresa_id,issuer_cnpj,ambiente,serie)
);
CREATE TABLE app_private.national_nfse_preparations (
 empresa_id uuid NOT NULL REFERENCES public.empresas(id), fiscal_config_id uuid NOT NULL REFERENCES public.configuracoes_integracao_fiscal(id),
 draft_id uuid NOT NULL, snapshot jsonb NOT NULL, snapshot_hash text NOT NULL, dps_id text NOT NULL,
 source_snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(empresa_id,fiscal_config_id,draft_id), UNIQUE(empresa_id,dps_id)
);
ALTER TABLE app_private.national_nfse_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.national_nfse_preparations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.national_nfse_sequences,app_private.national_nfse_preparations FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.national_nfse_prepare_edge(p_user_id uuid,p_intent jsonb,p_snapshot jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid; n bigint; r app_private.national_nfse_preparations; s jsonb; d text; h text;
BEGIN
 t:=app_private.assert_national_nfse_scope(p_user_id,p_intent);
 IF jsonb_typeof(p_snapshot) IS DISTINCT FROM 'object' OR
 p_snapshot->>'environment' IS DISTINCT FROM 'HOMOLOGACAO' OR
 p_snapshot#>>'{issuer,taxId,type}' IS DISTINCT FROM 'CNPJ' OR
 p_snapshot#>>'{issuer,taxId,value}' IS DISTINCT FROM p_intent->>'issuerCnpj' OR
 coalesce(p_snapshot->>'issuerMunicipalityCode','') !~ '^[0-9]{7}$' OR
 p_snapshot ?| ARRAY['number','series','issuedAt'] THEN RAISE EXCEPTION 'NATIONAL_INVALID_PREPARATION'; END IF;
 -- Serialize retries of the same draft before allocating a number. No sequence reuse.
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text || (p_intent->>'companyId') || (p_intent->>'draftId'),0));
 SELECT * INTO r FROM app_private.national_nfse_preparations WHERE empresa_id=t
 AND fiscal_config_id=(p_intent->>'companyId')::uuid AND draft_id=(p_intent->>'draftId')::uuid;
 IF FOUND THEN
  IF r.source_snapshot IS DISTINCT FROM p_snapshot THEN RAISE EXCEPTION 'NATIONAL_PREPARATION_IMMUTABLE'; END IF;
 ELSE
  INSERT INTO app_private.national_nfse_sequences VALUES(t,p_intent->>'issuerCnpj','homologacao','80000',1)
  ON CONFLICT(empresa_id,issuer_cnpj,ambiente,serie) DO UPDATE SET last_number=app_private.national_nfse_sequences.last_number+1
  RETURNING last_number INTO n;
  s:=p_snapshot || jsonb_build_object('series','80000','number',n::text,'issuedAt',to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS') || '+00:00');
  d:='DPS' || (s->>'issuerMunicipalityCode') || '2' || (p_intent->>'issuerCnpj') || '80000' || lpad(n::text,15,'0');
  h:=encode(sha256(convert_to(s::text,'UTF8')),'hex');
  INSERT INTO app_private.national_nfse_preparations VALUES(t,(p_intent->>'companyId')::uuid,(p_intent->>'draftId')::uuid,s,h,d,p_snapshot,now()) RETURNING * INTO r;
 END IF;
 RETURN jsonb_build_object('snapshot',r.snapshot,'intent',p_intent || jsonb_build_object('dpsId',r.dps_id,'snapshotHash',r.snapshot_hash));
END;
$$;
CREATE FUNCTION public.national_nfse_credentials_edge(p_user_id uuid,p_intent jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid; f public.configuracoes_integracao_fiscal; a text; p text;
BEGIN
 t:=app_private.assert_national_nfse_scope(p_user_id,p_intent);
 -- Only already prepared, immutable requests may obtain secrets. Never expose this RPC to client roles.
 IF NOT EXISTS(SELECT 1 FROM app_private.national_nfse_preparations WHERE empresa_id=t
 AND fiscal_config_id=(p_intent->>'companyId')::uuid AND draft_id=(p_intent->>'draftId')::uuid
 AND dps_id=p_intent->>'dpsId' AND snapshot_hash=p_intent->>'snapshotHash') THEN RAISE EXCEPTION 'NATIONAL_PREPARATION_REQUIRED'; END IF;
 SELECT * INTO STRICT f FROM public.configuracoes_integracao_fiscal WHERE id=(p_intent->>'companyId')::uuid AND empresa_id=t;
 SELECT decrypted_secret INTO a FROM vault.decrypted_secrets WHERE id=f.certificado_arquivo_secret_id;
 SELECT decrypted_secret INTO p FROM vault.decrypted_secrets WHERE id=f.certificado_senha_secret_id;
 IF a IS NULL OR a='' OR p IS NULL THEN RAISE EXCEPTION 'NATIONAL_CERTIFICATE_MISSING'; END IF;
 RETURN jsonb_build_object('pfxBase64',a,'password',p);
END;
$$;
REVOKE ALL ON FUNCTION public.national_nfse_prepare_edge(uuid,jsonb,jsonb),public.national_nfse_credentials_edge(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.national_nfse_prepare_edge(uuid,jsonb,jsonb),public.national_nfse_credentials_edge(uuid,jsonb) TO service_role;
COMMIT;
