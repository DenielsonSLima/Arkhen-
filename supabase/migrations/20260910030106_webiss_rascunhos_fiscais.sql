-- Rascunho fiscal independente de cobrança. Revisão não reserva RPS nem transmite.
BEGIN;
CREATE TABLE app_private.webiss_rascunhos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  fiscal_config_id uuid NOT NULL REFERENCES public.configuracoes_integracao_fiscal(id),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  cobranca_id uuid REFERENCES public.financeiro_cobrancas(id),
  ambiente text NOT NULL CHECK (ambiente IN ('homologacao','producao')),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  origem jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','processando','rejeitada','incerta','falha_pre_envio','confirmada')),
  snapshot jsonb, tentativa_id uuid, lease_ate timestamptz,
  rps_numero bigint, rps_serie text, numero_nfse text, codigo_verificacao text,
  resultado jsonb, mensagem text, emitida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX webiss_rascunhos_tenant_data ON app_private.webiss_rascunhos(empresa_id,updated_at DESC);
CREATE UNIQUE INDEX webiss_rascunho_cobranca_ambiente ON app_private.webiss_rascunhos(cobranca_id,ambiente) WHERE cobranca_id IS NOT NULL;
ALTER TABLE app_private.webiss_rascunhos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.webiss_rascunhos FROM PUBLIC,anon,authenticated;

CREATE FUNCTION app_private.webiss_dados_permitidos(p_dados jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) FROM jsonb_each(coalesce(p_dados,'{}'::jsonb))
  WHERE key = ANY(ARRAY['competencia','dataEmissao','descricao','valor','itemListaServico','codigoCnae',
    'codigoTributacaoMunicipio','codigoNbs','codigoMunicipio','municipioIncidencia','exigibilidadeIss',
    'issRetido','responsavelRetencao','optanteSimplesNacional','regimeEspecial','incentivoFiscal','aliquotaIss',
    'tomadorNumero','tomadorCodigoMunicipio']);
$$;
CREATE FUNCTION app_private.webiss_rascunho_dto(p app_private.webiss_rascunhos) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT jsonb_build_object('id',p.id,'empresaId',p.empresa_id,'fiscalConfigId',p.fiscal_config_id,
    'clienteId',p.cliente_id,'cobrancaId',p.cobranca_id,'ambiente',p.ambiente,'dados',p.dados,'origemFonte',p.origem,
    'status',p.status,'numeroNfse',p.numero_nfse,'codigoVerificacao',p.codigo_verificacao,
    'rpsNumero',p.rps_numero,'rpsSerie',p.rps_serie,'mensagem',p.mensagem,
    'createdAt',p.created_at,'updatedAt',p.updated_at);
$$;
CREATE FUNCTION public.listar_contextos_emissao_webiss() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',f.id,'empresaId',f.empresa_id,
    'prestadorNome',CASE WHEN f.cliente_id IS NULL THEN e.razao_social ELSE coalesce(nullif(c.razao_social,''),c.nome) END,
    'prestadorCnpj',CASE WHEN f.cliente_id IS NULL THEN e.cnpj ELSE c.cnpj END,
    'inscricaoMunicipal',f.configuracao->>'inscricaoMunicipal','ambiente',f.ambiente,'ativo',f.ativo,
    'parametros',public.safe_fiscal_config(f.configuracao)) ORDER BY f.created_at),'[]'::jsonb)
  FROM public.configuracoes_integracao_fiscal f
  LEFT JOIN public.configuracoes_empresa e ON e.empresa_id=f.empresa_id
  LEFT JOIN public.clientes c ON c.id=f.cliente_id AND c.empresa_id=f.empresa_id
  WHERE f.empresa_id=public.current_empresa_id() AND f.uf='SE' AND lower(trim(f.municipio))='itabaiana'
    AND lower(f.provedor)='webiss';
$$;
CREATE FUNCTION public.salvar_rascunho_nfse_webiss(p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_empresa uuid := public.current_empresa_id(); v_draft app_private.webiss_rascunhos;
  v_config public.configuracoes_integracao_fiscal;
  v_id uuid := coalesce(nullif(p_payload->>'id','')::uuid,gen_random_uuid());
  v_cliente uuid := (p_payload->>'clienteId')::uuid;
  v_cobranca uuid := nullif(p_payload->>'cobrancaId','')::uuid;
  v_dados jsonb := app_private.webiss_dados_permitidos(p_payload->'dados');
BEGIN
  IF v_empresa IS NULL OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessao fiscal ausente.'; END IF;
  IF coalesce(p_payload->>'ambiente','') NOT IN ('homologacao','producao') THEN RAISE EXCEPTION 'Informe o ambiente fiscal.'; END IF;
  IF jsonb_typeof(p_payload->'dados') IS DISTINCT FROM 'object' OR octet_length(p_payload::text)>32768 THEN
    RAISE EXCEPTION 'Dados do rascunho invalidos.';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_each(v_dados) kv WHERE jsonb_typeof(value)<>'string'
    AND NOT (key IN ('valor','aliquotaIss') AND jsonb_typeof(value)='number')) THEN
    RAISE EXCEPTION 'Campos fiscais devem ser textos; valor e aliquota tambem aceitam numeros.'; END IF;
  IF v_dados IS DISTINCT FROM p_payload->'dados' THEN RAISE EXCEPTION 'Rascunho contem campos fiscais ainda nao suportados.'; END IF;
  SELECT * INTO v_config FROM public.configuracoes_integracao_fiscal
    WHERE id=(p_payload->>'fiscalConfigId')::uuid AND empresa_id=v_empresa
      AND uf='SE' AND lower(trim(municipio))='itabaiana' AND lower(provedor)='webiss';
  IF NOT FOUND THEN RAISE EXCEPTION 'Contexto fiscal fora do tenant ou nao suportado.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=v_cliente AND empresa_id=v_empresa) THEN
    RAISE EXCEPTION 'Tomador fora da empresa atual.';
  END IF;
  IF v_cobranca IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.financeiro_cobrancas
    WHERE id=v_cobranca AND empresa_id=v_empresa AND cliente_empresa_id=v_cliente) THEN
    RAISE EXCEPTION 'Cobranca vinculada nao pertence ao tomador/empresa.';
  END IF;
  IF v_cobranca IS NOT NULL AND EXISTS(SELECT 1 FROM app_private.webiss_emissoes
    WHERE cobranca_id=v_cobranca AND ambiente=p_payload->>'ambiente') THEN
    RAISE EXCEPTION 'Cobranca ja possui tentativa fiscal. Consulte o RPS original antes de criar outro vinculo.'; END IF;
  SELECT * INTO v_draft FROM app_private.webiss_rascunhos WHERE id=v_id FOR UPDATE;
  IF FOUND AND (v_draft.empresa_id<>v_empresa OR v_draft.status NOT IN ('rascunho','falha_pre_envio')) THEN
    RAISE EXCEPTION 'Rascunho indisponivel para edicao. Consulte o RPS transmitido.';
  END IF;
  IF v_draft.rps_numero IS NOT NULL AND (v_draft.ambiente<>p_payload->>'ambiente'
    OR v_draft.fiscal_config_id<>v_config.id OR v_draft.cliente_id<>v_cliente OR v_draft.cobranca_id IS DISTINCT FROM v_cobranca) THEN
    RAISE EXCEPTION 'Identidade de rascunho com RPS reservado nao pode mudar.';
  END IF;
  INSERT INTO app_private.webiss_rascunhos(id,empresa_id,fiscal_config_id,cliente_id,cobranca_id,ambiente,dados)
    VALUES(v_id,v_empresa,v_config.id,v_cliente,v_cobranca,p_payload->>'ambiente',v_dados)
    ON CONFLICT(id) DO UPDATE SET fiscal_config_id=excluded.fiscal_config_id,cliente_id=excluded.cliente_id,
      cobranca_id=excluded.cobranca_id,ambiente=excluded.ambiente,dados=excluded.dados,updated_at=now()
    WHERE app_private.webiss_rascunhos.empresa_id=v_empresa AND app_private.webiss_rascunhos.status IN ('rascunho','falha_pre_envio')
      AND (app_private.webiss_rascunhos.rps_numero IS NULL OR (app_private.webiss_rascunhos.fiscal_config_id=excluded.fiscal_config_id
        AND app_private.webiss_rascunhos.cliente_id=excluded.cliente_id AND app_private.webiss_rascunhos.ambiente=excluded.ambiente
        AND app_private.webiss_rascunhos.cobranca_id IS NOT DISTINCT FROM excluded.cobranca_id))
    RETURNING * INTO v_draft;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rascunho alterado por outra operacao; recarregue a revisao.'; END IF;
  RETURN app_private.webiss_rascunho_dto(v_draft);
END;
$$;
-- Build effective public review data; internal helper accepts only an already scoped draft.
CREATE FUNCTION app_private.webiss_revisar(p app_private.webiss_rascunhos) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  f public.configuracoes_integracao_fiscal; c public.clientes; e jsonb; d jsonb:=p.dados;
  b text[]:='{}'; k text; n numeric; prestador jsonb; tomador jsonb;
BEGIN
  SELECT * INTO f FROM public.configuracoes_integracao_fiscal WHERE id=p.fiscal_config_id AND empresa_id=p.empresa_id;
  SELECT * INTO c FROM public.clientes WHERE id=p.cliente_id AND empresa_id=p.empresa_id;
  IF f.cliente_id IS NULL THEN SELECT to_jsonb(x) INTO e FROM public.configuracoes_empresa x WHERE empresa_id=p.empresa_id;
  ELSE SELECT to_jsonb(x) INTO e FROM public.clientes x WHERE id=f.cliente_id AND empresa_id=p.empresa_id; END IF;
  prestador:=jsonb_build_object('cnpj',app_private.normalizar_cnpj_alfanumerico(e->>'cnpj'),
    'razaoSocial',coalesce(nullif(e->>'razao_social',''),e->>'nome'),
    'inscricaoMunicipal',f.configuracao->>'inscricaoMunicipal');
  tomador:=jsonb_build_object('documento',app_private.normalizar_cnpj_alfanumerico(c.cnpj),
    'razaoSocial',coalesce(nullif(c.razao_social,''),c.nome),'endereco',c.endereco,'numero',d->>'tomadorNumero',
    'bairro',c.bairro,'cidade',c.cidade,'uf',upper(c.uf),'cep',regexp_replace(coalesce(c.cep,''),'[^0-9]','','g'),
    'email',c.email,'telefone',regexp_replace(coalesce(c.telefone,''),'[^0-9]','','g'),'codigoMunicipio',d->>'tomadorCodigoMunicipio');
  IF NOT coalesce(f.ativo,false) THEN b:=array_append(b,'Ative o contexto fiscal do emitente.'); END IF;
  IF f.certificado_arquivo_secret_id IS NULL OR f.certificado_senha_secret_id IS NULL THEN b:=array_append(b,'Cadastre o certificado A1 do emitente.'); END IF;
  BEGIN
    IF nullif(f.certificado_metadata->>'certificadoValidade','') IS NULL OR (f.certificado_metadata->>'certificadoValidade')::date<current_date THEN
      b:=array_append(b,'Validade do certificado ausente ou expirada.'); END IF;
    IF nullif(f.certificado_metadata->>'certificadoEmitidoEm','') IS NOT NULL AND (f.certificado_metadata->>'certificadoEmitidoEm')::date>current_date THEN
      b:=array_append(b,'Certificado ainda nao esta vigente.'); END IF;
  EXCEPTION WHEN OTHERS THEN b:=array_append(b,'Metadados de validade do certificado invalidos.'); END;
  IF app_private.normalizar_cnpj_alfanumerico(f.certificado_metadata->>'certificadoCNPJ') IS DISTINCT FROM prestador->>'cnpj' THEN
    b:=array_append(b,'Certificado cadastrado nao corresponde ao CNPJ do emitente.'); END IF;
  IF coalesce(f.configuracao->>'serieRps','')!~'^[A-Za-z0-9]{1,5}$' THEN b:=array_append(b,'Configure serie RPS valida.'); END IF;
  IF coalesce(f.configuracao->>'proximoNumeroRps','')!~'^[1-9][0-9]{0,14}$' THEN b:=array_append(b,'Configure proximo RPS valido.'); END IF;
  IF app_private.cnpj_alfanumerico_valido(prestador->>'cnpj') IS NOT TRUE THEN b:=array_append(b,'CNPJ do prestador invalido.'); END IF;
  IF nullif(prestador->>'inscricaoMunicipal','') IS NULL THEN b:=array_append(b,'Inscricao municipal do prestador ausente.'); END IF;
  IF nullif(tomador->>'documento','') IS NULL OR nullif(tomador->>'razaoSocial','') IS NULL THEN b:=array_append(b,'Documento ou nome do tomador ausente.'); END IF;
  IF c.tipo<>'PF' AND app_private.cnpj_alfanumerico_valido(tomador->>'documento') IS NOT TRUE THEN b:=array_append(b,'CNPJ do tomador invalido.'); END IF;
  IF c.tipo='PF' AND public.cpf_valido(tomador->>'documento') IS NOT TRUE THEN b:=array_append(b,'CPF do tomador invalido.'); END IF;
  FOREACH k IN ARRAY ARRAY['dataEmissao','competencia'] LOOP
    BEGIN
      IF coalesce(d->>k,'')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR (d->>k)::date::text<>d->>k THEN RAISE EXCEPTION 'data'; END IF;
    EXCEPTION WHEN OTHERS THEN b:=array_append(b,'Informe uma data valida em '||k||'.'); END;
  END LOOP;
  IF length(trim(coalesce(d->>'descricao',''))) NOT BETWEEN 10 AND 2000
    OR cardinality(string_to_array(replace(coalesce(d->>'descricao',''),E'\r',''),E'\n'))>20 THEN
    b:=array_append(b,'Discriminacao deve ter 10 a 2000 caracteres e ate 20 linhas.'); END IF;
  BEGIN
    n:=(d->>'valor')::numeric;
    IF n IS NULL OR n<=0 OR n>=10000000000000 OR n<>round(n,2) THEN RAISE EXCEPTION 'valor'; END IF;
  EXCEPTION WHEN OTHERS THEN b:=array_append(b,'Valor deve ser positivo com ate duas casas decimais.'); END;
  IF nullif(d->>'aliquotaIss','') IS NOT NULL THEN
    BEGIN n:=(d->>'aliquotaIss')::numeric;
      IF n<0 OR n>100 OR n<>round(n,4) THEN RAISE EXCEPTION 'aliquota'; END IF;
    EXCEPTION WHEN OTHERS THEN b:=array_append(b,'Aliquota percentual invalida.'); END;
  END IF;
  FOREACH k IN ARRAY ARRAY['optanteSimplesNacional','issRetido','incentivoFiscal'] LOOP
    IF coalesce(d->>k,'') NOT IN ('1','2') THEN b:=array_append(b,'Informe '||k||' explicitamente.'); END IF;
  END LOOP;
  IF d->>'issRetido'='1' AND coalesce(d->>'responsavelRetencao','') NOT IN ('1','2') THEN b:=array_append(b,'Responsavel pela retencao obrigatorio.'); END IF;
  IF coalesce(d->>'exigibilidadeIss','')!~'^[1-7]$' THEN b:=array_append(b,'Exigibilidade ISS invalida.'); END IF;
  IF nullif(d->>'regimeEspecial','') IS NOT NULL AND d->>'regimeEspecial'!~'^[0-6]$' THEN b:=array_append(b,'Regime especial invalido.'); END IF;
  FOREACH k IN ARRAY ARRAY['codigoMunicipio','municipioIncidencia','tomadorCodigoMunicipio','codigoCnae'] LOOP
    IF coalesce(d->>k,'')!~'^[0-9]{7}$' THEN b:=array_append(b,'Informe codigo de sete digitos em '||k||'.'); END IF;
  END LOOP;
  IF coalesce(d->>'itemListaServico','')!~'^[0-9]{1,2}\.[0-9]{2}$' THEN b:=array_append(b,'Item LC116 invalido.'); END IF;
  IF length(coalesce(d->>'codigoTributacaoMunicipio','')) NOT BETWEEN 1 AND 20 THEN b:=array_append(b,'Codigo municipal do servico ausente ou invalido.'); END IF;
  IF nullif(d->>'codigoNbs','') IS NOT NULL AND d->>'codigoNbs'!~'^[0-9]{9}$' THEN b:=array_append(b,'NBS deve ter nove digitos quando informado.'); END IF;
  IF length(coalesce(d->>'tomadorNumero','')) NOT BETWEEN 1 AND 10 THEN b:=array_append(b,'Informe numero do endereco do tomador.'); END IF;
  IF p.cobranca_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.financeiro_cobrancas
    WHERE id=p.cobranca_id AND empresa_id=p.empresa_id AND (status='Cancelado' OR (nfse_id IS NOT NULL AND p.ambiente='producao'))) THEN
    b:=array_append(b,'Cobranca vinculada cancelada ou ja possui NFS-e de producao.'); END IF;
  IF p.status NOT IN ('rascunho','falha_pre_envio') THEN b:=array_append(b,'Rascunho ja possui tentativa; consultar o mesmo RPS.'); END IF;
  RETURN jsonb_build_object('rascunho',app_private.webiss_rascunho_dto(p),'ready',cardinality(b)=0,
    'blockers',to_jsonb(b),'prestador',prestador,'tomador',tomador,'endpoint',
    CASE p.ambiente WHEN 'producao' THEN 'https://itabaianase.webiss.com.br/ws/nfse.asmx' ELSE 'https://homologacao.webiss.com.br/ws/nfse.asmx' END);
END;
$$;
CREATE FUNCTION public.revisar_rascunho_nfse_webiss(p_rascunho_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE d app_private.webiss_rascunhos;
BEGIN
  SELECT * INTO d FROM app_private.webiss_rascunhos WHERE id=p_rascunho_id AND empresa_id=public.current_empresa_id();
  IF NOT FOUND THEN RAISE EXCEPTION 'Rascunho nao encontrado na empresa.'; END IF;
  RETURN app_private.webiss_revisar(d);
END;
$$;
REVOKE ALL ON FUNCTION app_private.webiss_dados_permitidos(jsonb),app_private.webiss_rascunho_dto(app_private.webiss_rascunhos),app_private.webiss_revisar(app_private.webiss_rascunhos) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.listar_contextos_emissao_webiss(),public.salvar_rascunho_nfse_webiss(jsonb),public.revisar_rascunho_nfse_webiss(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.listar_contextos_emissao_webiss(),public.salvar_rascunho_nfse_webiss(jsonb),public.revisar_rascunho_nfse_webiss(uuid) TO authenticated;
COMMIT;
