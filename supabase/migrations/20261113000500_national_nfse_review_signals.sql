-- Minimal invalidation signals only. Private fiscal snapshots never enter realtime payloads.
BEGIN;
CREATE TABLE public.national_nfse_review_signals(
 fiscal_config_id uuid PRIMARY KEY REFERENCES public.configuracoes_integracao_fiscal(id),
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),revision bigint NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.national_nfse_review_signals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.national_nfse_review_signals FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.national_nfse_review_signals TO authenticated;
CREATE POLICY national_review_signals_read ON public.national_nfse_review_signals FOR SELECT TO authenticated
 USING(empresa_id=public.resolve_empresa_id_for_user(auth.uid()) AND empresa_id=public.resolve_inter_manager_empresa_id(auth.uid()));
CREATE FUNCTION app_private.signal_national_review_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.national_nfse_review_signals(fiscal_config_id,empresa_id) VALUES(NEW.fiscal_config_id,NEW.empresa_id)
 ON CONFLICT(fiscal_config_id) DO UPDATE SET revision=public.national_nfse_review_signals.revision+1,updated_at=clock_timestamp();
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION app_private.signal_national_review_change() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER national_review_signal AFTER INSERT OR UPDATE ON app_private.national_nfse_reviewed_sources FOR EACH ROW EXECUTE FUNCTION app_private.signal_national_review_change();
CREATE TRIGGER national_preparation_signal AFTER INSERT OR UPDATE ON app_private.national_nfse_preparations FOR EACH ROW EXECUTE FUNCTION app_private.signal_national_review_change();
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.national_nfse_review_signals;
 END IF;
END $$;
COMMIT;
