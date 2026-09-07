-- Transactional fixture: never commit. No provider/network request or secret output.
BEGIN;
DO $test$
DECLARE
  v_user uuid; v_empresa uuid; v_outsider uuid;
  v_client uuid := gen_random_uuid(); v_secret uuid; v_cfg jsonb; v_request text := gen_random_uuid()::text;
  v_payload jsonb; v_first jsonb; v_retry jsonb; v_id uuid; v_token uuid; v_registration jsonb;
  v_charge public.financeiro_cobrancas; v_again public.financeiro_cobrancas; v_failed boolean; v_webhook uuid; v_event jsonb; v_webhook_result jsonb;
BEGIN
  SELECT p.user_id,public.resolve_empresa_id_for_user(p.user_id) INTO v_user,v_empresa
  FROM public.perfis p
  WHERE public.resolve_empresa_id_for_user(p.user_id) IS NOT NULL LIMIT 1;
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Test requires an active tenant user.'; END IF;
  SELECT p.user_id INTO v_outsider FROM public.perfis p
  WHERE public.resolve_empresa_id_for_user(p.user_id) IS NOT NULL
    AND public.resolve_empresa_id_for_user(p.user_id)<>v_empresa LIMIT 1;
  v_outsider := coalesce(v_outsider,gen_random_uuid());
  SELECT vault.create_secret('inter-contract-test-placeholder') INTO v_secret;
  v_cfg := jsonb_build_object('activeEnvironment','homologacao','environments',jsonb_build_object(
    'homologacao',jsonb_build_object('client_id_secret_id',v_secret,'client_secret_secret_id',v_secret,
      'certificado_pem_secret_id',v_secret,'chave_privada_pem_secret_id',v_secret,
      'contaCorrente','12345','chavePix','test@example.invalid',
      'baseUrl','https://cdpj-sandbox.partners.uatinter.co',
      'authUrl','https://cdpj-sandbox.partners.uatinter.co/oauth/v2/token')));
  UPDATE public.configuracoes_integracao_bancaria SET ativo=false WHERE empresa_id=v_empresa;
  INSERT INTO public.configuracoes_integracao_bancaria(empresa_id,provedor,ativo,status,configuracao,modulos)
  VALUES(v_empresa,'inter',true,'ativo',v_cfg,'{"boleto":true,"pix":true,"webhook":true}')
  ON CONFLICT(empresa_id,provedor) DO UPDATE SET ativo=true,status='ativo',configuracao=excluded.configuracao,
    modulos=excluded.modulos;
  INSERT INTO public.clientes(id,empresa_id,nome,razao_social,cnpj,tipo,status,endereco,bairro,cidade,uf,cep,tipo_empresa_id)
  VALUES(v_client,v_empresa,'Inter contract test','Inter contract test','52998224725','PF','Ativa',
    'Rua Teste','Centro','Maceio','AL','57000000',
    (SELECT id FROM public.parametrizacao_catalogos WHERE empresa_id=v_empresa
      AND tipo='tipos_empresa' AND codigo='pessoa_fisica' AND ativo=true LIMIT 1));
  v_payload := jsonb_build_object('request_id',v_request,'cliente_empresa_id',v_client,
    'valor',12.34,'data_vencimento',current_date+1,'meio_pagamento','Pix','descricao','Inter contract test');
  v_first := public.preparar_tentativa_cobranca_inter(v_user,v_payload);
  IF v_first->>'acao' IS DISTINCT FROM 'emitir' THEN RAISE EXCEPTION 'First reservation must emit.'; END IF;
  v_id := (v_first->>'tentativaId')::uuid; v_token := (v_first->>'leaseToken')::uuid;
  IF (SELECT prepared_snapshot ?| ARRAY['clientId','clientSecret','certificadoPem','chavePrivadaPem']
      FROM public.inter_cobranca_tentativas WHERE id=v_id) THEN
    RAISE EXCEPTION 'Credentials persisted in snapshot.';
  END IF;
  v_retry := public.preparar_tentativa_cobranca_inter(v_user,v_payload||jsonb_build_object('request_id',gen_random_uuid()));
  IF v_retry->>'acao' IS DISTINCT FROM 'ocupada' OR v_retry->>'requestId' IS DISTINCT FROM v_request THEN
    RAISE EXCEPTION 'Duplicate business request did not join the pending reservation.';
  END IF;
  v_failed := false;
  BEGIN
    PERFORM public.preparar_tentativa_cobranca_inter(v_user,v_payload||'{"valor":99}'::jsonb);
  EXCEPTION WHEN OTHERS THEN v_failed := true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Reused request accepted a different payload.'; END IF;
  PERFORM public.liberar_preparo_tentativa_cobranca_inter(v_user,v_id,v_token);
  v_retry := public.preparar_tentativa_cobranca_inter(v_user,v_payload);
  IF v_retry->>'acao' IS DISTINCT FROM 'emitir' OR v_retry->>'leaseToken'=v_token::text THEN
    RAISE EXCEPTION 'Preflight release did not safely renew ownership.';
  END IF;
  v_failed := false;
  BEGIN
    PERFORM public.iniciar_envio_tentativa_cobranca_inter(v_user,v_id,v_token);
  EXCEPTION WHEN OTHERS THEN v_failed := true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Stale lease dispatched.'; END IF;
  v_token := (v_retry->>'leaseToken')::uuid;
  v_failed := false;
  BEGIN
    PERFORM public.iniciar_envio_tentativa_cobranca_inter(v_outsider,v_id,v_token);
  EXCEPTION WHEN OTHERS THEN v_failed := true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Outside tenant dispatched.'; END IF;
  PERFORM public.iniciar_envio_tentativa_cobranca_inter(v_user,v_id,v_token);
  IF public.liberar_preparo_tentativa_cobranca_inter(v_user,v_id,v_token) THEN
    RAISE EXCEPTION 'Dispatched request was released for re-emission.';
  END IF;
  UPDATE public.inter_cobranca_tentativas SET lease_ate=now()-interval '1 second',
    prepared_snapshot=jsonb_set(prepared_snapshot,'{cobranca,dataVencimento}',to_jsonb((current_date-1)::text))
  WHERE id=v_id;
  v_retry := public.preparar_tentativa_cobranca_inter(v_user,v_payload);
  IF v_retry->>'acao' IS DISTINCT FROM 'reconciliar'
    OR v_retry->'prepared'->'cobranca'->>'dataVencimento' IS DISTINCT FROM (current_date-1)::text THEN
    RAISE EXCEPTION 'Expired uncertain request did not reconcile original snapshot.';
  END IF;
  v_token := (v_retry->>'leaseToken')::uuid;
  UPDATE public.inter_cobranca_tentativas SET lease_ate=now()-interval '1 second' WHERE id=v_id;
  UPDATE public.configuracoes_integracao_bancaria
  SET configuracao=jsonb_set(configuracao,'{environments,homologacao,contaCorrente}','"99999"')
  WHERE empresa_id=v_empresa AND provedor='inter';
  v_failed := false;
  BEGIN
    PERFORM public.preparar_tentativa_cobranca_inter(v_user,v_payload);
  EXCEPTION WHEN OTHERS THEN v_failed := true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Changed account accepted original request.'; END IF;
  UPDATE public.configuracoes_integracao_bancaria SET configuracao=v_cfg
  WHERE empresa_id=v_empresa AND provedor='inter';
  v_retry := public.preparar_tentativa_cobranca_inter(v_user,v_payload);
  v_token := (v_retry->>'leaseToken')::uuid;
  v_registration := jsonb_build_object('cliente_empresa_id',v_client,'ambiente','homologacao',
    'external_id',replace(gen_random_uuid()::text,'-',''),'tipo','pix','meio_pagamento','Pix',
    'valor',12.34,'data_vencimento',current_date-1,'descricao','Inter contract test',
    'provider_payload',jsonb_build_object('status','ATIVA'));
  v_failed := false;
  BEGIN
    PERFORM public.registrar_resultado_tentativa_cobranca_inter(v_user,v_id,v_registration,NULL);
  EXCEPTION WHEN OTHERS THEN v_failed := true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Null lease accepted provider result.'; END IF;
  PERFORM public.registrar_resultado_tentativa_cobranca_inter(v_user,v_id,v_registration,v_token);
  v_retry := public.preparar_tentativa_cobranca_inter(v_user,v_payload);
  IF v_retry->'registration' IS DISTINCT FROM v_registration OR v_retry ? 'prepared' THEN
    RAISE EXCEPTION 'Saved result must replay without provider or credentials.';
  END IF;
  v_failed := false;
  BEGIN
    PERFORM public.confirmar_tentativa_cobranca_inter(v_outsider,v_id);
  EXCEPTION WHEN OTHERS THEN v_failed := true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Outside tenant confirmed result.'; END IF;
  v_charge := public.confirmar_tentativa_cobranca_inter(v_user,v_id);
  v_again := public.confirmar_tentativa_cobranca_inter(v_user,v_id);
  IF v_charge.id IS NULL OR v_again.id IS DISTINCT FROM v_charge.id THEN
    RAISE EXCEPTION 'Confirmation did not return the same saved charge.';
  END IF;
  v_retry := public.preparar_tentativa_cobranca_inter(v_user,v_payload);
  IF v_retry->>'acao' IS DISTINCT FROM 'concluida' THEN RAISE EXCEPTION 'Completed request was not replayed.'; END IF;
  SELECT webhook_route_id INTO v_webhook FROM public.configuracoes_integracao_bancaria
  WHERE empresa_id=v_empresa AND provedor='inter';
  UPDATE public.configuracoes_integracao_bancaria
  SET configuracao=jsonb_set(configuracao,'{environments,homologacao,contaCorrente}','""')
  WHERE empresa_id=v_empresa AND provedor='inter';
  v_webhook_result := public.preparar_inter_webhook(v_webhook,'homologacao','99999');
  IF v_webhook_result->>'contaCorrente' IS DISTINCT FROM '' THEN
    RAISE EXCEPTION 'Unconfigured account trusted an unverified callback header.';
  END IF;
  v_event := jsonb_build_object('tipo','PIX','txid',v_registration->>'external_id',
    'situacao','CONCLUIDA','dadosBanco',jsonb_build_object('status','CONCLUIDA','pixCopiaECola','test-copy-paste'));
  v_failed := false;
  BEGIN
    PERFORM public.registrar_inter_webhook_eventos(v_webhook,'homologacao','',v_event-'tipo');
  EXCEPTION WHEN OTHERS THEN v_failed := true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Webhook accepted missing type.'; END IF;
  v_failed := false;
  BEGIN
    PERFORM public.registrar_inter_webhook_eventos(v_webhook,'homologacao','',v_event||'{"situacao":"NAO_CONCLUIDA"}'::jsonb);
  EXCEPTION WHEN OTHERS THEN v_failed := true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Webhook accepted fake status substring.'; END IF;
  v_webhook_result := public.registrar_inter_webhook_eventos(v_webhook,'homologacao','99999',v_event);
  IF (v_webhook_result->>'pendentes')::int<>0
    OR (SELECT status FROM public.financeiro_cobrancas WHERE id=v_charge.id) IS DISTINCT FROM 'Pago'
    OR (SELECT pix_copia_cola FROM public.financeiro_cobrancas_integracoes
      WHERE empresa_id=v_empresa AND cobranca_id=v_charge.id AND provedor='inter') IS DISTINCT FROM 'test-copy-paste' THEN
    RAISE EXCEPTION 'Confirmed Pix did not settle the charge or save its code.';
  END IF;
  PERFORM public.registrar_inter_webhook_eventos(v_webhook,'homologacao','',
    v_event||'{"situacao":"ATIVA","dadosBanco":{"status":"ATIVA"}}'::jsonb);
  IF (SELECT status FROM public.financeiro_cobrancas WHERE id=v_charge.id) IS DISTINCT FROM 'Pago'
    OR (SELECT status FROM public.financeiro_cobrancas_integracoes
      WHERE empresa_id=v_empresa AND cobranca_id=v_charge.id AND provedor='inter') IS DISTINCT FROM 'CONCLUIDA'
    OR (SELECT pix_copia_cola FROM public.financeiro_cobrancas_integracoes
      WHERE empresa_id=v_empresa AND cobranca_id=v_charge.id AND provedor='inter') IS DISTINCT FROM 'test-copy-paste' THEN
    RAISE EXCEPTION 'Out-of-order Pix callback regressed payment or erased its code.';
  END IF;
  v_webhook_result := public.registrar_inter_webhook_eventos(v_webhook,'homologacao','',v_event);
  IF (v_webhook_result->>'duplicados')::int<>1 THEN RAISE EXCEPTION 'Canonical webhook was not deduplicated.'; END IF;

END $test$;
ROLLBACK;
