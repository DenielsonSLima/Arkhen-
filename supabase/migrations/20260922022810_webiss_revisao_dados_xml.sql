-- Validate review before reservar RPS; no fiscal transmission or operational data changes.
BEGIN;
CREATE OR REPLACE FUNCTION app_private.webiss_revisar(p app_private.webiss_rascunhos) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  f public.configuracoes_integracao_fiscal; c public.clientes; e jsonb; d jsonb:=p.dados;
  b text[]:='{}'; k text; n numeric; prestador jsonb; tomador jsonb; v text; limite integer; tamanho integer;
  espacos text:=E' \t\n\r\f'||chr(11)||U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
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
  -- Same effective fields and limits as rps.ts / archived ABRASF 2.02 XSD.
  -- Count UTF-16 units too: the JavaScript builder applies String.length.
  FOR k,v,limite IN
    SELECT 'Inscricao municipal do prestador',prestador->>'inscricaoMunicipal',15
    UNION ALL SELECT 'Razao social do tomador',tomador->>'razaoSocial',150
    UNION ALL SELECT 'Endereco do tomador',tomador->>'endereco',125
    UNION ALL SELECT 'Numero do endereco do tomador',tomador->>'numero',10
    UNION ALL SELECT 'Bairro do tomador',tomador->>'bairro',60
    UNION ALL SELECT 'Email do tomador',tomador->>'email',80
    UNION ALL SELECT 'Discriminacao dos servicos',d->>'descricao',2000
    UNION ALL SELECT 'Codigo municipal do servico',d->>'codigoTributacaoMunicipio',20
  LOOP
    SELECT coalesce(sum(CASE WHEN ch='' THEN 0 WHEN ascii(ch)>65535 THEN 2 ELSE 1 END),0)::integer INTO tamanho
      FROM regexp_split_to_table(btrim(coalesce(v,''),espacos),'') AS ch;
    IF tamanho>limite OR (k IN ('Inscricao municipal do prestador','Razao social do tomador','Numero do endereco do tomador') AND tamanho=0) THEN
      b:=array_append(b,k||' deve respeitar o limite de '||limite||' caracteres e nao pode estar em branco quando obrigatorio.');
    END IF;
  END LOOP;
  IF nullif(btrim(coalesce(tomador->>'uf',''),espacos),'') IS NOT NULL AND btrim(tomador->>'uf',espacos)!~'^[A-Z]{2}$' THEN
    b:=array_append(b,'UF do tomador invalida.'); END IF;
  IF nullif(tomador->>'cep','') IS NOT NULL AND tomador->>'cep'!~'^[0-9]{8}$' THEN
    b:=array_append(b,'CEP do tomador invalido: informe oito digitos.'); END IF;
  IF length(coalesce(tomador->>'telefone',''))>20 THEN
    b:=array_append(b,'Telefone do tomador excede 20 digitos.'); END IF;
  -- Scan unescaped effective values, not serialized JSON (which masks control characters).
  IF EXISTS (
    SELECT 1 FROM (
      SELECT value FROM jsonb_each_text(d)
      UNION ALL SELECT value FROM jsonb_each_text(prestador)
      UNION ALL SELECT value FROM jsonb_each_text(tomador)
      UNION ALL SELECT f.configuracao->>'serieRps'
    ) AS campos
    CROSS JOIN LATERAL regexp_split_to_table(campos.value,'') AS ch
    WHERE ch<>'' AND ((ascii(ch)<32 AND ascii(ch) NOT IN (9,10,13)) OR ascii(ch) IN (65534,65535))
  ) THEN b:=array_append(b,'Dados fiscais contem caracteres XML invalidos.'); END IF;
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
    IF n IS NULL OR n::text IN ('NaN','Infinity','-Infinity') OR n<=0 OR n>=10000000000000 OR n<>round(n,2) THEN RAISE EXCEPTION 'valor'; END IF;
  EXCEPTION WHEN OTHERS THEN b:=array_append(b,'Valor deve ser positivo com ate duas casas decimais.'); END;
  IF nullif(d->>'aliquotaIss','') IS NOT NULL THEN
    BEGIN n:=(d->>'aliquotaIss')::numeric;
      IF n::text IN ('NaN','Infinity','-Infinity') OR n<0 OR n>100 OR n<>round(n,4) THEN RAISE EXCEPTION 'aliquota'; END IF;
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
REVOKE ALL ON FUNCTION app_private.webiss_revisar(app_private.webiss_rascunhos) FROM PUBLIC,anon,authenticated;
COMMIT;
