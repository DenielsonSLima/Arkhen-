-- Fila durável por competência; RPCs de execução exclusivas do worker.
BEGIN;
CREATE FUNCTION public.materializar_recorrencias_financeiras(p_ate date DEFAULT (now() AT TIME ZONE 'America/Maceio')::date) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.financeiro_configuracoes; mes date; limite date; row app_private.financeiro_recorrencia_execucoes; total integer:=0;
BEGIN
  IF p_ate IS NULL OR p_ate>(now() AT TIME ZONE 'America/Maceio')::date THEN RAISE EXCEPTION 'Nao antecipe processamento automatico.'; END IF;
  FOR c IN SELECT * FROM public.financeiro_configuracoes WHERE ativo AND recorrencia_ativa AND recorrencia_user_id IS NOT NULL ORDER BY id LOOP
    IF NOT app_private.recorrencia_user_can_manage(c.recorrencia_user_id,c.empresa_id) THEN CONTINUE; END IF;
    limite:=(date_trunc('month',p_ate)+make_interval(months=>(c.recorrencia_config->>'competenciaOffset')::integer))::date;
    FOR mes IN SELECT gs::date FROM generate_series((c.recorrencia_config->>'primeiraCompetencia')::date,limite,interval '1 month') gs LOOP
      IF make_date(extract(year from (mes-make_interval(months=>(c.recorrencia_config->>'competenciaOffset')::integer)))::integer,
        extract(month from (mes-make_interval(months=>(c.recorrencia_config->>'competenciaOffset')::integer)))::integer,
        (c.recorrencia_config->>'diaProcessamento')::integer)>p_ate THEN CONTINUE; END IF;
      IF NOT EXISTS(SELECT 1 FROM app_private.financeiro_recorrencia_execucoes WHERE empresa_id=c.empresa_id AND contrato_id=c.id AND competencia=mes) THEN
        row:=app_private.enfileirar_recorrencia(c.id,mes,false); total:=total+1;
        IF total>=100 THEN RETURN total; END IF;
      END IF;
    END LOOP;
  END LOOP;
  RETURN total;
END;
$$;
CREATE FUNCTION public.reivindicar_execucao_recorrencia(p_execucao_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e app_private.financeiro_recorrencia_execucoes; c public.financeiro_configuracoes;
BEGIN
  UPDATE app_private.financeiro_recorrencia_execucoes SET status='erro',mensagem='Vencimento ultrapassado antes da cobranca; revise a competencia antes de emitir.',proxima_tentativa='infinity'::timestamptz,updated_at=now()
    WHERE etapa='cobranca' AND status IN ('pendente','erro') AND data_vencimento<(now() AT TIME ZONE 'America/Maceio')::date
      AND NOT EXISTS(SELECT 1 FROM public.inter_cobranca_tentativas i WHERE i.empresa_id=financeiro_recorrencia_execucoes.empresa_id AND i.request_id=financeiro_recorrencia_execucoes.request_id::text);
  SELECT j.* INTO e FROM app_private.financeiro_recorrencia_execucoes j JOIN public.financeiro_configuracoes cfg ON cfg.id=j.contrato_id AND cfg.empresa_id=j.empresa_id
    WHERE (p_execucao_id IS NULL OR j.id=p_execucao_id) AND cfg.ativo AND (j.manual OR cfg.recorrencia_ativa)
      AND app_private.recorrencia_user_can_manage(j.usuario_id,j.empresa_id)
      AND (j.manual OR j.data_processamento<=(now() AT TIME ZONE 'America/Maceio')::date)
      AND (j.status IN ('pendente','erro','aguardando_pagamento') OR (j.status='processando' AND j.lease_ate<now()))
      AND j.proxima_tentativa<=now()
      AND (j.etapa NOT IN ('rascunho','fiscal') OR j.snapshot#>>'{config,modoFiscal}'<>'no_pagamento' OR EXISTS(
        SELECT 1 FROM public.financeiro_cobrancas cb WHERE cb.id=j.cobranca_id AND cb.empresa_id=j.empresa_id AND cb.status='Pago'))
    ORDER BY j.data_processamento,j.created_at LIMIT 1 FOR UPDATE OF j SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE app_private.financeiro_recorrencia_execucoes SET status='processando',lease_token=gen_random_uuid(),lease_ate=now()+interval '180 seconds',
    tentativas=tentativas+1,mensagem=NULL,updated_at=now() WHERE id=e.id RETURNING * INTO e;
  RETURN app_private.recorrencia_dto(e);
END;
$$;
CREATE FUNCTION public.preparar_rascunho_recorrencia(p_execucao_id uuid,p_lease_token uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e app_private.financeiro_recorrencia_execucoes; d app_private.webiss_rascunhos; f public.configuracoes_integracao_fiscal; p jsonb;
BEGIN
  SELECT * INTO e FROM app_private.financeiro_recorrencia_execucoes WHERE id=p_execucao_id AND lease_token=p_lease_token AND status='processando' AND etapa='rascunho' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lease de recorrencia indisponivel.'; END IF;
  p:=e.snapshot->'fiscalPayload';
  IF NOT EXISTS(SELECT 1 FROM app_private.webiss_rascunhos WHERE id=e.id) THEN
    p:=jsonb_set(p,'{dados,dataEmissao}',to_jsonb((now() AT TIME ZONE 'America/Maceio')::date::text));
    UPDATE app_private.financeiro_recorrencia_execucoes SET snapshot=jsonb_set(snapshot,'{fiscalPayload}',p) WHERE id=e.id;
  END IF;
  SELECT * INTO f FROM public.configuracoes_integracao_fiscal WHERE id=(p->>'fiscalConfigId')::uuid AND empresa_id=e.empresa_id AND cliente_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contexto fiscal da recorrencia indisponivel.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=(p->>'clienteId')::uuid AND empresa_id=e.empresa_id) THEN RAISE EXCEPTION 'Cliente da recorrencia indisponivel.'; END IF;
  IF e.cobranca_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.financeiro_cobrancas WHERE id=e.cobranca_id AND empresa_id=e.empresa_id AND cliente_empresa_id=(p->>'clienteId')::uuid AND status<>'Cancelado') THEN RAISE EXCEPTION 'Cobranca da recorrencia indisponivel.'; END IF;
  INSERT INTO app_private.webiss_rascunhos(id,empresa_id,fiscal_config_id,cliente_id,cobranca_id,ambiente,dados,origem)
    VALUES(e.id,e.empresa_id,f.id,(p->>'clienteId')::uuid,e.cobranca_id,p->>'ambiente',p->'dados',
      jsonb_build_object('tipo','recorrencia','execucaoId',e.id,'contratoId',e.contrato_id,'competencia',e.competencia)) ON CONFLICT(id) DO NOTHING;
  SELECT * INTO d FROM app_private.webiss_rascunhos WHERE id=e.id;
  IF d.empresa_id<>e.empresa_id OR d.cobranca_id IS DISTINCT FROM e.cobranca_id OR d.cliente_id<>(p->>'clienteId')::uuid THEN RAISE EXCEPTION 'Rascunho diverge da recorrencia.'; END IF;
  RETURN jsonb_build_object('rascunhoId',d.id);
END;
$$;
CREATE FUNCTION public.finalizar_etapa_recorrencia(p_execucao_id uuid,p_lease_token uuid,p_resultado jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e app_private.financeiro_recorrencia_execucoes; cb public.financeiro_cobrancas; d app_private.webiss_rascunhos; modo text;
BEGIN
  SELECT * INTO e FROM app_private.financeiro_recorrencia_execucoes WHERE id=p_execucao_id AND lease_token=p_lease_token AND status='processando' FOR UPDATE;
  IF NOT FOUND OR e.etapa IS DISTINCT FROM p_resultado->>'etapa' THEN RAISE EXCEPTION 'Lease ou etapa da recorrencia indisponivel.'; END IF;
  modo:=e.snapshot#>>'{config,modoFiscal}';
  IF e.etapa='cobranca' THEN
    SELECT * INTO cb FROM public.financeiro_cobrancas WHERE id=(p_resultado->>'cobrancaId')::uuid AND empresa_id=e.empresa_id AND contrato_id=e.contrato_id;
    IF NOT FOUND OR cb.cliente_empresa_id::text IS DISTINCT FROM e.snapshot#>>'{chargePayload,cliente_empresa_id}' OR cb.data_vencimento<>e.data_vencimento THEN RAISE EXCEPTION 'Cobranca retornada diverge da competencia.'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.inter_cobranca_tentativas WHERE empresa_id=e.empresa_id AND request_id=e.request_id::text AND cobranca_id=cb.id) THEN RAISE EXCEPTION 'Cobranca sem identidade da tentativa recorrente.'; END IF;
    e.cobranca_id:=cb.id; e.etapa:=CASE WHEN modo='sem_nfse' THEN 'concluida' ELSE 'rascunho' END;
    e.status:=CASE WHEN e.etapa='concluida' THEN 'concluida' WHEN modo='no_pagamento' THEN 'aguardando_pagamento' ELSE 'pendente' END;
  ELSIF e.etapa='rascunho' THEN
    SELECT * INTO d FROM app_private.webiss_rascunhos WHERE id=(p_resultado->>'rascunhoId')::uuid AND id=e.id AND empresa_id=e.empresa_id;
    IF NOT FOUND OR d.cobranca_id IS DISTINCT FROM e.cobranca_id THEN RAISE EXCEPTION 'Rascunho retornado fora da recorrencia.'; END IF;
    e.rascunho_id:=d.id; e.etapa:=CASE WHEN modo='rascunho' THEN 'concluida' ELSE 'fiscal' END;
    e.status:=CASE WHEN modo='rascunho' THEN 'aguardando_revisao' WHEN modo='no_pagamento' THEN 'aguardando_pagamento' ELSE 'pendente' END;
  ELSIF e.etapa='fiscal' THEN
    SELECT * INTO d FROM app_private.webiss_rascunhos WHERE id=e.rascunho_id AND empresa_id=e.empresa_id AND status='confirmada' AND coalesce(resultado->>'situacao','confirmada')='confirmada';
    IF NOT FOUND OR d.numero_nfse IS DISTINCT FROM p_resultado->>'nfseId' THEN RAISE EXCEPTION 'NFS-e ainda nao confirmada na recorrencia.'; END IF;
    e.numero_nfse:=d.numero_nfse; e.etapa:='concluida'; e.status:='concluida';
  ELSE RAISE EXCEPTION 'Etapa nao executavel.';
  END IF;
  UPDATE app_private.financeiro_recorrencia_execucoes SET etapa=e.etapa,status=e.status,cobranca_id=e.cobranca_id,
    rascunho_id=e.rascunho_id,numero_nfse=e.numero_nfse,lease_token=NULL,lease_ate=NULL,mensagem=NULL,proxima_tentativa=now(),updated_at=now()
    WHERE id=e.id RETURNING * INTO e;
  RETURN app_private.recorrencia_dto(e);
END;
$$;
CREATE FUNCTION public.falhar_execucao_recorrencia(p_execucao_id uuid,p_lease_token uuid,p_mensagem text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  UPDATE app_private.financeiro_recorrencia_execucoes SET status='erro',mensagem=left(p_mensagem,1000),lease_token=NULL,lease_ate=NULL,
    proxima_tentativa=now()+interval '15 minutes',updated_at=now() WHERE id=p_execucao_id AND lease_token=p_lease_token AND status='processando';
  IF NOT FOUND THEN RAISE EXCEPTION 'Lease de recorrencia substituido; consulte o resultado.'; END IF;
END;
$$;
CREATE FUNCTION public.autorizar_execucao_recorrencia(p_execucao_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_empresa_id(); e app_private.financeiro_recorrencia_execucoes;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.current_user_has_permission(t,'faturamento:manage') OR public.current_user_has_permission(t,'financeiro:manage')) THEN RAISE EXCEPTION 'Permissao financeira necessaria.' USING ERRCODE='42501'; END IF;
  SELECT * INTO e FROM app_private.financeiro_recorrencia_execucoes WHERE id=p_execucao_id AND empresa_id=t FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Execucao fora da empresa.'; END IF;
  IF e.status='erro' THEN UPDATE app_private.financeiro_recorrencia_execucoes SET proxima_tentativa=now() WHERE id=e.id; END IF;
  RETURN jsonb_build_object('id',e.id,'empresaId',e.empresa_id);
END;
$$;
CREATE FUNCTION public.obter_configuracao_recorrencia(p_contrato_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_empresa_id(); c public.financeiro_configuracoes;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.current_user_has_permission(t,'faturamento:manage') OR public.current_user_has_permission(t,'financeiro:manage')) THEN RAISE EXCEPTION 'Permissao financeira necessaria.' USING ERRCODE='42501'; END IF;
  SELECT * INTO c FROM public.financeiro_configuracoes WHERE id=p_contrato_id AND empresa_id=t;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato fora da empresa.'; END IF;
  RETURN jsonb_build_object('id',c.id,'clienteEmpresaId',c.cliente_empresa_id,'descricaoServico',c.descricao_servico,'valorMensal',c.valor_mensal,
    'diaVencimento',c.dia_vencimento,'ativo',c.ativo,'automacaoAtiva',c.recorrencia_ativa,'config',c.recorrencia_config);
END;
$$;
CREATE FUNCTION public.pausar_recorrencia_financeira(p_contrato_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_empresa_id();
BEGIN
  IF auth.uid() IS NULL OR NOT (public.current_user_has_permission(t,'faturamento:manage') OR public.current_user_has_permission(t,'financeiro:manage')) THEN RAISE EXCEPTION 'Permissao financeira necessaria.' USING ERRCODE='42501'; END IF;
  UPDATE public.financeiro_configuracoes SET recorrencia_ativa=false,updated_at=now() WHERE id=p_contrato_id AND empresa_id=t;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato fora da empresa.'; END IF;
END;
$$;
-- Escrita direta via Data API não pode ativar agendamento nem trocar a identidade autorizadora.
CREATE FUNCTION app_private.proteger_configuracao_recorrencia() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF current_user NOT IN ('postgres','supabase_admin') AND (
    (TG_OP='INSERT' AND (NEW.recorrencia_ativa OR NEW.recorrencia_config<>'{}'::jsonb OR NEW.recorrencia_user_id IS NOT NULL)) OR
    (TG_OP='UPDATE' AND (OLD.recorrencia_config<>'{}'::jsonb OR NEW.recorrencia_config<>'{}'::jsonb OR NEW.recorrencia_ativa IS DISTINCT FROM OLD.recorrencia_ativa OR NEW.recorrencia_user_id IS DISTINCT FROM OLD.recorrencia_user_id))) THEN
    RAISE EXCEPTION 'Use a operacao autorizada de recorrencia.' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER proteger_configuracao_recorrencia BEFORE INSERT OR UPDATE ON public.financeiro_configuracoes FOR EACH ROW EXECUTE FUNCTION app_private.proteger_configuracao_recorrencia();
REVOKE ALL ON FUNCTION app_private.proteger_configuracao_recorrencia() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.materializar_recorrencias_financeiras(date),public.reivindicar_execucao_recorrencia(uuid),public.preparar_rascunho_recorrencia(uuid,uuid),
  public.finalizar_etapa_recorrencia(uuid,uuid,jsonb),public.falhar_execucao_recorrencia(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.materializar_recorrencias_financeiras(date),public.reivindicar_execucao_recorrencia(uuid),public.preparar_rascunho_recorrencia(uuid,uuid),
  public.finalizar_etapa_recorrencia(uuid,uuid,jsonb),public.falhar_execucao_recorrencia(uuid,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.autorizar_execucao_recorrencia(uuid),public.obter_configuracao_recorrencia(uuid),public.pausar_recorrencia_financeira(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.autorizar_execucao_recorrencia(uuid),public.obter_configuracao_recorrencia(uuid),public.pausar_recorrencia_financeira(uuid) TO authenticated;

-- O editor legado não pode contornar a autorização/contrato da recorrência nova.
ALTER FUNCTION public.salvar_contrato_financeiro(jsonb) RENAME TO salvar_contrato_financeiro_legado;
CREATE FUNCTION public.salvar_contrato_financeiro(p_payload jsonb) RETURNS public.financeiro_configuracoes
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_empresa_id();
BEGIN
  IF auth.uid() IS NULL OR NOT (public.current_user_has_permission(t,'faturamento:manage') OR public.current_user_has_permission(t,'financeiro:manage')) THEN RAISE EXCEPTION 'Permissao financeira necessaria.' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM public.financeiro_configuracoes WHERE id=nullif(p_payload->>'id','')::uuid AND empresa_id=t AND recorrencia_config<>'{}'::jsonb) THEN
    RAISE EXCEPTION 'Edite este contrato na configuracao da recorrencia para preservar as condicoes programadas.'; END IF;
  RETURN public.salvar_contrato_financeiro_legado(p_payload);
END;
$$;
REVOKE ALL ON FUNCTION public.salvar_contrato_financeiro_legado(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.salvar_contrato_financeiro(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.salvar_contrato_financeiro(jsonb) TO authenticated;
COMMIT;
