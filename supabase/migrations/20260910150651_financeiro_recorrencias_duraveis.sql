-- Fundação opt-in. Nenhum contrato legado é ativado, cobrado ou transmitido.
BEGIN;
ALTER TABLE public.financeiro_configuracoes
  ADD COLUMN recorrencia_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN recorrencia_ativa boolean NOT NULL DEFAULT false,
  ADD COLUMN recorrencia_user_id uuid REFERENCES auth.users(id);

CREATE TABLE app_private.financeiro_recorrencia_requests (
  empresa_id uuid NOT NULL REFERENCES public.empresas(id), request_id uuid NOT NULL,
  usuario_id uuid NOT NULL REFERENCES auth.users(id), payload jsonb NOT NULL,
  contrato_id uuid NOT NULL REFERENCES public.financeiro_configuracoes(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(empresa_id,request_id)
);
CREATE TABLE app_private.financeiro_recorrencia_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  contrato_id uuid NOT NULL REFERENCES public.financeiro_configuracoes(id) ON DELETE RESTRICT,
  usuario_id uuid NOT NULL REFERENCES auth.users(id), competencia date NOT NULL,
  data_processamento date NOT NULL, data_vencimento date NOT NULL,
  manual boolean NOT NULL DEFAULT false, request_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  snapshot jsonb NOT NULL,
  etapa text NOT NULL CHECK(etapa IN ('cobranca','rascunho','fiscal','concluida')),
  status text NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','processando','erro','aguardando_pagamento','aguardando_revisao','concluida')),
  cobranca_id uuid REFERENCES public.financeiro_cobrancas(id), rascunho_id uuid REFERENCES app_private.webiss_rascunhos(id),
  numero_nfse text, lease_token uuid, lease_ate timestamptz, tentativas integer NOT NULL DEFAULT 0,
  proxima_tentativa timestamptz NOT NULL DEFAULT now(), mensagem text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id,contrato_id,competencia), CHECK(competencia=date_trunc('month',competencia)::date)
);
CREATE INDEX financeiro_recorrencia_fila ON app_private.financeiro_recorrencia_execucoes(status,proxima_tentativa,data_processamento);
ALTER TABLE app_private.financeiro_recorrencia_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.financeiro_recorrencia_execucoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.financeiro_recorrencia_requests,app_private.financeiro_recorrencia_execucoes FROM PUBLIC,anon,authenticated;

-- O worker revalida a identidade que autorizou a recorrência a cada etapa.
CREATE FUNCTION app_private.recorrencia_user_can_manage(p_user uuid,p_empresa uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT coalesce(public.resolve_empresa_id_for_user(p_user)=p_empresa AND (
    EXISTS(SELECT 1 FROM public.perfis WHERE user_id=p_user AND empresa_id=p_empresa AND ativo AND papel='admin') OR
    EXISTS(SELECT 1 FROM public.configuracoes_usuarios u JOIN public.configuracoes_perfis_acesso a
      ON a.empresa_id=u.empresa_id AND a.ativo AND (a.id=u.perfil_acesso_id OR (u.perfil_acesso_id IS NULL AND lower(a.nome)=lower(u.perfil)))
      WHERE u.auth_user_id=p_user AND u.empresa_id=p_empresa AND u.status='Ativo'
        AND a.permissoes && ARRAY['faturamento:manage','financeiro:manage']::text[])),false);
$$;
CREATE FUNCTION app_private.recorrencia_dto(p app_private.financeiro_recorrencia_execucoes) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT jsonb_build_object('id',p.id,'empresaId',p.empresa_id,'contratoId',p.contrato_id,'userId',p.usuario_id,
    'competencia',p.competencia,'dataProcessamento',p.data_processamento,'dataVencimento',p.data_vencimento,
    'requestId',p.request_id,'etapa',p.etapa,'status',p.status,'cobrancaId',p.cobranca_id,'rascunhoId',p.rascunho_id,
    'nfseId',p.numero_nfse,'leaseToken',p.lease_token,'mensagem',p.mensagem,
    'modoFiscal',p.snapshot#>>'{config,modoFiscal}','ambiente',p.snapshot#>>'{config,ambiente}',
    'chargePayload',p.snapshot->'chargePayload','fiscalPayload',p.snapshot->'fiscalPayload');
$$;
CREATE FUNCTION app_private.recorrencia_validar_config(p jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE k text; n numeric;
BEGIN
  IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR octet_length(p::text)>32768 THEN RAISE EXCEPTION 'Configuracao de recorrencia invalida.'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p) keys(key) WHERE keys.key<>ALL(ARRAY['meioPagamento','descontoPercentual','jurosPercentual','multaPercentual',
    'mensagemBoleto','competenciaOffset','diaProcessamento','primeiraCompetencia','gerarCobranca','modoFiscal','fiscalConfigId','ambiente','dadosFiscais'])) THEN
    RAISE EXCEPTION 'Configuracao possui campos desconhecidos.'; END IF;
  IF coalesce(p->>'meioPagamento','') NOT IN ('Pix','Boleto','Ambos') THEN RAISE EXCEPTION 'Informe forma de pagamento.'; END IF;
  IF coalesce(p->>'competenciaOffset','') NOT IN ('0','-1') THEN RAISE EXCEPTION 'Informe competencia atual ou anterior.'; END IF;
  IF coalesce(p->>'diaProcessamento','') !~ '^([1-9]|1[0-9]|2[0-8])$' THEN RAISE EXCEPTION 'Dia de processamento deve ser de 1 a 28.'; END IF;
  IF coalesce(p->>'primeiraCompetencia','') !~ '^\d{4}-(0[1-9]|1[0-2])-01$' THEN RAISE EXCEPTION 'Informe primeira competencia no formato AAAA-MM-01.'; END IF;
  PERFORM (p->>'primeiraCompetencia')::date;
  IF coalesce(p->>'modoFiscal','') NOT IN ('sem_nfse','rascunho','na_data','no_pagamento') THEN RAISE EXCEPTION 'Modo fiscal invalido.'; END IF;
  IF jsonb_typeof(p->'gerarCobranca') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Informe se a recorrencia gera cobranca.'; END IF;
  IF (p->>'modoFiscal'='no_pagamento') AND NOT (p->>'gerarCobranca')::boolean THEN RAISE EXCEPTION 'Emissao no pagamento exige cobranca.'; END IF;
  IF NOT (p->>'gerarCobranca')::boolean AND p->>'modoFiscal'='sem_nfse' THEN RAISE EXCEPTION 'Escolha cobranca ou rascunho fiscal.'; END IF;
  FOREACH k IN ARRAY ARRAY['descontoPercentual','jurosPercentual','multaPercentual'] LOOP
    IF coalesce(p->>k,'')!~'^\d+(\.\d{1,4})?$' THEN RAISE EXCEPTION 'Percentual invalido: %',k; END IF;
    n:=(p->>k)::numeric; IF n<0 OR n>100 THEN RAISE EXCEPTION 'Percentual fora do intervalo: %',k; END IF;
  END LOOP;
  IF length(coalesce(p->>'mensagemBoleto',''))>220 THEN RAISE EXCEPTION 'Mensagem do boleto excede 220 caracteres.'; END IF;
  IF p->>'modoFiscal'<>'sem_nfse' THEN
    IF coalesce(p->>'ambiente','') NOT IN ('homologacao','producao') OR nullif(p->>'fiscalConfigId','') IS NULL THEN RAISE EXCEPTION 'Informe contexto e ambiente fiscal.'; END IF;
    IF jsonb_typeof(p->'dadosFiscais') IS DISTINCT FROM 'object' OR app_private.webiss_dados_permitidos(p->'dadosFiscais') IS DISTINCT FROM p->'dadosFiscais' THEN
      RAISE EXCEPTION 'Dados fiscais contem campos nao suportados.'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_each(p->'dadosFiscais') kv WHERE jsonb_typeof(value)<>'string' AND NOT (key IN ('valor','aliquotaIss') AND jsonb_typeof(value)='number')) THEN
      RAISE EXCEPTION 'Dados fiscais devem conter textos ou valores numericos suportados.'; END IF;
  END IF;
  RETURN p;
END;
$$;
CREATE FUNCTION app_private.enfileirar_recorrencia(p_contrato uuid,p_competencia date,p_manual boolean DEFAULT false)
RETURNS app_private.financeiro_recorrencia_execucoes LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.financeiro_configuracoes; cfg jsonb; ref date; venc date; proc date; descricao text; fiscal jsonb; row app_private.financeiro_recorrencia_execucoes;
BEGIN
  SELECT * INTO c FROM public.financeiro_configuracoes WHERE id=p_contrato FOR UPDATE;
  IF NOT FOUND OR NOT c.ativo THEN RAISE EXCEPTION 'Contrato inativo ou ausente.'; END IF;
  cfg:=app_private.recorrencia_validar_config(c.recorrencia_config);
  IF p_competencia IS NULL OR date_trunc('month',p_competencia)::date<>p_competencia THEN RAISE EXCEPTION 'Competencia invalida.'; END IF;
  ref:=(p_competencia-make_interval(months=>(cfg->>'competenciaOffset')::integer))::date;
  proc:=make_date(extract(year from ref)::integer,extract(month from ref)::integer,(cfg->>'diaProcessamento')::integer);
  venc:=make_date(extract(year from ref)::integer,extract(month from ref)::integer,c.dia_vencimento);
  descricao:=replace(replace(replace(replace(c.descricao_servico,'[MES]',to_char(p_competencia,'MM')),'[ANO]',to_char(p_competencia,'YYYY')),
    '[COMPETENCIA]',to_char(p_competencia,'MM/YYYY')),'[MES_ATUAL]',to_char(p_competencia,'MM/YYYY'));
  fiscal:=coalesce(cfg->'dadosFiscais','{}'::jsonb)||jsonb_build_object('competencia',p_competencia::text,'dataEmissao',proc::text,'valor',c.valor_mensal::text,'descricao',descricao);
  INSERT INTO app_private.financeiro_recorrencia_execucoes(empresa_id,contrato_id,usuario_id,competencia,data_processamento,data_vencimento,manual,etapa,snapshot)
    VALUES(c.empresa_id,c.id,c.recorrencia_user_id,p_competencia,proc,venc,p_manual,
      CASE WHEN (cfg->>'gerarCobranca')::boolean THEN 'cobranca' ELSE 'rascunho' END,
      jsonb_build_object('config',cfg,'chargePayload',jsonb_build_object('cliente_empresa_id',c.cliente_empresa_id,'contrato_id',c.id,
        'valor',c.valor_mensal,'data_vencimento',venc,'descricao',descricao,'categoria','Faturamento recorrente','meio_pagamento',cfg->>'meioPagamento',
        'desconto_percentual',(cfg->>'descontoPercentual')::numeric,'juros_percentual',(cfg->>'jurosPercentual')::numeric,
        'multa_percentual',(cfg->>'multaPercentual')::numeric,'mensagem_boleto',coalesce(cfg->>'mensagemBoleto','')),
        'fiscalPayload',jsonb_build_object('fiscalConfigId',cfg->>'fiscalConfigId','clienteId',c.cliente_empresa_id,'ambiente',cfg->>'ambiente','dados',fiscal)))
    ON CONFLICT(empresa_id,contrato_id,competencia) DO NOTHING;
  SELECT * INTO row FROM app_private.financeiro_recorrencia_execucoes WHERE empresa_id=c.empresa_id AND contrato_id=c.id AND competencia=p_competencia;
  RETURN row;
END;
$$;
CREATE FUNCTION public.salvar_recorrencia_financeira(p_request_id uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_empresa_id(); u uuid:=auth.uid(); c public.financeiro_configuracoes;
  req app_private.financeiro_recorrencia_requests; cfg jsonb; f public.configuracoes_integracao_fiscal;
  ex app_private.financeiro_recorrencia_execucoes; cid uuid:=nullif(p_payload->>'id','')::uuid;
BEGIN
  IF t IS NULL OR u IS NULL OR NOT (public.current_user_has_permission(t,'faturamento:manage') OR public.current_user_has_permission(t,'financeiro:manage')) THEN
    RAISE EXCEPTION 'Permissao financeira necessaria.' USING ERRCODE='42501'; END IF;
  IF p_request_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR octet_length(p_payload::text)>49152 THEN RAISE EXCEPTION 'Requisicao de contrato invalida.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(t::text||p_request_id::text,0));
  SELECT * INTO req FROM app_private.financeiro_recorrencia_requests WHERE empresa_id=t AND request_id=p_request_id;
  IF FOUND THEN
    IF req.payload IS DISTINCT FROM p_payload OR req.usuario_id<>u THEN RAISE EXCEPTION 'Referencia de salvamento ja usada com outros dados.'; END IF;
    SELECT * INTO c FROM public.financeiro_configuracoes WHERE id=req.contrato_id AND empresa_id=t;
    SELECT * INTO ex FROM app_private.financeiro_recorrencia_execucoes WHERE contrato_id=c.id AND empresa_id=t AND manual ORDER BY created_at LIMIT 1;
    RETURN jsonb_build_object('contrato',to_jsonb(c),'execucao',CASE WHEN ex.id IS NULL THEN NULL ELSE app_private.recorrencia_dto(ex) END);
  END IF;
  cfg:=app_private.recorrencia_validar_config(p_payload->'config');
  IF (cfg->>'primeiraCompetencia')::date<(date_trunc('month',now())-interval '12 months')::date
    AND NOT EXISTS(SELECT 1 FROM public.financeiro_configuracoes WHERE id=cid AND empresa_id=t AND recorrencia_config->>'primeiraCompetencia'=cfg->>'primeiraCompetencia') THEN
    RAISE EXCEPTION 'Primeira competencia retroativa limitada a 12 meses; revise os periodos anteriores separadamente.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=(p_payload->>'clienteEmpresaId')::uuid AND empresa_id=t) THEN RAISE EXCEPTION 'Cliente fora da empresa.'; END IF;
  IF coalesce(p_payload->>'valorMensal','')!~'^\d+(\.\d{1,2})?$' OR (p_payload->>'valorMensal')::numeric<=0 THEN RAISE EXCEPTION 'Valor mensal invalido.'; END IF;
  IF coalesce(p_payload->>'diaVencimento','')!~'^([1-9]|1[0-9]|2[0-8])$' THEN RAISE EXCEPTION 'Dia de vencimento deve ser 1 a 28.'; END IF;
  IF nullif(trim(p_payload->>'descricaoServico'),'') IS NULL OR length(p_payload->>'descricaoServico')>2000 THEN RAISE EXCEPTION 'Descricao do contrato invalida.'; END IF;
  IF cfg->>'modoFiscal'<>'sem_nfse' THEN
    SELECT * INTO f FROM public.configuracoes_integracao_fiscal WHERE id=(cfg->>'fiscalConfigId')::uuid AND empresa_id=t
      AND cliente_id IS NULL AND lower(provedor)='webiss' AND uf='SE' AND lower(trim(municipio))='itabaiana';
    IF NOT FOUND THEN RAISE EXCEPTION 'Selecione o contexto WebISS do escritorio.'; END IF;
  END IF;
  IF cid IS NULL THEN
    INSERT INTO public.financeiro_configuracoes(empresa_id,cliente_empresa_id,descricao_servico,valor_mensal,dia_vencimento,
      emissao_automatica_nfse,ativo,recorrencia_config,recorrencia_ativa,recorrencia_user_id)
      VALUES(t,(p_payload->>'clienteEmpresaId')::uuid,p_payload->>'descricaoServico',(p_payload->>'valorMensal')::numeric,
        (p_payload->>'diaVencimento')::integer,false,true,cfg,coalesce((p_payload->>'automacaoAtiva')::boolean,false),u) RETURNING * INTO c;
  ELSE
    SELECT * INTO c FROM public.financeiro_configuracoes WHERE id=cid AND empresa_id=t FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Contrato fora da empresa.'; END IF;
    IF c.cliente_empresa_id<>(p_payload->>'clienteEmpresaId')::uuid AND EXISTS(SELECT 1 FROM app_private.financeiro_recorrencia_execucoes WHERE contrato_id=cid) THEN RAISE EXCEPTION 'Nao altere o cliente de contrato com competencias geradas.'; END IF;
    UPDATE public.financeiro_configuracoes SET descricao_servico=p_payload->>'descricaoServico',valor_mensal=(p_payload->>'valorMensal')::numeric,
      dia_vencimento=(p_payload->>'diaVencimento')::integer,cliente_empresa_id=(p_payload->>'clienteEmpresaId')::uuid,recorrencia_config=cfg,
      recorrencia_ativa=coalesce((p_payload->>'automacaoAtiva')::boolean,false),recorrencia_user_id=u,updated_at=now()
      WHERE id=cid RETURNING * INTO c;
  END IF;
  INSERT INTO app_private.financeiro_recorrencia_requests(empresa_id,request_id,usuario_id,payload,contrato_id) VALUES(t,p_request_id,u,p_payload,c.id);
  IF coalesce((p_payload->>'gerarPrimeiraCobranca')::boolean,false) THEN
    ex:=app_private.enfileirar_recorrencia(c.id,(cfg->>'primeiraCompetencia')::date,true);
  END IF;
  RETURN jsonb_build_object('contrato',to_jsonb(c),'execucao',CASE WHEN ex.id IS NULL THEN NULL ELSE app_private.recorrencia_dto(ex) END);
END;
$$;
CREATE FUNCTION public.listar_execucoes_recorrencia(p_contrato_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_empresa_id(); result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.current_user_has_permission(t,'faturamento:manage') OR public.current_user_has_permission(t,'financeiro:manage')) THEN RAISE EXCEPTION 'Permissao financeira necessaria.' USING ERRCODE='42501'; END IF;
  SELECT coalesce(jsonb_agg(app_private.recorrencia_dto(x)-'leaseToken' ORDER BY x.competencia DESC),'[]'::jsonb) INTO result
    FROM (SELECT * FROM app_private.financeiro_recorrencia_execucoes WHERE empresa_id=t AND (p_contrato_id IS NULL OR contrato_id=p_contrato_id) ORDER BY competencia DESC LIMIT 200) x;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION app_private.recorrencia_user_can_manage(uuid,uuid),app_private.recorrencia_dto(app_private.financeiro_recorrencia_execucoes),
  app_private.recorrencia_validar_config(jsonb),app_private.enfileirar_recorrencia(uuid,date,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.salvar_recorrencia_financeira(uuid,jsonb),public.listar_execucoes_recorrencia(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.salvar_recorrencia_financeira(uuid,jsonb),public.listar_execucoes_recorrencia(uuid) TO authenticated;
COMMIT;
