BEGIN;

-- All new emissions must start with an explicitly reviewed fiscal draft.
-- Keep preparar_consulta_nfse_webiss untouched for reconciliation of old RPS.
CREATE OR REPLACE FUNCTION public.preparar_emissao_nfse_webiss(p_user_id uuid,p_cobranca_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.financeiro_cobrancas
    WHERE id=p_cobranca_id AND empresa_id=public.resolve_empresa_id_for_user(p_user_id)
  ) THEN
    RAISE EXCEPTION 'Cobranca fora da empresa.';
  END IF;
  RAISE EXCEPTION 'Emissao direta da cobranca desativada. Prepare e revise um rascunho no Faturamento. Se ja houver tentativa, consulte o mesmo RPS.';
END;
$$;

REVOKE ALL ON FUNCTION public.preparar_emissao_nfse_webiss(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.preparar_emissao_nfse_webiss(uuid,uuid) TO service_role;
-- The renamed implementation must not remain a direct privileged bypass.
REVOKE ALL ON FUNCTION public.preparar_emissao_nfse_webiss_cobranca(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Resume the existing draft instead of creating a duplicate charge/environment link.
CREATE OR REPLACE FUNCTION public.obter_rascunho_cobranca_webiss(p_cobranca_id uuid,p_ambiente text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t uuid := public.current_empresa_id();
  d app_private.webiss_rascunhos;
BEGIN
  IF auth.uid() IS NULL OR t IS NULL THEN RAISE EXCEPTION 'Sessao fiscal ausente.'; END IF;
  IF p_ambiente IS NOT NULL AND p_ambiente NOT IN ('homologacao','producao') THEN
    RAISE EXCEPTION 'Ambiente fiscal invalido.';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.financeiro_cobrancas WHERE id=p_cobranca_id AND empresa_id=t) THEN
    RAISE EXCEPTION 'Cobranca fora da empresa.';
  END IF;
  SELECT * INTO d FROM app_private.webiss_rascunhos
    WHERE empresa_id=t AND cobranca_id=p_cobranca_id AND (p_ambiente IS NULL OR ambiente=p_ambiente)
    ORDER BY updated_at DESC,id DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN app_private.webiss_rascunho_dto(d);
END;
$$;
REVOKE ALL ON FUNCTION public.obter_rascunho_cobranca_webiss(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.obter_rascunho_cobranca_webiss(uuid,text) TO authenticated;

COMMIT;
