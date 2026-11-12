-- Backend-only national charge review. No national route is enabled by this migration.
BEGIN;
ALTER TABLE app_private.national_nfse_reviewed_sources ADD COLUMN cobranca_id uuid REFERENCES public.financeiro_cobrancas(id);
CREATE UNIQUE INDEX national_review_charge ON app_private.national_nfse_reviewed_sources(cobranca_id) WHERE cobranca_id IS NOT NULL;
CREATE FUNCTION app_private.national_charge_revision(p_charge_id uuid,p_tenant uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT encode(sha256(convert_to(jsonb_build_object('charge',to_jsonb(cb),'recipient',to_jsonb(c))::text,'UTF8')),'hex')
 FROM public.financeiro_cobrancas cb JOIN public.clientes c ON c.id=cb.cliente_empresa_id AND c.empresa_id=cb.empresa_id
 WHERE cb.id=p_charge_id AND cb.empresa_id=p_tenant;
$$;
CREATE FUNCTION public.national_nfse_review_charge_edge(p_user_id uuid,p_intent jsonb,p_charge_id uuid,p_snapshot jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid; cb public.financeiro_cobrancas; c public.clientes; revision text;
BEGIN
 PERFORM public.national_nfse_authorize_edge(p_user_id,p_intent);t:=(p_intent->>'tenantId')::uuid;
 SELECT * INTO cb FROM public.financeiro_cobrancas WHERE id=p_charge_id AND empresa_id=t FOR UPDATE;
 IF NOT FOUND OR cb.status='Cancelado' THEN RAISE EXCEPTION 'NATIONAL_CHARGE_UNAVAILABLE'; END IF;
 SELECT * INTO c FROM public.clientes WHERE id=cb.cliente_empresa_id AND empresa_id=t;
 IF NOT FOUND THEN RAISE EXCEPTION 'NATIONAL_RECIPIENT_UNAVAILABLE'; END IF;
 IF EXISTS(SELECT 1 FROM app_private.webiss_emissoes WHERE cobranca_id=cb.id AND ambiente='homologacao')
 OR EXISTS(SELECT 1 FROM app_private.webiss_rascunhos WHERE cobranca_id=cb.id AND ambiente='homologacao') THEN
 RAISE EXCEPTION 'NATIONAL_CHARGE_OTHER_PROVIDER'; END IF;
 IF EXISTS(SELECT 1 FROM app_private.national_nfse_preparations WHERE empresa_id=t AND fiscal_config_id=(p_intent->>'companyId')::uuid AND draft_id=(p_intent->>'draftId')::uuid) THEN RAISE EXCEPTION 'NATIONAL_PREPARATION_IMMUTABLE'; END IF;
 IF p_snapshot->>'environment' IS DISTINCT FROM 'HOMOLOGACAO'
 OR p_snapshot#>>'{issuer,taxId,value}' IS DISTINCT FROM p_intent->>'issuerCnpj'
 OR p_snapshot#>>'{recipient,taxId,value}' IS DISTINCT FROM regexp_replace(coalesce(c.cnpj,''),'[^0-9]','','g')
 OR p_snapshot#>>'{recipient,taxId,type}' IS DISTINCT FROM (CASE WHEN c.tipo='PF' THEN 'CPF' ELSE 'CNPJ' END)
 OR p_snapshot#>>'{recipient,name}' IS DISTINCT FROM coalesce(nullif(c.razao_social,''),c.nome)
 OR (p_snapshot#>>'{values,serviceAmount}')::numeric IS DISTINCT FROM cb.valor
 OR p_snapshot ?| ARRAY['number','series','issuedAt'] THEN RAISE EXCEPTION 'NATIONAL_CHARGE_SNAPSHOT_MISMATCH'; END IF;
 revision:=app_private.national_charge_revision(cb.id,t);
 INSERT INTO app_private.national_nfse_reviewed_sources(empresa_id,fiscal_config_id,draft_id,source_revision,snapshot,reviewed_by,reviewed_at,cobranca_id)
 VALUES(t,(p_intent->>'companyId')::uuid,(p_intent->>'draftId')::uuid,revision,p_snapshot,p_user_id,now(),cb.id)
 ON CONFLICT(empresa_id,fiscal_config_id,draft_id) DO UPDATE SET source_revision=excluded.source_revision,snapshot=excluded.snapshot,
 reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,invalidated_at=NULL
 WHERE app_private.national_nfse_reviewed_sources.cobranca_id=excluded.cobranca_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'NATIONAL_CHARGE_LINK_IMMUTABLE'; END IF;
 RETURN jsonb_build_object('state','REVIEWED_ONLY','submitted',false);
END;
$$;
-- Invalidate review when real charge or recipient changes; never rely solely on UI freshness.
CREATE OR REPLACE FUNCTION public.national_nfse_reviewed_source_edge(p_user_id uuid,p_intent jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r app_private.national_nfse_reviewed_sources;
BEGIN
 PERFORM public.national_nfse_authorize_edge(p_user_id,p_intent);
 SELECT * INTO r FROM app_private.national_nfse_reviewed_sources WHERE empresa_id=(p_intent->>'tenantId')::uuid
 AND fiscal_config_id=(p_intent->>'companyId')::uuid AND draft_id=(p_intent->>'draftId')::uuid AND invalidated_at IS NULL;
 IF NOT FOUND OR r.cobranca_id IS NULL THEN RAISE EXCEPTION 'NATIONAL_REVIEW_REQUIRED'; END IF;
 IF r.source_revision IS DISTINCT FROM app_private.national_charge_revision(r.cobranca_id,r.empresa_id) THEN RAISE EXCEPTION 'NATIONAL_REVIEW_STALE'; END IF;
 RETURN jsonb_build_object('snapshot',r.snapshot,'sourceRevision',r.source_revision);
END;
$$;
-- Both WebISS write paths already lock the charge; this reciprocal trigger shares that lock.
CREATE FUNCTION app_private.prevent_webiss_national_charge_overlap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.cobranca_id IS NOT NULL AND NEW.ambiente='homologacao' THEN
  PERFORM 1 FROM public.financeiro_cobrancas WHERE id=NEW.cobranca_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM app_private.national_nfse_reviewed_sources WHERE cobranca_id=NEW.cobranca_id) THEN
   RAISE EXCEPTION 'CHARGE_RESERVED_FOR_NATIONAL_REVIEW'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER national_overlap_guard BEFORE INSERT OR UPDATE ON app_private.webiss_emissoes FOR EACH ROW EXECUTE FUNCTION app_private.prevent_webiss_national_charge_overlap();
CREATE TRIGGER national_overlap_guard BEFORE INSERT OR UPDATE ON app_private.webiss_rascunhos FOR EACH ROW EXECUTE FUNCTION app_private.prevent_webiss_national_charge_overlap();
REVOKE ALL ON FUNCTION app_private.national_charge_revision(uuid,uuid),app_private.prevent_webiss_national_charge_overlap() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.national_nfse_review_charge_edge(uuid,jsonb,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.national_nfse_review_charge_edge(uuid,jsonb,uuid,jsonb) TO service_role;
COMMIT;
