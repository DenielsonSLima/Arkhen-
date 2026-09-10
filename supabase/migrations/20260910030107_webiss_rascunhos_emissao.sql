-- Emissão por rascunho: mesmo contrato de tentativa/lease do fluxo por cobrança.
BEGIN;
CREATE FUNCTION app_private.webiss_segredos_rascunho(p app_private.webiss_rascunhos) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.snapshot || jsonb_build_object('tentativaId',p.tentativa_id,'ambiente',p.ambiente,
    'certificadoBase64',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id=f.certificado_arquivo_secret_id),
    'certificadoSenha',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id=f.certificado_senha_secret_id))
  FROM public.configuracoes_integracao_fiscal f WHERE id=p.fiscal_config_id AND empresa_id=p.empresa_id;
$$;
CREATE FUNCTION public.obter_contexto_rascunho_webiss_edge(p_user_id uuid,p_rascunho_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE d app_private.webiss_rascunhos;
BEGIN
  SELECT * INTO d FROM app_private.webiss_rascunhos WHERE id=p_rascunho_id AND empresa_id=public.resolve_empresa_id_for_user(p_user_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Rascunho fora da empresa.'; END IF;
  RETURN jsonb_build_object('ambiente',d.ambiente,'rascunhoId',d.id);
END;
$$;
CREATE FUNCTION public.preparar_emissao_rascunho_webiss(p_user_id uuid,p_rascunho_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t uuid:=public.resolve_empresa_id_for_user(p_user_id); d app_private.webiss_rascunhos;
  f public.configuracoes_integracao_fiscal; rev jsonb; numero bigint; token uuid:=gen_random_uuid();
  cb public.financeiro_cobrancas;
BEGIN
  IF t IS NULL THEN RAISE EXCEPTION 'Usuario sem empresa vinculada.'; END IF;
  SELECT * INTO d FROM app_private.webiss_rascunhos WHERE id=p_rascunho_id AND empresa_id=t FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rascunho fora da empresa.'; END IF;
  IF d.status='confirmada' THEN RETURN jsonb_build_object('jaEmitida',true,'nfseId',d.numero_nfse,'ambiente',d.ambiente); END IF;
  IF d.status='processando' AND d.lease_ate>now() THEN RAISE EXCEPTION 'Tentativa em andamento; aguarde e consulte o RPS.'; END IF;
  IF d.status NOT IN ('rascunho','falha_pre_envio') THEN
    UPDATE app_private.webiss_rascunhos SET tentativa_id=token,status='processando',lease_ate=now()+interval '90 seconds',updated_at=now()
      WHERE id=d.id RETURNING * INTO d;
    RETURN app_private.webiss_segredos_rascunho(d)||jsonb_build_object('reconciliarPrimeiro',true);
  END IF;
  IF d.cobranca_id IS NOT NULL THEN
    SELECT * INTO cb FROM public.financeiro_cobrancas WHERE id=d.cobranca_id AND empresa_id=t FOR UPDATE;
    IF NOT FOUND OR cb.cliente_empresa_id<>d.cliente_id THEN RAISE EXCEPTION 'Cobranca nao corresponde ao rascunho.'; END IF;
    IF cb.status='Cancelado' THEN RAISE EXCEPTION 'Cobranca cancelada: revise o vinculo antes da emissao.'; END IF;
    IF cb.nfse_id IS NOT NULL AND d.ambiente='producao' THEN RAISE EXCEPTION 'Cobranca ja possui NFS-e de producao.'; END IF;
    IF EXISTS(SELECT 1 FROM app_private.webiss_emissoes WHERE cobranca_id=d.cobranca_id AND ambiente=d.ambiente) THEN
      RAISE EXCEPTION 'Cobranca ja possui tentativa no fluxo anterior. Consulte o RPS original.';
    END IF;
  END IF;
  SELECT * INTO f FROM public.configuracoes_integracao_fiscal WHERE id=d.fiscal_config_id AND empresa_id=t FOR UPDATE;
  rev:=app_private.webiss_revisar(d);
  IF (rev->>'ready')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'Revisao fiscal pendente: %',rev->'blockers'; END IF;
  numero:=d.rps_numero;
  IF numero IS NULL THEN
    IF coalesce(f.configuracao->>'proximoNumeroRps','')!~'^[1-9][0-9]{0,14}$' THEN RAISE EXCEPTION 'Configure proximo RPS valido.'; END IF;
    IF coalesce(f.configuracao->>'serieRps','')!~'^[A-Za-z0-9]{1,5}$' THEN RAISE EXCEPTION 'Configure serie RPS valida.'; END IF;
    numero:=(f.configuracao->>'proximoNumeroRps')::bigint;
    UPDATE public.configuracoes_integracao_fiscal SET configuracao=jsonb_set(jsonb_set(configuracao,
      '{ultimoNumeroRps}',to_jsonb(numero::text)),'{proximoNumeroRps}',to_jsonb((numero+1)::text)),updated_at=now() WHERE id=f.id;
  END IF;
  UPDATE app_private.webiss_rascunhos SET rps_numero=numero,rps_serie=coalesce(d.rps_serie,f.configuracao->>'serieRps'),
    tentativa_id=token,status='processando',lease_ate=now()+interval '90 seconds',mensagem=NULL,updated_at=now(),
    snapshot=jsonb_build_object('fiscalConfigId',f.id,'empresaId',t,'rascunhoId',d.id,'cobrancaId',d.cobranca_id,
      'ambiente',d.ambiente,'endpoint',rev->>'endpoint','prestador',rev->'prestador','tomador',rev->'tomador',
      'rps',jsonb_build_object('numero',numero,'serie',coalesce(d.rps_serie,f.configuracao->>'serieRps'),'tipo','1','data',d.dados->>'dataEmissao'),
      'servico',d.dados)
    WHERE id=d.id RETURNING * INTO d;
  RETURN app_private.webiss_segredos_rascunho(d)||jsonb_build_object('reconciliarPrimeiro',false);
END;
$$;
CREATE FUNCTION public.preparar_consulta_rascunho_webiss(p_user_id uuid,p_rascunho_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE d app_private.webiss_rascunhos;
BEGIN
  SELECT * INTO d FROM app_private.webiss_rascunhos WHERE id=p_rascunho_id AND empresa_id=public.resolve_empresa_id_for_user(p_user_id);
  IF NOT FOUND OR d.snapshot IS NULL THEN RAISE EXCEPTION 'Rascunho ainda nao possui RPS para consulta.'; END IF;
  IF d.status='confirmada' THEN RETURN jsonb_build_object('jaEmitida',true,'nfseId',d.numero_nfse,'ambiente',d.ambiente); END IF;
  RETURN app_private.webiss_segredos_rascunho(d)||jsonb_build_object('reconciliarPrimeiro',true);
END;
$$;
CREATE FUNCTION public.finalizar_tentativa_rascunho_webiss(p_user_id uuid,p_rascunho_id uuid,p_tentativa_id uuid,p_status text,p_mensagem text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('falha_pre_envio','rejeitada','incerta') THEN RAISE EXCEPTION 'Estado de tentativa invalido.'; END IF;
  UPDATE app_private.webiss_rascunhos SET status=p_status,mensagem=left(p_mensagem,2000),lease_ate=NULL,updated_at=now()
    WHERE id=p_rascunho_id AND empresa_id=public.resolve_empresa_id_for_user(p_user_id)
      AND tentativa_id=p_tentativa_id AND status='processando';
  IF NOT FOUND THEN RAISE EXCEPTION 'Tentativa substituida ou confirmada; consulte o RPS.'; END IF;
END;
$$;
CREATE FUNCTION public.confirmar_emissao_rascunho_webiss(p_user_id uuid,p_rascunho_id uuid,p_nfse_id text,p_protocolo text,p_payload jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d app_private.webiss_rascunhos; t uuid:=public.resolve_empresa_id_for_user(p_user_id); cb public.financeiro_cobrancas;
BEGIN
  IF t IS NULL OR coalesce(p_nfse_id,'')!~'^[0-9]{1,15}$' OR nullif(p_protocolo,'') IS NULL
    OR nullif(p_payload->>'xml','') IS NULL THEN RAISE EXCEPTION 'Confirmacao fiscal incompleta.'; END IF;
  SELECT * INTO d FROM app_private.webiss_rascunhos WHERE id=p_rascunho_id AND empresa_id=t
    AND tentativa_id=(p_payload->>'tentativaId')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tentativa substituida; consulte o RPS.'; END IF;
  IF d.status='confirmada' THEN
    IF d.numero_nfse<>p_nfse_id THEN RAISE EXCEPTION 'Numero diverge da confirmacao anterior.'; END IF;
    RETURN d.numero_nfse;
  END IF;
  IF d.cobranca_id IS NOT NULL AND d.ambiente='producao' THEN
    SELECT * INTO cb FROM public.financeiro_cobrancas WHERE id=d.cobranca_id AND empresa_id=t FOR UPDATE;
    IF NOT FOUND OR (cb.nfse_id IS NOT NULL AND cb.nfse_id<>p_nfse_id) THEN RAISE EXCEPTION 'Vinculo da cobranca divergente; reconciliar.'; END IF;
    UPDATE public.financeiro_cobrancas SET nfse_id=p_nfse_id,nfse_status='emitida',nfse_payload=p_payload,
      nfse_emitida_em=now(),updated_at=now() WHERE id=d.cobranca_id AND empresa_id=t;
  END IF;
  UPDATE app_private.webiss_rascunhos SET status='confirmada',numero_nfse=p_nfse_id,codigo_verificacao=p_protocolo,
    resultado=p_payload,emitida_em=nullif(p_payload->>'dataEmissao','')::timestamptz,
    lease_ate=NULL,mensagem=NULL,updated_at=now() WHERE id=d.id;
  INSERT INTO public.configuracoes_integracao_fiscal_logs(empresa_id,fiscal_config_id,usuario_id,operacao,numero_nfse,protocolo,status,mensagem,detalhes)
    VALUES(t,d.fiscal_config_id,p_user_id,'Emissão',p_nfse_id,p_protocolo,'Sucesso','NFS-e confirmada pelo WebISS.',
      p_payload||jsonb_build_object('ambiente',d.ambiente,'rascunhoId',d.id,'cobrancaId',d.cobranca_id));
  RETURN p_nfse_id;
END;
$$;
-- Legacy charge requests cannot bypass a draft attached to that same charge.
ALTER FUNCTION public.preparar_emissao_nfse_webiss(uuid,uuid) RENAME TO preparar_emissao_nfse_webiss_cobranca;
CREATE FUNCTION public.preparar_emissao_nfse_webiss(p_user_id uuid,p_cobranca_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.financeiro_cobrancas WHERE id=p_cobranca_id AND empresa_id=public.resolve_empresa_id_for_user(p_user_id) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cobranca fora da empresa.'; END IF;
  IF EXISTS(SELECT 1 FROM app_private.webiss_rascunhos WHERE cobranca_id=p_cobranca_id) THEN
    RAISE EXCEPTION 'Esta cobranca possui rascunho fiscal; use a revisao no Faturamento.';
  END IF;
  RETURN public.preparar_emissao_nfse_webiss_cobranca(p_user_id,p_cobranca_id);
END;
$$;
REVOKE ALL ON FUNCTION public.obter_contexto_rascunho_webiss_edge(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.obter_contexto_rascunho_webiss_edge(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION app_private.webiss_segredos_rascunho(app_private.webiss_rascunhos) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.preparar_emissao_rascunho_webiss(uuid,uuid),public.preparar_consulta_rascunho_webiss(uuid,uuid),
  public.finalizar_tentativa_rascunho_webiss(uuid,uuid,uuid,text,text),public.confirmar_emissao_rascunho_webiss(uuid,uuid,text,text,jsonb),
  public.preparar_emissao_nfse_webiss(uuid,uuid),public.preparar_emissao_nfse_webiss_cobranca(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.preparar_emissao_rascunho_webiss(uuid,uuid),public.preparar_consulta_rascunho_webiss(uuid,uuid),
  public.finalizar_tentativa_rascunho_webiss(uuid,uuid,uuid,text,text),public.confirmar_emissao_rascunho_webiss(uuid,uuid,text,text,jsonb),
  public.preparar_emissao_nfse_webiss(uuid,uuid),public.preparar_emissao_nfse_webiss_cobranca(uuid,uuid) TO service_role;
COMMIT;
