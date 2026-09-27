BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
DO $$
DECLARE
  v_empresa_id uuid;
  v_quantidade integer;
  v_alvo record;
BEGIN
  SELECT empresa.id INTO STRICT v_empresa_id
  FROM public.empresas empresa
  WHERE app_private.normalizar_cnpj_alfanumerico(empresa.cnpj) = '35898750000107'
    AND upper(btrim(empresa.nome)) =
      'BARRETO & MACHADO ASSESSORIA E CONSULTORIA CONTABIL LTDA';
  PERFORM pg_advisory_xact_lock(hashtextextended(v_empresa_id::text, 913331));
  SELECT count(*) INTO v_quantidade
  FROM public.clientes cliente
  JOIN public.parametrizacao_catalogos tipo_parceiro
    ON tipo_parceiro.id = cliente.tipo_parceiro_id
   AND tipo_parceiro.empresa_id = cliente.empresa_id
   AND tipo_parceiro.tipo = 'tipos_parceiros'
   AND tipo_parceiro.codigo IN ('cliente_contabil', 'tp-1')
   AND tipo_parceiro.ativo = true
  WHERE cliente.empresa_id = v_empresa_id
    AND app_private.normalizar_cnpj_alfanumerico(cliente.cnpj) = '46310615000115'
    AND upper(btrim(cliente.nome)) = 'COOPSEA'
    AND cliente.status = 'Ativa'
    AND cliente.tipo = 'Lucro Real';
  IF v_quantidade <> 1 THEN
    RAISE EXCEPTION 'COOPSEA ativa/Lucro Real não encontrada de forma unívoca.';
  END IF;
  FOR v_alvo IN SELECT * FROM (VALUES
    ('28354599000180', 'AMANI COSMETICS'),
    ('50343192000107', 'TAVARES DISTRIBUIDORA DE OVOS'),
    ('66876136000178', 'KARIB AUTO POSTO')
  ) AS alvo(cnpj, nome)
  LOOP
    SELECT count(*) INTO v_quantidade
    FROM public.clientes cliente
    WHERE cliente.empresa_id = v_empresa_id
      AND app_private.normalizar_cnpj_alfanumerico(cliente.cnpj) = v_alvo.cnpj
      AND upper(btrim(cliente.nome)) = v_alvo.nome;
    IF v_quantidade <> 1 THEN
      RAISE EXCEPTION 'Cadastro divergente para % (%).', v_alvo.nome, v_alvo.cnpj;
    END IF;
  END LOOP;
END;
$$;
CREATE TEMP TABLE _rotinas_alvo ON COMMIT DROP AS
SELECT empresa.id AS empresa_id, coopsea.id AS coopsea_id
FROM public.empresas empresa
JOIN public.clientes coopsea ON coopsea.empresa_id = empresa.id
WHERE app_private.normalizar_cnpj_alfanumerico(empresa.cnpj) = '35898750000107'
  AND upper(btrim(empresa.nome)) =
    'BARRETO & MACHADO ASSESSORIA E CONSULTORIA CONTABIL LTDA'
  AND app_private.normalizar_cnpj_alfanumerico(coopsea.cnpj) = '46310615000115'
  AND upper(btrim(coopsea.nome)) = 'COOPSEA';
CREATE TEMP TABLE _configs_inativos_antes ON COMMIT DROP AS
SELECT cfg.empresa_id, cfg.cliente_id, item.valor ->> 'entregaId' AS codigo
FROM public.configuracoes_protocolos_empresas cfg
CROSS JOIN LATERAL jsonb_array_elements(cfg.configs) item(valor)
WHERE cfg.empresa_id = (SELECT empresa_id FROM _rotinas_alvo)
  AND item.valor ->> 'ativo' = 'false';
CREATE OR REPLACE FUNCTION app_private.provisionar_catalogo_rotinas_contabeis(p_empresa_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_guard_anterior text := COALESCE(
    current_setting('app.obrigacao_canonica_write', true), 'off'
  );
  v_codigos text[] := ARRAY[
    'caixa-postal-rfb','caixa-postal-sefaz','nfs','dirbi','mit','pis-cofins',
    'iss-iss-retido','fecoep-saidas','fecoep-entradas','icms-difal',
    'icms-normal','icms-antecipado','dctfweb','reinf','xml-nfe','sped-fiscal',
    'sped-contribuicoes','irpj-csll-trimestral'
  ];
BEGIN
  IF p_empresa_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.empresas empresa WHERE empresa.id = p_empresa_id
  ) THEN
    RAISE EXCEPTION 'Empresa inválida para provisionar o catálogo.'
      USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text, 913331));
  INSERT INTO public.parametrizacao_protocolos_tipos (
    empresa_id, codigo, nome, categoria, orgao, dia_limite, descricao, regimes,
    periodicidade_padrao, origem_padrao, sistema, ativo, etapas,
    tem_vencimento, referencia_mes_anterior,
    dia_vencimento_primeira_quinzena, dia_vencimento_segunda_quinzena, ordem
  )
  SELECT
    p_empresa_id, padrao.codigo, padrao.nome, padrao.categoria, padrao.orgao,
    padrao.dia_limite, padrao.descricao, ARRAY['Lucro Presumido','Lucro Real']::text[],
    'mensal', padrao.origem_padrao, true, true, jsonb_build_array(padrao.nome),
    padrao.tem_vencimento, true, 15, 30, padrao.ordem
  FROM (VALUES
    ('caixa-postal-rfb','Caixa Postal RFB','Obrigações Acessórias','Receita Federal',20,'Conferência mensal das comunicações da Caixa Postal da Receita Federal.','escritorio',false,110),
    ('caixa-postal-sefaz','Caixa Postal SEFAZ','Obrigações Acessórias','SEFAZ',20,'Conferência mensal das comunicações da Caixa Postal da SEFAZ.','escritorio',false,120),
    ('nfs','NFS','Documentos','Cliente',5,'Recebimento e conferência mensal das notas fiscais de serviço.','cliente',false,130),
    ('dirbi','DIRBI','Obrigações Acessórias','Receita Federal',20,'Conferência da Declaração de Incentivos, Renúncias, Benefícios e Imunidades.','escritorio',false,140),
    ('mit','MIT','Obrigações Acessórias','Receita Federal',25,'Apuração mensal no Módulo de Inclusão de Tributos da DCTFWeb.','escritorio',false,150),
    ('pis-cofins','PIS/COFINS','Tributos','Receita Federal',25,'Controle mensal da apuração de PIS e COFINS.','escritorio',false,160),
    ('iss-iss-retido','ISS/ISS Retido','Tributos','Município',20,'Controle mensal de ISS próprio e ISS retido.','escritorio',false,170),
    ('fecoep-saidas','FECOEP Saídas','Tributos','SEFAZ',20,'Controle mensal de FECOEP incidente nas saídas.','escritorio',false,180),
    ('fecoep-entradas','FECOEP Entradas','Tributos','SEFAZ',20,'Controle mensal de FECOEP incidente nas entradas.','escritorio',false,190),
    ('icms-difal','ICMS Difal','Tributos','SEFAZ',20,'Controle mensal do diferencial de alíquota de ICMS.','escritorio',false,200),
    ('icms-normal','ICMS Normal','Tributos','SEFAZ',20,'Controle mensal da apuração normal de ICMS.','escritorio',false,210),
    ('icms-antecipado','ICMS Antecipação','Tributos','SEFAZ',20,'Controle mensal de ICMS antecipado.','escritorio',false,220),
    ('dctfweb','DCTFWeb','Obrigações Acessórias','Receita Federal',15,'Conferência e transmissão mensal da DCTFWeb.','escritorio',true,230),
    ('reinf','EFD-Reinf','Obrigações Acessórias','Receita Federal',15,'Conferência e transmissão mensal da EFD-Reinf.','escritorio',true,240),
    ('xml-nfe','XML NF-e','Documentos','Cliente',5,'Recebimento mensal dos XML de NF-e.','cliente',true,250),
    ('sped-fiscal','SPED Fiscal','Obrigações Acessórias','SEFAZ',20,'Escrituração fiscal mensal de ICMS/IPI.','escritorio',true,260),
    ('sped-contribuicoes','SPED Contribuições','Obrigações Acessórias','Receita Federal',15,'Escrituração mensal de PIS e COFINS.','escritorio',true,270),
    ('irpj-csll-trimestral','IRPJ/CSLL','Tributos','Receita Federal',30,'Controle da apuração de IRPJ e CSLL.','escritorio',true,280)
  ) AS padrao(codigo,nome,categoria,orgao,dia_limite,descricao,origem_padrao,tem_vencimento,ordem)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.parametrizacao_protocolos_tipos existente
    WHERE existente.empresa_id = p_empresa_id AND existente.codigo = padrao.codigo
  )
  ON CONFLICT (empresa_id, codigo) DO NOTHING;
  UPDATE public.parametrizacao_protocolos_tipos tipo
  SET nome = 'IRPJ/CSLL', categoria = 'Tributos',
      descricao = 'Controle da apuração de IRPJ e CSLL conforme o enquadramento da empresa.',
      etapas = jsonb_build_array('IRPJ/CSLL'), atualizado_em = now()
  WHERE tipo.empresa_id = p_empresa_id
    AND tipo.codigo = 'irpj-csll-trimestral'
    AND tipo.sistema = true
    AND tipo.nome IN ('Apuração IRPJ/CSLL', 'IRPJ/CSLL Trimestral');
  PERFORM set_config('app.obrigacao_canonica_write', 'on', true);
  UPDATE public.atividades_modelos modelo
  SET categoria = CASE
        WHEN tipo.categoria IN ('Fiscal','Tributos','Obrigações Acessórias') THEN 'Fiscal'
        WHEN tipo.categoria IN ('Trabalhista','Departamento Pessoal') THEN 'Folha'
        WHEN tipo.categoria IN ('Financeiro','Contábil') THEN 'Contábil'
        ELSE 'Controle' END,
      atualizado_em = now()
  FROM public.parametrizacao_protocolos_tipos tipo
  WHERE tipo.empresa_id = p_empresa_id
    AND tipo.codigo = ANY(v_codigos)
    AND modelo.empresa_id = tipo.empresa_id
    AND modelo.id = tipo.modelo_atividade_id;
  PERFORM set_config('app.obrigacao_canonica_write', v_guard_anterior, true);
  INSERT INTO public.parametrizacao_prazos_entrega AS prazo (
    empresa_id, regime, entrega_id, entrega_nome, categoria, dia_vencimento,
    referencia_mes_anterior, fechamento, dia_vencimento_primeira_quinzena,
    dia_vencimento_segunda_quinzena, sistema, ativo
  )
  SELECT tipo.empresa_id, regime, tipo.codigo, tipo.nome, tipo.categoria,
    tipo.dia_limite, tipo.referencia_mes_anterior, tipo.periodicidade_padrao,
    tipo.dia_vencimento_primeira_quinzena,
    tipo.dia_vencimento_segunda_quinzena, tipo.sistema,
    tipo.ativo AND tipo.tem_vencimento
  FROM public.parametrizacao_protocolos_tipos tipo
  CROSS JOIN LATERAL unnest(tipo.regimes) regime
  WHERE tipo.empresa_id = p_empresa_id AND tipo.codigo = ANY(v_codigos)
  ON CONFLICT (empresa_id, regime, entrega_id) DO UPDATE SET
    entrega_nome = EXCLUDED.entrega_nome, categoria = EXCLUDED.categoria,
    dia_vencimento = EXCLUDED.dia_vencimento,
    referencia_mes_anterior = EXCLUDED.referencia_mes_anterior,
    fechamento = EXCLUDED.fechamento, sistema = EXCLUDED.sistema,
    ativo = EXCLUDED.ativo, atualizado_em = now();
END;
$$;
REVOKE ALL ON FUNCTION app_private.provisionar_catalogo_rotinas_contabeis(uuid) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION app_private.provisionar_catalogo_rotinas_contabeis_nova_empresa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM app_private.provisionar_catalogo_rotinas_contabeis(NEW.id);
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION app_private.provisionar_catalogo_rotinas_contabeis_nova_empresa() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS zzzz_provisionar_catalogo_rotinas_contabeis ON public.empresas;
CREATE TRIGGER zzzz_provisionar_catalogo_rotinas_contabeis AFTER INSERT ON public.empresas FOR EACH ROW
  EXECUTE FUNCTION app_private.provisionar_catalogo_rotinas_contabeis_nova_empresa();
DO $$ DECLARE v_empresa_id uuid; BEGIN
  FOR v_empresa_id IN SELECT empresa.id FROM public.empresas empresa ORDER BY empresa.id
  LOOP
    PERFORM app_private.provisionar_catalogo_rotinas_contabeis(v_empresa_id);
  END LOOP;
END; $$;
CREATE OR REPLACE FUNCTION app_private.classificar_rotina_obrigacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_categoria text;
BEGIN
  SELECT CASE
    WHEN tipo.categoria IN ('Fiscal','Tributos','Obrigações Acessórias') THEN 'Fiscal'
    WHEN tipo.categoria IN ('Trabalhista','Departamento Pessoal') THEN 'Folha'
    WHEN tipo.categoria IN ('Financeiro','Contábil') THEN 'Contábil'
    ELSE 'Cliente' END
  INTO v_categoria
  FROM public.parametrizacao_protocolos_tipos tipo
  WHERE tipo.empresa_id = NEW.empresa_id
    AND tipo.codigo = NEW.protocolo_codigo;
  IF FOUND THEN NEW.categoria := v_categoria; END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION app_private.classificar_rotina_obrigacao() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS zz_classificar_rotina_obrigacao ON public.atividades_rotinas;
CREATE TRIGGER zz_classificar_rotina_obrigacao BEFORE INSERT OR UPDATE OF empresa_id, protocolo_codigo, categoria
  ON public.atividades_rotinas FOR EACH ROW
  EXECUTE FUNCTION app_private.classificar_rotina_obrigacao();
CREATE OR REPLACE FUNCTION app_private.reclassificar_modelo_obrigacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_guard text := COALESCE(current_setting('app.obrigacao_canonica_write', true), 'off');
BEGIN
  PERFORM set_config('app.obrigacao_canonica_write', 'on', true);
  UPDATE public.atividades_modelos SET categoria = CASE
    WHEN NEW.categoria IN ('Fiscal','Tributos','Obrigações Acessórias') THEN 'Fiscal'
    WHEN NEW.categoria IN ('Trabalhista','Departamento Pessoal') THEN 'Folha'
    WHEN NEW.categoria IN ('Financeiro','Contábil') THEN 'Contábil' ELSE 'Controle' END,
    atualizado_em = now()
  WHERE empresa_id = NEW.empresa_id AND id = NEW.modelo_atividade_id;
  PERFORM set_config('app.obrigacao_canonica_write', v_guard, true);
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION app_private.reclassificar_modelo_obrigacao() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS zz_reclassificar_modelo_obrigacao ON public.parametrizacao_protocolos_tipos;
CREATE TRIGGER zz_reclassificar_modelo_obrigacao AFTER INSERT OR UPDATE OF categoria, modelo_atividade_id
  ON public.parametrizacao_protocolos_tipos FOR EACH ROW
  EXECUTE FUNCTION app_private.reclassificar_modelo_obrigacao();
WITH rotinas(codigo,nome,categoria,ordem) AS (VALUES
  ('coopsea-integracao-fiscal','Integração Fiscal','Fiscal',301), ('coopsea-notas-servicos','Notas de Serviços','Fiscal',302),
  ('coopsea-apuracao-iss','Apuração de ISS','Fiscal',303), ('coopsea-pagamento-iss','Pagamento de ISS','Fiscal',304),
  ('coopsea-apuracao-icms-normal','Apuração ICMS Normal - Matriz','Fiscal',305), ('coopsea-pagamento-icms-normal','Pagamento de ICMS Normal','Fiscal',306),
  ('coopsea-apropriacao-icms-difal','Apropriação ICMS Dif. de Alíquota','Fiscal',307), ('coopsea-pagamento-icms-difal','Pagamento ICMS Dif. de Alíquota','Fiscal',308),
  ('coopsea-apropriacao-icms-fecoep','Apropriação ICMS FECOEP','Fiscal',309), ('coopsea-pagamento-icms-fecoep','Pagamento ICMS FECOEP','Fiscal',310),
  ('coopsea-apuracao-pis-cofins','Apuração de PIS/COFINS','Fiscal',311), ('coopsea-pagamento-pis','Pagamento de PIS','Fiscal',312),
  ('coopsea-pagamento-cofins','Pagamento de COFINS','Fiscal',313), ('coopsea-apuracao-irpj-csll','Apuração de IRPJ/CSLL','Fiscal',314),
  ('coopsea-pagamento-irpj','Pagamento de IRPJ','Fiscal',315), ('coopsea-pagamento-csll','Pagamento de CSLL','Fiscal',316),
  ('coopsea-exclusao-base-irpj-csll','Exclusão de base de IRPJ/CSLL - Cooperados','Fiscal',317), ('coopsea-baixa-manual','Baixa manual da cooperativa','Contábil',318),
  ('coopsea-conciliacao-cooperados','Conciliação de cooperados e não cooperados','Contábil',319), ('coopsea-mensalidades-cooperados','Mensalidades dos cooperados - 38 mensalidades','Contábil',320),
  ('coopsea-integracao-patrimonio','Integração do patrimônio','Contábil',321), ('coopsea-extrato-sicredi','Extrato Banco - Sicredi','Contábil',322),
  ('coopsea-conta-capital','Conta Capital','Contábil',323), ('coopsea-extrato-cresol','Extrato Banco - Cresol','Contábil',324),
  ('coopsea-extrato-cef','Extrato Banco - CEF','Contábil',325), ('coopsea-honorarios-contabeis','Honorários Contábeis','Contábil',326),
  ('coopsea-telefone-356','Telefone (356)','Contábil',327), ('coopsea-sistema','Sistema','Contábil',328),
  ('coopsea-conciliar-extrato','Conciliar entradas do extrato','Contábil',329), ('coopsea-folha-mensal','Folha mensal','Departamento Pessoal',330),
  ('coopsea-apropriacao-fgts','Apropriação FGTS','Departamento Pessoal',331), ('coopsea-apropriacao-inss','Apropriação INSS','Departamento Pessoal',332),
  ('coopsea-pagamento-inss','Pagamento INSS','Departamento Pessoal',333), ('coopsea-pagamento-fgts','Pagamento FGTS','Departamento Pessoal',334),
  ('coopsea-depreciacao','Depreciação','Contábil',335), ('coopsea-cpi-cmv','CPI/CMV','Contábil',336),
  ('coopsea-caixa','Caixa','Contábil',337), ('coopsea-impostos-recuperar-recolher','Impostos e contas a recuperar/recolher','Contábil',338),
  ('coopsea-revisao-ativo-passivo','Revisão de contas: ativo/passivo','Contábil',339)
)
INSERT INTO public.parametrizacao_protocolos_tipos (
  empresa_id,codigo,nome,categoria,orgao,dia_limite,descricao,regimes,
  periodicidade_padrao,origem_padrao,sistema,ativo,etapas,tem_vencimento,
  referencia_mes_anterior,dia_vencimento_primeira_quinzena,
  dia_vencimento_segunda_quinzena,ordem
)
SELECT alvo.empresa_id,rotina.codigo,rotina.nome,rotina.categoria,'Escritório',20,
  'Rotina mensal da COOPSEA conforme o controle operacional fornecido.',
  ARRAY['Lucro Real']::text[],'mensal','escritorio',false,true,
  jsonb_build_array(rotina.nome),false,true,15,30,rotina.ordem
FROM _rotinas_alvo alvo CROSS JOIN rotinas rotina
WHERE NOT EXISTS (
  SELECT 1 FROM public.parametrizacao_protocolos_tipos existente
  WHERE existente.empresa_id = alvo.empresa_id AND existente.codigo = rotina.codigo
)
ON CONFLICT (empresa_id,codigo) DO NOTHING;
DO $$
DECLARE
  v_empresa_id uuid := (SELECT empresa_id FROM _rotinas_alvo);
  v_guard_anterior text := COALESCE(
    current_setting('app.obrigacao_canonica_write', true), 'off'
  );
BEGIN
  PERFORM set_config('app.obrigacao_canonica_write', 'on', true);
  UPDATE public.atividades_modelos modelo
  SET categoria = CASE
        WHEN tipo.categoria IN ('Fiscal','Tributos','Obrigações Acessórias') THEN 'Fiscal'
        WHEN tipo.categoria IN ('Trabalhista','Departamento Pessoal') THEN 'Folha'
        WHEN tipo.categoria IN ('Financeiro','Contábil') THEN 'Contábil'
        ELSE 'Controle' END,
      atualizado_em = now()
  FROM public.parametrizacao_protocolos_tipos tipo
  WHERE tipo.empresa_id = v_empresa_id
    AND tipo.codigo LIKE 'coopsea-%'
    AND modelo.empresa_id = tipo.empresa_id
    AND modelo.id = tipo.modelo_atividade_id;
  PERFORM set_config('app.obrigacao_canonica_write', v_guard_anterior, true);
  INSERT INTO public.parametrizacao_prazos_entrega AS prazo (
    empresa_id,regime,entrega_id,entrega_nome,categoria,dia_vencimento,
    referencia_mes_anterior,fechamento,dia_vencimento_primeira_quinzena,
    dia_vencimento_segunda_quinzena,sistema,ativo
  )
  SELECT tipo.empresa_id,regime,tipo.codigo,tipo.nome,tipo.categoria,
    tipo.dia_limite,tipo.referencia_mes_anterior,tipo.periodicidade_padrao,
    tipo.dia_vencimento_primeira_quinzena,tipo.dia_vencimento_segunda_quinzena,
    tipo.sistema,tipo.ativo AND tipo.tem_vencimento
  FROM public.parametrizacao_protocolos_tipos tipo
  CROSS JOIN LATERAL unnest(tipo.regimes) regime
  WHERE tipo.empresa_id = v_empresa_id AND tipo.codigo LIKE 'coopsea-%'
  ON CONFLICT (empresa_id,regime,entrega_id) DO UPDATE SET
    entrega_nome = EXCLUDED.entrega_nome,categoria = EXCLUDED.categoria,
    dia_vencimento = EXCLUDED.dia_vencimento,
    referencia_mes_anterior = EXCLUDED.referencia_mes_anterior,
    fechamento = EXCLUDED.fechamento,sistema = EXCLUDED.sistema,
    ativo = EXCLUDED.ativo,atualizado_em = now();
END;
$$;
CREATE TEMP TABLE _codigos_rotinas_ativos ON COMMIT DROP AS
SELECT tipo.codigo
FROM public.parametrizacao_protocolos_tipos tipo
WHERE tipo.empresa_id = (SELECT empresa_id FROM _rotinas_alvo)
  AND (tipo.codigo LIKE 'coopsea-%' OR tipo.codigo IN (
    'caixa-postal-rfb','caixa-postal-sefaz','reinf','xml-nfe','nfs','sped-fiscal',
    'sped-contribuicoes','dirbi','mit','irpj-csll-trimestral','pis-cofins',
    'iss-iss-retido','fecoep-saidas','fecoep-entradas','icms-difal','icms-normal',
    'icms-antecipado','dctfweb'));
DO $$
DECLARE
  v_empresa_id uuid := (SELECT empresa_id FROM _rotinas_alvo);
  v_cliente_id uuid := (SELECT coopsea_id FROM _rotinas_alvo);
  v_configs jsonb;
  v_normalizadas jsonb;
  v_guard_anterior text := COALESCE(
    current_setting('app.obrigacao_config_internal_write', true), 'off'
  );
  v_codigos text[] := ARRAY(SELECT codigo FROM _codigos_rotinas_ativos ORDER BY codigo);
BEGIN
  SELECT cfg.configs INTO v_configs
  FROM public.configuracoes_protocolos_empresas cfg
  WHERE cfg.empresa_id = v_empresa_id AND cfg.cliente_id = v_cliente_id
  FOR UPDATE;
  v_configs := COALESCE(v_configs, '[]'::jsonb) || COALESCE((
    SELECT jsonb_agg(jsonb_build_object('entregaId', codigo, 'ativo', true))
    FROM unnest(v_codigos) codigo
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(v_configs, '[]'::jsonb)) item(valor)
      WHERE item.valor ->> 'entregaId' = codigo
    )
  ), '[]'::jsonb);
  v_normalizadas := app_private.normalizar_configs_protocolos_cliente(
    v_empresa_id, v_cliente_id, v_configs
  );
  PERFORM set_config('app.obrigacao_config_internal_write', 'on', true);
  INSERT INTO public.configuracoes_protocolos_empresas (empresa_id,cliente_id,configs)
  VALUES (v_empresa_id,v_cliente_id,v_normalizadas)
  ON CONFLICT (empresa_id,cliente_id) DO UPDATE SET configs = EXCLUDED.configs;
  PERFORM set_config('app.obrigacao_config_internal_write', v_guard_anterior, true);
  PERFORM public.sincronizar_rotinas_protocolos_cliente(
    v_empresa_id, v_cliente_id, v_normalizadas
  );
END;
$$;
DO $$
DECLARE
  v_empresa_id uuid := (SELECT empresa_id FROM _rotinas_alvo);
  v_alvo record;
BEGIN
  FOR v_alvo IN SELECT * FROM (VALUES
    ('28354599000180','AMANI COSMETICS','Lucro Real'),
    ('50343192000107','TAVARES DISTRIBUIDORA DE OVOS','Lucro Real'),
    ('66876136000178','KARIB AUTO POSTO','Lucro Presumido')
  ) AS alvo(cnpj,nome,regime)
  LOOP
    UPDATE public.clientes cliente SET tipo = v_alvo.regime
    WHERE cliente.empresa_id = v_empresa_id
      AND app_private.normalizar_cnpj_alfanumerico(cliente.cnpj) = v_alvo.cnpj
      AND upper(btrim(cliente.nome)) = v_alvo.nome
      AND cliente.tipo IS DISTINCT FROM v_alvo.regime;
  END LOOP;
END;
$$;
DO $$
DECLARE
  v_empresa_id uuid := (SELECT empresa_id FROM _rotinas_alvo);
  v_qtd integer;
  v_esperado integer;
BEGIN
  SELECT count(*) INTO v_qtd FROM public.parametrizacao_protocolos_tipos
  WHERE empresa_id = v_empresa_id AND codigo IN (
    'caixa-postal-rfb','caixa-postal-sefaz','nfs','dirbi','mit','pis-cofins',
    'iss-iss-retido','fecoep-saidas','fecoep-entradas','icms-difal',
    'icms-normal','icms-antecipado'
  );
  IF v_qtd <> 12 THEN RAISE EXCEPTION 'Catálogo global incompleto.'; END IF;
  SELECT count(*) INTO v_qtd FROM public.parametrizacao_protocolos_tipos
  WHERE empresa_id = v_empresa_id AND codigo LIKE 'coopsea-%';
  IF v_qtd <> 39 THEN RAISE EXCEPTION 'Catálogo específico da COOPSEA incompleto.'; END IF;
  SELECT count(*) INTO v_qtd FROM public.atividades_rotinas rotina
  WHERE rotina.empresa_id = v_empresa_id
    AND rotina.cliente_id = (SELECT coopsea_id FROM _rotinas_alvo)
    AND rotina.ativa = true
    AND rotina.protocolo_codigo IN (SELECT codigo FROM _codigos_rotinas_ativos);
  SELECT 57 - count(*) INTO v_esperado FROM _configs_inativos_antes antes
  WHERE antes.cliente_id = (SELECT coopsea_id FROM _rotinas_alvo)
    AND antes.codigo IN (SELECT codigo FROM _codigos_rotinas_ativos);
  IF v_qtd <> v_esperado THEN RAISE EXCEPTION 'Rotinas ativas da COOPSEA incompletas.'; END IF;
  IF EXISTS (
    SELECT 1 FROM _configs_inativos_antes antes
    WHERE NOT EXISTS (
      SELECT 1 FROM public.configuracoes_protocolos_empresas cfg
      CROSS JOIN LATERAL jsonb_array_elements(cfg.configs) item(valor)
      WHERE cfg.empresa_id = antes.empresa_id AND cfg.cliente_id = antes.cliente_id
        AND item.valor ->> 'entregaId' = antes.codigo
        AND item.valor ->> 'ativo' = 'false'
    )
  ) THEN RAISE EXCEPTION 'Uma obrigação antes inativa foi reativada.'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.parametrizacao_protocolos_tipos tipo
    WHERE tipo.empresa_id = v_empresa_id
      AND tipo.codigo IN (SELECT codigo FROM _codigos_rotinas_ativos)
      AND NOT EXISTS (
        SELECT 1 FROM public.atividades_modelos modelo
        WHERE modelo.empresa_id = tipo.empresa_id AND modelo.id = tipo.modelo_atividade_id
          AND modelo.categoria = CASE
            WHEN tipo.categoria IN ('Fiscal','Tributos','Obrigações Acessórias') THEN 'Fiscal'
            WHEN tipo.categoria IN ('Trabalhista','Departamento Pessoal') THEN 'Folha'
            WHEN tipo.categoria IN ('Financeiro','Contábil') THEN 'Contábil'
            ELSE 'Controle' END
      )
  ) THEN RAISE EXCEPTION 'Modelo espelho ausente.'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.parametrizacao_protocolos_tipos tipo
    CROSS JOIN LATERAL unnest(tipo.regimes) regime
    WHERE tipo.empresa_id = v_empresa_id
      AND tipo.codigo IN (SELECT codigo FROM _codigos_rotinas_ativos)
      AND NOT EXISTS (
        SELECT 1 FROM public.parametrizacao_prazos_entrega prazo
        WHERE prazo.empresa_id = tipo.empresa_id AND prazo.regime = regime
          AND prazo.entrega_id = tipo.codigo
          AND prazo.ativo = (tipo.ativo AND tipo.tem_vencimento)
      )
  ) THEN RAISE EXCEPTION 'Espelho de prazo divergente.'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.atividades_rotinas rotina
    WHERE rotina.empresa_id = v_empresa_id
      AND rotina.cliente_id IS DISTINCT FROM (SELECT coopsea_id FROM _rotinas_alvo)
      AND rotina.ativa = true
      AND rotina.protocolo_codigo IN (SELECT codigo FROM _codigos_rotinas_ativos)
  ) THEN RAISE EXCEPTION 'Rotina nova ativada fora da COOPSEA.'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.atividades_rotinas rotina
    JOIN public.parametrizacao_protocolos_tipos tipo
      ON tipo.empresa_id = rotina.empresa_id AND tipo.codigo = rotina.protocolo_codigo
    WHERE rotina.empresa_id = v_empresa_id
      AND rotina.cliente_id = (SELECT coopsea_id FROM _rotinas_alvo)
      AND rotina.ativa = true
      AND rotina.protocolo_codigo IN (SELECT codigo FROM _codigos_rotinas_ativos)
      AND rotina.categoria IS DISTINCT FROM CASE
        WHEN tipo.categoria IN ('Fiscal','Tributos','Obrigações Acessórias') THEN 'Fiscal'
        WHEN tipo.categoria IN ('Trabalhista','Departamento Pessoal') THEN 'Folha'
        WHEN tipo.categoria IN ('Financeiro','Contábil') THEN 'Contábil'
        ELSE 'Cliente' END
  ) THEN RAISE EXCEPTION 'Categoria operacional divergente.'; END IF;
  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('28354599000180','Lucro Real'),('50343192000107','Lucro Real'),
      ('66876136000178','Lucro Presumido')
    ) esperado(cnpj,regime)
    LEFT JOIN public.clientes cliente
      ON cliente.empresa_id = v_empresa_id
     AND app_private.normalizar_cnpj_alfanumerico(cliente.cnpj) = esperado.cnpj
     AND cliente.tipo = esperado.regime
    WHERE cliente.id IS NULL
  ) THEN RAISE EXCEPTION 'Regimes finais divergentes.'; END IF;
  IF has_function_privilege('anon', 'app_private.provisionar_catalogo_rotinas_contabeis(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'app_private.provisionar_catalogo_rotinas_contabeis(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'app_private.provisionar_catalogo_rotinas_contabeis_nova_empresa()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'app_private.provisionar_catalogo_rotinas_contabeis_nova_empresa()', 'EXECUTE')
     OR has_function_privilege('anon', 'app_private.classificar_rotina_obrigacao()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'app_private.classificar_rotina_obrigacao()', 'EXECUTE')
     OR has_function_privilege('anon', 'app_private.reclassificar_modelo_obrigacao()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'app_private.reclassificar_modelo_obrigacao()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Helper exposto a papéis da aplicação.';
  END IF;
END;
$$;
COMMIT;
