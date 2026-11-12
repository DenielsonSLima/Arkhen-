BEGIN;
ALTER TABLE app_private.national_nfse_reviewed_sources ADD COLUMN config_revision text;
CREATE FUNCTION app_private.national_config_revision(p_id uuid,p_tenant uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT encode(sha256(convert_to(to_jsonb(f)::text,'UTF8')),'hex') FROM public.configuracoes_integracao_fiscal f WHERE id=p_id AND empresa_id=p_tenant;
$$;
CREATE FUNCTION app_private.bind_national_review_configuration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 NEW.config_revision:=app_private.national_config_revision(NEW.fiscal_config_id,NEW.empresa_id);
 RETURN NEW;
END;
$$;
CREATE TRIGGER bind_national_review_configuration BEFORE INSERT OR UPDATE OF snapshot,source_revision ON app_private.national_nfse_reviewed_sources
 FOR EACH ROW EXECUTE FUNCTION app_private.bind_national_review_configuration();
CREATE OR REPLACE FUNCTION public.national_nfse_reviewed_source_edge(p_user_id uuid,p_intent jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r app_private.national_nfse_reviewed_sources;
BEGIN
 PERFORM public.national_nfse_authorize_edge(p_user_id,p_intent);
 SELECT * INTO r FROM app_private.national_nfse_reviewed_sources WHERE empresa_id=(p_intent->>'tenantId')::uuid
 AND fiscal_config_id=(p_intent->>'companyId')::uuid AND draft_id=(p_intent->>'draftId')::uuid AND invalidated_at IS NULL;
 IF NOT FOUND OR r.cobranca_id IS NULL THEN RAISE EXCEPTION 'NATIONAL_REVIEW_REQUIRED'; END IF;
 IF r.source_revision IS DISTINCT FROM app_private.national_charge_revision(r.cobranca_id,r.empresa_id)
 OR r.config_revision IS NULL OR r.config_revision IS DISTINCT FROM app_private.national_config_revision(r.fiscal_config_id,r.empresa_id)
 THEN RAISE EXCEPTION 'NATIONAL_REVIEW_STALE'; END IF;
 RETURN jsonb_build_object('snapshot',r.snapshot,'sourceRevision',r.source_revision);
END;
$$;
CREATE OR REPLACE FUNCTION public.national_nfse_claim_edge(p_user_id uuid,p_intent jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid; r app_private.national_nfse_reviewed_sources; cb public.financeiro_cobrancas;
 p app_private.national_nfse_preparations; changed integer;
BEGIN
 PERFORM public.national_nfse_authorize_edge(p_user_id,p_intent);t:=(p_intent->>'tenantId')::uuid;
 SELECT * INTO r FROM app_private.national_nfse_reviewed_sources WHERE empresa_id=t
 AND fiscal_config_id=(p_intent->>'companyId')::uuid AND draft_id=(p_intent->>'draftId')::uuid;
 IF NOT FOUND OR r.cobranca_id IS NULL THEN RAISE EXCEPTION 'NATIONAL_REVIEW_REQUIRED'; END IF;
 -- Lock the underlying records before the final compare-and-set; editors serialize here.
 SELECT * INTO cb FROM public.financeiro_cobrancas WHERE id=r.cobranca_id AND empresa_id=t FOR UPDATE;
 IF NOT FOUND OR cb.status='Cancelado' THEN RAISE EXCEPTION 'NATIONAL_CHARGE_UNAVAILABLE'; END IF;
 PERFORM 1 FROM public.configuracoes_integracao_fiscal WHERE id=r.fiscal_config_id AND empresa_id=t FOR UPDATE;
 PERFORM 1 FROM public.clientes WHERE id=cb.cliente_empresa_id AND empresa_id=t FOR UPDATE;
 SELECT * INTO r FROM app_private.national_nfse_reviewed_sources WHERE empresa_id=t
 AND fiscal_config_id=(p_intent->>'companyId')::uuid AND draft_id=(p_intent->>'draftId')::uuid FOR UPDATE;
 PERFORM public.national_nfse_reviewed_source_edge(p_user_id,p_intent);
 SELECT * INTO p FROM app_private.national_nfse_preparations WHERE empresa_id=t AND fiscal_config_id=r.fiscal_config_id AND draft_id=r.draft_id;
 IF NOT FOUND OR p.source_snapshot IS DISTINCT FROM r.snapshot OR p.dps_id IS DISTINCT FROM p_intent->>'dpsId'
 OR p.snapshot_hash IS DISTINCT FROM p_intent->>'snapshotHash' THEN RAISE EXCEPTION 'NATIONAL_PREPARATION_REVIEW_MISMATCH'; END IF;
 IF EXISTS(SELECT 1 FROM app_private.webiss_emissoes WHERE cobranca_id=cb.id AND ambiente='homologacao')
 OR EXISTS(SELECT 1 FROM app_private.webiss_rascunhos WHERE cobranca_id=cb.id AND ambiente='homologacao') THEN RAISE EXCEPTION 'NATIONAL_CHARGE_OTHER_PROVIDER'; END IF;
 UPDATE app_private.national_nfse_ledger SET dispatched=true,updated_at=now() WHERE empresa_id=t AND fiscal_config_id=r.fiscal_config_id
 AND draft_id=r.draft_id AND ambiente='homologacao' AND dps_id=p.dps_id AND snapshot_hash=p.snapshot_hash
 AND issuer_cnpj=p_intent->>'issuerCnpj' AND NOT dispatched AND outcome IS NULL;
 GET DIAGNOSTICS changed=ROW_COUNT;RETURN changed=1;
END;
$$;
REVOKE ALL ON FUNCTION app_private.national_config_revision(uuid,uuid),app_private.bind_national_review_configuration() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.national_nfse_review_context_edge(p_user_id uuid,p_fiscal_config_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.resolve_empresa_id_for_user(p_user_id);f public.configuracoes_integracao_fiscal;
BEGIN
 IF t IS NULL OR public.resolve_inter_manager_empresa_id(p_user_id) IS DISTINCT FROM t THEN RAISE EXCEPTION 'NATIONAL_FISCAL_PERMISSION_DENIED'; END IF;
 SELECT * INTO f FROM public.configuracoes_integracao_fiscal WHERE id=p_fiscal_config_id AND empresa_id=t;
 IF NOT FOUND THEN RAISE EXCEPTION 'NATIONAL_COMPANY_DENIED'; END IF;
 RETURN jsonb_build_object('tenantId',t,'companyId',f.id,'environment','homologacao','issuerCnpj',f.certificado_metadata->>'certificadoCNPJ');
END;
$$;
REVOKE ALL ON FUNCTION public.national_nfse_review_context_edge(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.national_nfse_review_context_edge(uuid,uuid) TO service_role;
COMMIT;
