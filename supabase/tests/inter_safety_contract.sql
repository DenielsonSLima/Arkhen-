-- Read-only assertions after the Inter safety migrations.
BEGIN;
SET TRANSACTION READ ONLY;
DO $test$
DECLARE v_proc regprocedure; v_signature text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.preparar_inter_webhook(uuid,text,text)',
    'public.registrar_inter_webhook_eventos(uuid,text,text,jsonb)',
    'public.preparar_tentativa_cobranca_inter(uuid,jsonb)',
    'public.iniciar_envio_tentativa_cobranca_inter(uuid,uuid,uuid)',
    'public.liberar_preparo_tentativa_cobranca_inter(uuid,uuid,uuid)',
    'public.registrar_resultado_tentativa_cobranca_inter(uuid,uuid,jsonb,uuid)',
    'public.confirmar_tentativa_cobranca_inter(uuid,uuid)',
    'public.registrar_cancelamento_pendente_cobranca_inter(uuid,uuid,text,jsonb)',
    'public.confirmar_cancelamento_cobranca_inter(uuid,uuid,text,jsonb)'
  ] LOOP
    v_proc := to_regprocedure(v_signature);
    IF v_proc IS NULL THEN RAISE EXCEPTION 'Missing RPC: %',v_signature; END IF;
    IF has_function_privilege('anon',v_proc,'EXECUTE')
      OR has_function_privilege('authenticated',v_proc,'EXECUTE')
      OR NOT has_function_privilege('service_role',v_proc,'EXECUTE') THEN
      RAISE EXCEPTION 'Unsafe RPC access: %',v_signature;
    END IF;
  END LOOP;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.inter_cobranca_tentativas'::regclass)
    OR has_table_privilege('anon','public.inter_cobranca_tentativas','SELECT')
    OR has_table_privilege('authenticated','public.inter_cobranca_tentativas','SELECT') THEN
    RAISE EXCEPTION 'Attempt table must be private and protected by RLS.';
  END IF;
  IF public.map_inter_charge_status('CONCLUIDA') <> 'Pago'
    OR public.map_inter_charge_status('RECEBIDO') <> 'Pago'
    OR public.map_inter_charge_status('NAO_RECEBIDO') <> 'Pendente'
    OR public.map_inter_charge_status('CANCELAMENTO_SOLICITADO') <> 'Pendente'
    OR public.map_inter_charge_status('EXPIRADO') <> 'Pendente'
    OR public.map_inter_charge_status('REMOVIDA_PELO_USUARIO_RECEBEDOR') <> 'Cancelado' THEN
    RAISE EXCEPTION 'Status mapping accepted substring or lost final Pix state.';
  END IF;
END $test$;
ROLLBACK;
