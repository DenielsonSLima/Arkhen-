-- Callbacks are hints. Only the service-role Edge function passes mTLS-confirmed states.
BEGIN;
DO $patch$
DECLARE v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.build_inter_environment_config(uuid,text,jsonb,jsonb)'::regprocedure)
  INTO v_definition;
  IF strpos(v_definition, 'v_conta text := '''';') = 0 THEN
    RAISE EXCEPTION 'Definicao de conta Inter inesperada.';
  END IF;
  v_definition := replace(v_definition, 'v_conta text := '''';', $replacement$v_conta text := ltrim(regexp_replace(coalesce(
    NULLIF(p_payload->>'contaCorrente', ''), NULLIF(p_payload->>'conta_corrente', ''),
    p_current->>'contaCorrente', ''), '[^0-9]', '', 'g'), '0');$replacement$);
  EXECUTE v_definition;
END;
$patch$;

CREATE OR REPLACE FUNCTION public.map_inter_charge_status(p_status text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $$ SELECT CASE upper(trim(coalesce(p_status, '')))
  WHEN 'PAGO' THEN 'Pago' WHEN 'RECEBIDO' THEN 'Pago' WHEN 'LIQUIDADO' THEN 'Pago'
  WHEN 'CONCLUIDA' THEN 'Pago' WHEN 'CONCLUIDO' THEN 'Pago'
  WHEN 'CANCELADO' THEN 'Cancelado' WHEN 'CANCELADA' THEN 'Cancelado'
  WHEN 'BAIXADO' THEN 'Cancelado'
  WHEN 'REMOVIDA_PELO_USUARIO_RECEBEDOR' THEN 'Cancelado'
  WHEN 'REMOVIDA_PELO_PSP' THEN 'Cancelado'
  ELSE 'Pendente' END $$;

CREATE OR REPLACE FUNCTION public.preparar_inter_webhook(
  p_webhook_id uuid, p_ambiente text, p_conta_corrente text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault, pg_temp AS $$
DECLARE
  v_row public.configuracoes_integracao_bancaria; v_env jsonb; v_conta text;
  v_header text := ltrim(regexp_replace(coalesce(p_conta_corrente, ''), '[^0-9]', '', 'g'), '0');
BEGIN
  IF p_ambiente NOT IN ('producao', 'homologacao') OR p_ambiente IS NULL THEN
    RAISE EXCEPTION 'Ambiente de webhook invalido.';
  END IF;
  SELECT * INTO v_row FROM public.configuracoes_integracao_bancaria
  WHERE provedor = 'inter' AND webhook_route_id = p_webhook_id
    AND public.inter_jsonb_boolean(modulos, 'webhook', false);
  IF NOT FOUND THEN RAISE EXCEPTION 'Rota de webhook invalida ou inativa.'; END IF;
  v_env := v_row.configuracao->'environments'->p_ambiente;
  IF v_env IS NULL THEN RAISE EXCEPTION 'Ambiente de webhook nao configurado.'; END IF;
  v_conta := ltrim(regexp_replace(coalesce(v_env->>'contaCorrente', ''), '[^0-9]', '', 'g'), '0');
  IF v_conta <> '' AND v_header <> '' AND v_conta <> v_header THEN
    RAISE EXCEPTION 'Conta divergente do ambiente configurado.';
  END IF;
  RETURN jsonb_build_object(
    'empresaId', v_row.empresa_id, 'ambiente', p_ambiente, 'webhookId', p_webhook_id,
    'baseUrl', v_env->>'baseUrl', 'authUrl', v_env->>'authUrl',
    'clientId', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = NULLIF(v_env->>'client_id_secret_id','')::uuid),
    'clientSecret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = NULLIF(v_env->>'client_secret_secret_id','')::uuid),
    'certificadoPem', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = NULLIF(v_env->>'certificado_pem_secret_id','')::uuid),
    'chavePrivadaPem', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = NULLIF(v_env->>'chave_privada_pem_secret_id','')::uuid),
    'contaCorrente', v_conta, 'chavePix', v_env->>'chavePix', 'modulos', v_row.modulos);
END $$;

CREATE OR REPLACE FUNCTION public.registrar_inter_webhook_eventos(
  p_webhook_id uuid, p_ambiente text, p_conta_corrente text, p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_config jsonb; v_row public.configuracoes_integracao_bancaria;
  v_items jsonb; v_item jsonb; v_external text; v_remote text; v_local text;
  v_event_key text; v_event uuid; v_integration public.financeiro_cobrancas_integracoes;
  v_total int := 0; v_pending int := 0; v_duplicates int := 0;
BEGIN
  v_config := public.preparar_inter_webhook(p_webhook_id,p_ambiente,p_conta_corrente);
  SELECT * INTO STRICT v_row FROM public.configuracoes_integracao_bancaria
  WHERE empresa_id = (v_config->>'empresaId')::uuid AND provedor = 'inter';
  v_items := CASE WHEN jsonb_typeof(p_payload) = 'object' THEN jsonb_build_array(p_payload) ELSE p_payload END;
  IF jsonb_typeof(v_items) IS DISTINCT FROM 'array' OR jsonb_array_length(v_items) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Quantidade de eventos invalida.';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
    v_external := coalesce(NULLIF(v_item->>'codigoSolicitacao',''),NULLIF(v_item->>'txid',''));
    v_remote := upper(trim(coalesce(NULLIF(v_item->>'situacao',''),v_item->>'status','')));
    IF v_external IS NULL OR v_remote = '' OR coalesce(v_item->>'tipo','') NOT IN ('BOLETO','PIX') THEN
      RAISE EXCEPTION 'Evento confirmado sem identificacao ou estado.';
    END IF;
    IF (v_item->>'tipo'='PIX' AND v_remote NOT IN
      ('ATIVA','CONCLUIDA','REMOVIDA_PELO_USUARIO_RECEBEDOR','REMOVIDA_PELO_PSP'))
      OR (v_item->>'tipo'='BOLETO' AND v_remote NOT IN
      ('RECEBIDO','A_RECEBER','MARCADO_RECEBIDO','ATRASADO','CANCELADO','EXPIRADO',
       'FALHA_EMISSAO','EM_PROCESSAMENTO','PROTESTO')) THEN
      RAISE EXCEPTION 'Estado confirmado desconhecido.';
    END IF;
    v_local := public.map_inter_charge_status(v_remote);
    v_event_key := (v_item->>'tipo') || ':' || v_external || ':' || v_remote;
    v_event := NULL;
    INSERT INTO public.inter_webhook_eventos(empresa_id,integracao_id,ambiente,external_event_id,
      event_type,conta_corrente,payload,tentativas)
    VALUES(v_row.empresa_id,v_row.id,p_ambiente,v_event_key,v_remote,v_config->>'contaCorrente',v_item,1)
    ON CONFLICT(empresa_id,ambiente,external_event_id) DO NOTHING RETURNING id INTO v_event;
    IF v_event IS NULL THEN
      v_duplicates := v_duplicates + 1;
      UPDATE public.inter_webhook_eventos SET tentativas=tentativas+1,updated_at=now()
      WHERE empresa_id=v_row.empresa_id AND ambiente=p_ambiente AND external_event_id=v_event_key
      RETURNING id INTO v_event;
    END IF;
    SELECT * INTO v_integration FROM public.financeiro_cobrancas_integracoes
    WHERE empresa_id=v_row.empresa_id AND provedor='inter' AND ambiente=p_ambiente
      AND external_id=v_external
      AND ((v_item->>'tipo'='PIX' AND tipo='pix') OR (v_item->>'tipo'='BOLETO' AND tipo IN ('boleto','bolepix')))
    FOR UPDATE;
    IF NOT FOUND THEN
      v_pending := v_pending + 1;
    ELSE
      UPDATE public.financeiro_cobrancas_integracoes SET
        status=CASE WHEN public.map_inter_charge_status(status)='Pago' THEN status
          WHEN public.map_inter_charge_status(status)='Cancelado' AND v_local='Pendente' THEN status ELSE v_remote END,
        pix_copia_cola=coalesce(NULLIF(v_item->'dadosBanco'->>'pixCopiaECola',''),
          NULLIF(v_item->'dadosBanco'->'pix'->>'pixCopiaECola',''),
          NULLIF(v_item->'dadosBanco'->'pix'->>'copiaECola',''),pix_copia_cola),
        pix_qr_code=coalesce(NULLIF(v_item->'dadosBanco'->>'pixQrCode',''),
          NULLIF(v_item->'dadosBanco'->'pix'->>'qrCode',''),pix_qr_code),
        payload=coalesce(payload,'{}'::jsonb)||v_item, sincronizado_em=now(),updated_at=now()
      WHERE id=v_integration.id AND empresa_id=v_row.empresa_id;
      UPDATE public.financeiro_cobrancas SET
        status=CASE WHEN status='Pago' OR v_local='Pago' THEN 'Pago'
          WHEN status='Cancelado' THEN 'Cancelado' ELSE v_local END,
        data_pagamento=CASE WHEN v_local='Pago' THEN coalesce(data_pagamento,now()) ELSE data_pagamento END,
        data_cancelamento=CASE WHEN v_local='Cancelado' AND status<>'Pago' THEN coalesce(data_cancelamento,now()) ELSE data_cancelamento END,
        updated_at=now()
      WHERE id=v_integration.cobranca_id AND empresa_id=v_row.empresa_id;
      UPDATE public.inter_webhook_eventos SET status='processado',processado_em=now(),erro=NULL
      WHERE id=v_event AND empresa_id=v_row.empresa_id;
    END IF;
    v_total := v_total + 1;
  END LOOP;
  RETURN jsonb_build_object('ok',true,'recebidos',v_total,'duplicados',v_duplicates,'pendentes',v_pending);
END $$;
REVOKE ALL ON FUNCTION public.preparar_inter_webhook(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.preparar_inter_webhook(uuid,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.registrar_inter_webhook_eventos(uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_inter_webhook_eventos(uuid,text,text,jsonb) TO service_role;
COMMIT;
