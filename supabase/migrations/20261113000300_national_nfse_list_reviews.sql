-- Isolated, paginated national review list. No provider transmission or new grants to users.
BEGIN;
CREATE FUNCTION public.national_nfse_list_reviews_edge(p_user_id uuid,p_fiscal_config_id uuid,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ctx jsonb; t uuid; row record; review jsonb; items jsonb:='[]'; more boolean:=false; n integer:=0;
BEGIN
 IF p_offset IS NULL OR p_offset<0 OR p_offset>10000 THEN RAISE EXCEPTION 'NATIONAL_INVALID_PAGE'; END IF;
 ctx:=public.national_nfse_review_context_edge(p_user_id,p_fiscal_config_id);
 PERFORM public.national_nfse_authorize_edge(p_user_id,ctx);t:=(ctx->>'tenantId')::uuid;
 FOR row IN SELECT r.cobranca_id FROM app_private.national_nfse_reviewed_sources r
 JOIN public.financeiro_cobrancas c ON c.id=r.cobranca_id AND c.empresa_id=r.empresa_id
 WHERE r.empresa_id=t AND r.fiscal_config_id=p_fiscal_config_id AND c.status IS DISTINCT FROM 'Cancelado'
 ORDER BY r.reviewed_at DESC,r.draft_id LIMIT 26 OFFSET p_offset LOOP
  n:=n+1;IF n>25 THEN more:=true;EXIT;END IF;
  review:=public.national_nfse_get_charge_review_edge(p_user_id,p_fiscal_config_id,row.cobranca_id)->'review';
  items:=items||jsonb_build_array(jsonb_build_object('chargeId',row.cobranca_id,'draftId',review->>'draftId',
   'recipientName',review#>>'{fields,recipient,name}','competence',review#>>'{fields,competence}',
   'amount',review#>>'{fields,values,serviceAmount}','state',review->>'state','reviewedAt',review->>'reviewedAt'));
 END LOOP;
 RETURN jsonb_build_object('items',items,'hasMore',more);
END;
$$;
REVOKE ALL ON FUNCTION public.national_nfse_list_reviews_edge(uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.national_nfse_list_reviews_edge(uuid,uuid,integer) TO service_role;
COMMIT;
