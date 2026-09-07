-- Cancellation is pending until a provider GET confirms its final state.
BEGIN;
DO $patch$
DECLARE v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.preparar_operacao_cobranca_inter(uuid,uuid)'::regprocedure)
  INTO v_definition;
  IF strpos(v_definition, '''externalId'', v_integration.external_id,')=0 THEN
    RAISE EXCEPTION 'Definicao de preparacao Inter inesperada.';
  END IF;
  v_definition := replace(v_definition, '''externalId'', v_integration.external_id,',
    '''externalId'', v_integration.external_id, ''tipo'', v_integration.tipo,');
  EXECUTE v_definition;
END $patch$;

CREATE OR REPLACE FUNCTION public.registrar_cancelamento_pendente_cobranca_inter(
  p_user_id uuid,p_cobranca_id uuid,p_external_id text,p_resultado jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_empresa uuid := public.resolve_empresa_id_for_user(p_user_id);
  v_integration public.financeiro_cobrancas_integracoes; v_charge public.financeiro_cobrancas;
BEGIN
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Usuario sem empresa.'; END IF;
  SELECT * INTO v_integration FROM public.financeiro_cobrancas_integracoes
  WHERE empresa_id=v_empresa AND cobranca_id=p_cobranca_id AND provedor='inter'
    AND external_id=p_external_id AND ambiente=p_resultado->>'ambiente' FOR UPDATE;
  IF NOT FOUND OR p_resultado->>'externalId' IS DISTINCT FROM p_external_id
    OR (CASE WHEN v_integration.tipo='pix' THEN 'pix' ELSE 'bolepix' END) IS DISTINCT FROM p_resultado->>'tipo' THEN
    RAISE EXCEPTION 'Integracao do cancelamento divergente.';
  END IF;
  SELECT * INTO STRICT v_charge FROM public.financeiro_cobrancas
  WHERE id=p_cobranca_id AND empresa_id=v_empresa FOR UPDATE;
  IF v_charge.status='Pago' OR public.map_inter_charge_status(v_integration.status)='Pago' THEN
    RAISE EXCEPTION 'Cobranca paga nao pode ser cancelada.';
  END IF;
  UPDATE public.financeiro_cobrancas_integracoes SET
    status=CASE WHEN v_charge.status='Cancelado' THEN status ELSE 'CANCELAMENTO_SOLICITADO' END,
    payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('cancelamento',p_resultado),updated_at=now()
  WHERE id=v_integration.id AND empresa_id=v_empresa;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.confirmar_cancelamento_cobranca_inter(
  p_user_id uuid,p_cobranca_id uuid,p_external_id text,p_resultado jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_empresa uuid := public.resolve_empresa_id_for_user(p_user_id);
  v_integration public.financeiro_cobrancas_integracoes; v_charge public.financeiro_cobrancas;
  v_consulta jsonb := p_resultado->'consulta'; v_status text; v_external text;
BEGIN
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Usuario sem empresa.'; END IF;
  SELECT * INTO v_integration FROM public.financeiro_cobrancas_integracoes
  WHERE empresa_id=v_empresa AND cobranca_id=p_cobranca_id AND provedor='inter'
    AND external_id=p_external_id AND ambiente=p_resultado->>'ambiente' FOR UPDATE;
  IF NOT FOUND OR p_resultado->>'externalId' IS DISTINCT FROM p_external_id
    OR (CASE WHEN v_integration.tipo='pix' THEN 'pix' ELSE 'bolepix' END) IS DISTINCT FROM p_resultado->>'tipo' THEN
    RAISE EXCEPTION 'Integracao do cancelamento divergente.';
  END IF;
  IF v_integration.tipo='pix' THEN
    v_status := v_consulta->>'status'; v_external := v_consulta->>'txid';
    IF v_status IS NULL OR v_status NOT IN ('REMOVIDA_PELO_USUARIO_RECEBEDOR','REMOVIDA_PELO_PSP') THEN
      RAISE EXCEPTION 'Cancelamento Pix nao confirmado no banco.';
    END IF;
  ELSE
    v_status := coalesce(v_consulta->'cobranca'->>'situacao',v_consulta->>'situacao');
    v_external := coalesce(v_consulta->'cobranca'->>'codigoSolicitacao',v_consulta->>'codigoSolicitacao');
    IF v_status IS DISTINCT FROM 'CANCELADO' THEN
      RAISE EXCEPTION 'Cancelamento boleto nao confirmado no banco.';
    END IF;
  END IF;
  IF v_external IS DISTINCT FROM p_external_id THEN RAISE EXCEPTION 'Consulta de outra cobranca.'; END IF;
  SELECT * INTO STRICT v_charge FROM public.financeiro_cobrancas
  WHERE id=p_cobranca_id AND empresa_id=v_empresa FOR UPDATE;
  IF v_charge.status='Pago' OR public.map_inter_charge_status(v_integration.status)='Pago' THEN
    RAISE EXCEPTION 'Cobranca paga nao pode ser cancelada.';
  END IF;
  UPDATE public.financeiro_cobrancas_integracoes SET status=v_status,
    payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('cancelamento',p_resultado),
    sincronizado_em=now(),updated_at=now() WHERE id=v_integration.id AND empresa_id=v_empresa;
  UPDATE public.financeiro_cobrancas SET status='Cancelado',
    data_cancelamento=coalesce(data_cancelamento,now()),updated_at=now()
  WHERE id=p_cobranca_id AND empresa_id=v_empresa;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.registrar_cancelamento_pendente_cobranca_inter(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_cancelamento_pendente_cobranca_inter(uuid,uuid,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.confirmar_cancelamento_cobranca_inter(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_cancelamento_cobranca_inter(uuid,uuid,text,jsonb) TO service_role;
COMMIT;
