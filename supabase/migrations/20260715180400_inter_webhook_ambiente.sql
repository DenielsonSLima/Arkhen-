-- Webhook Inter roteado explicitamente por ambiente, sem alterar estado de duplicados.
DROP FUNCTION IF EXISTS public.registrar_inter_webhook_eventos(uuid, text, jsonb);
CREATE OR REPLACE FUNCTION public.registrar_inter_webhook_eventos(
  p_webhook_id uuid, p_ambiente text, p_conta_corrente text, p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.configuracoes_integracao_bancaria;
  v_ambiente text := public.normalize_inter_environment(p_ambiente);
  v_conta text := ltrim(regexp_replace(coalesce(p_conta_corrente, ''), '[^0-9]', '', 'g'), '0');
  v_conta_config text; v_items jsonb; v_item jsonb; v_event_type text; v_external_id text;
  v_cobranca_external_id text; v_remote_status text; v_local_status text;
  v_evento_id uuid; v_total integer := 0; v_duplicados integer := 0;
BEGIN
  IF p_webhook_id IS NULL OR v_conta = '' THEN RAISE EXCEPTION 'Rota ou conta do webhook ausente.'; END IF;
  v_items := CASE WHEN jsonb_typeof(p_payload) = 'object' THEN jsonb_build_array(p_payload) ELSE p_payload END;
  IF jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Payload do webhook deve conter de 1 a 100 eventos.';
  END IF;
  SELECT * INTO v_row FROM public.configuracoes_integracao_bancaria c
  WHERE c.provedor = 'inter' AND c.webhook_route_id = p_webhook_id
    AND public.inter_jsonb_boolean(c.modulos, 'webhook', false) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rota de webhook Inter invalida ou inativa.'; END IF;
  v_conta_config := ltrim(regexp_replace(coalesce(
    v_row.configuracao->'environments'->v_ambiente->>'contaCorrente', ''), '[^0-9]', '', 'g'), '0');
  IF v_conta_config = '' OR v_conta_config <> v_conta THEN
    RAISE EXCEPTION 'Conta corrente nao pertence ao ambiente informado.';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN RAISE EXCEPTION 'Evento do webhook invalido.'; END IF;
    v_event_type := left(coalesce(NULLIF(v_item->>'tipo', ''), NULLIF(v_item->>'event', ''),
      NULLIF(v_item->>'situacao', ''), 'UNKNOWN'), 120);
    v_external_id := v_event_type || ':' || coalesce(NULLIF(v_item->>'id', ''),
      NULLIF(v_item->>'codigoSolicitacao', ''), NULLIF(v_item->>'nossoNumero', ''),
      NULLIF(v_item->>'endToEndId', ''), NULLIF(v_item->>'txid', ''),
      encode(digest(v_item::text, 'sha256'), 'hex'));
    v_evento_id := NULL;
    INSERT INTO public.inter_webhook_eventos (
      empresa_id, integracao_id, ambiente, external_event_id, event_type, conta_corrente, payload, tentativas
    ) VALUES (v_row.empresa_id, v_row.id, v_ambiente, v_external_id, v_event_type, v_conta, v_item, 1)
    ON CONFLICT (empresa_id, ambiente, external_event_id) DO NOTHING RETURNING id INTO v_evento_id;
    IF v_evento_id IS NULL THEN
      UPDATE public.inter_webhook_eventos SET tentativas = tentativas + 1, updated_at = now()
      WHERE empresa_id = v_row.empresa_id AND ambiente = v_ambiente AND external_event_id = v_external_id;
      v_duplicados := v_duplicados + 1;
    END IF;
    v_cobranca_external_id := coalesce(NULLIF(v_item->>'codigoSolicitacao', ''), NULLIF(v_item->>'txid', ''));
    v_remote_status := upper(coalesce(NULLIF(v_item->>'situacao', ''), NULLIF(v_item->>'status', ''), v_event_type));
    v_local_status := CASE
      WHEN v_remote_status ~ '(PAGO|RECEBIDO|LIQUIDADO|CONCLUIDO)' THEN 'Pago'
      WHEN v_remote_status ~ '(CANCEL|BAIXADO|EXPIRADO|DEVOLVIDO)' THEN 'Cancelado'
      ELSE 'Pendente' END;
    IF v_cobranca_external_id IS NOT NULL THEN
      UPDATE public.financeiro_cobrancas_integracoes i
      SET status = v_remote_status,
          pix_copia_cola = coalesce(NULLIF(v_item->>'pixCopiaECola', ''), i.pix_copia_cola),
          pix_qr_code = coalesce(NULLIF(v_item->>'qrCode', ''), i.pix_qr_code),
          payload = i.payload || v_item,
          sincronizado_em = now(), updated_at = now()
      WHERE i.empresa_id = v_row.empresa_id AND i.provedor = 'inter'
        AND i.ambiente = v_ambiente AND i.external_id = v_cobranca_external_id;
      UPDATE public.financeiro_cobrancas fc SET
        status = CASE WHEN fc.status = 'Pago' OR v_local_status = 'Pago' THEN 'Pago'
          WHEN fc.status = 'Cancelado' THEN 'Cancelado' ELSE v_local_status END,
        data_pagamento = CASE WHEN v_local_status = 'Pago' THEN coalesce(fc.data_pagamento, now()) ELSE fc.data_pagamento END,
        data_cancelamento = CASE WHEN v_local_status = 'Cancelado' THEN coalesce(fc.data_cancelamento, now()) ELSE fc.data_cancelamento END,
        updated_at = now()
      FROM public.financeiro_cobrancas_integracoes i
      WHERE i.empresa_id = v_row.empresa_id AND i.provedor = 'inter' AND i.ambiente = v_ambiente
        AND i.external_id = v_cobranca_external_id AND fc.id = i.cobranca_id AND fc.empresa_id = i.empresa_id;
    END IF;
    v_total := v_total + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'ambiente', v_ambiente, 'recebidos', v_total,
    'duplicados', v_duplicados, 'aceitos', v_total - v_duplicados);
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_inter_webhook_eventos(uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_inter_webhook_eventos(uuid,text,text,jsonb) TO service_role;
