-- Helpers temporarios e somente leitura da limpeza do tenant legado.
CREATE OR REPLACE FUNCTION public.validar_scaffolds_tenant_demonstracao(
  p_empresa_id uuid,
  p_user_id uuid,
  p_config_usuario_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := p_empresa_id;
  v_user_id uuid := p_user_id;
  v_config_usuario_id uuid := p_config_usuario_id;
  v_quantidade integer;
  v_canonical boolean;
  v_keys text[];
BEGIN
  -- Scaffolds que migrations e inicializadores do sistema provisionaram para
  -- este tenant. Cada conjunto e aceito somente quando sua identidade e os
  -- marcadores de sistema coincidem integralmente com o manifesto conhecido.
  SELECT
    count(*),
    COALESCE(array_agg(codigo::text ORDER BY codigo::text COLLATE "C"), ARRAY[]::text[]),
    COALESCE(bool_and(
      sistema IS TRUE
      AND ativo IS TRUE
      AND categoria IS NOT DISTINCT FROM 'Controle'
      AND nome IS NOT DISTINCT FROM CASE codigo
        WHEN 'folha-pagamento' THEN 'Folha de Pagamento'
        WHEN 'pro-labore' THEN 'Pró-Labore'
        WHEN 'obras' THEN 'Obras'
        WHEN 'dctfweb-tributos-federais' THEN 'DCTFWeb / Tributos Federais'
        WHEN 'obrigacoes-mensais' THEN 'Obrigações Mensais'
        WHEN 'tarefas-internas' THEN 'Tarefas Internas'
      END
      AND ordem IS NOT DISTINCT FROM CASE codigo
        WHEN 'folha-pagamento' THEN 10
        WHEN 'pro-labore' THEN 20
        WHEN 'obras' THEN 30
        WHEN 'dctfweb-tributos-federais' THEN 40
        WHEN 'obrigacoes-mensais' THEN 50
        WHEN 'tarefas-internas' THEN 60
      END
    ), false)
  INTO v_quantidade, v_keys, v_canonical
  FROM public.atividades_modelos
  WHERE empresa_id = v_empresa_id;

  IF v_quantidade IS DISTINCT FROM 6
     OR v_keys IS DISTINCT FROM ARRAY[
       'dctfweb-tributos-federais', 'folha-pagamento', 'obras',
       'obrigacoes-mensais', 'pro-labore', 'tarefas-internas'
     ]::text[]
     OR v_canonical IS DISTINCT FROM true THEN
    RAISE EXCEPTION
      'Limpeza abortada: os modelos de atividades nao correspondem ao manifesto canonico.';
  END IF;

  SELECT
    count(*),
    COALESCE(array_agg(codigo::text ORDER BY codigo::text COLLATE "C"), ARRAY[]::text[]),
    COALESCE(bool_and(
      sistema IS TRUE
      AND ativo IS TRUE
      AND nome IS NOT DISTINCT FROM CASE codigo
        WHEN 'administrador' THEN 'Administrador'
        WHEN 'financeiro' THEN 'Financeiro'
        WHEN 'funcionario' THEN 'Funcionário'
        WHEN 'fiscal' THEN 'Analista Fiscal'
        WHEN 'cliente' THEN 'Cliente Externo'
      END
      AND ordem IS NOT DISTINCT FROM CASE codigo
        WHEN 'administrador' THEN 10
        WHEN 'financeiro' THEN 20
        WHEN 'funcionario' THEN 30
        WHEN 'fiscal' THEN 40
        WHEN 'cliente' THEN 50
      END
    ), false)
  INTO v_quantidade, v_keys, v_canonical
  FROM public.configuracoes_perfis_acesso
  WHERE empresa_id = v_empresa_id;

  IF v_quantidade IS DISTINCT FROM 5
     OR v_keys IS DISTINCT FROM ARRAY[
       'administrador', 'cliente', 'financeiro', 'fiscal', 'funcionario'
     ]::text[]
     OR v_canonical IS DISTINCT FROM true THEN
    RAISE EXCEPTION
      'Limpeza abortada: os perfis de acesso nao correspondem ao manifesto canonico.';
  END IF;

  SELECT
    count(*),
    COALESCE(array_agg(codigo::text ORDER BY codigo::text COLLATE "C"), ARRAY[]::text[]),
    COALESCE(bool_and(padrao_sistema IS TRUE), false)
  INTO v_quantidade, v_keys, v_canonical
  FROM public.parametrizacao_cnaes
  WHERE empresa_id = v_empresa_id;

  IF v_quantidade IS DISTINCT FROM 20
     OR v_keys IS DISTINCT FROM ARRAY[
       '1412-6/02', '4321-5/00', '4322-3/01', '4520-0/01',
       '4711-3/00', '4711-3/01', '4711-3/02', '4712-1/00',
       '4930-2/01', '5620-1/04', '6201-5/00', '6201-5/01',
       '6422-1/00', '6911-7/01', '6920-6/01', '7112-0/00',
       '8599-6/04', '8630-5/03', '9602-5/01', '9602-5/02'
     ]::text[]
     OR v_canonical IS DISTINCT FROM true THEN
    RAISE EXCEPTION
      'Limpeza abortada: o catalogo CNAE nao corresponde ao manifesto canonico.';
  END IF;

  -- Tabelas do bootstrap remoto nao existem em todos os históricos locais.
  -- Zero linhas e aceito; qualquer conjunto presente deve ser o manifesto
  -- completo. A consulta dinamica mantem a migration compatível e fail-closed.
  IF to_regclass('public.parametrizacao_catalogos') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.parametrizacao_catalogos WHERE empresa_id = $1'
      INTO v_quantidade USING v_empresa_id;
    IF v_quantidade > 0 THEN
      EXECUTE $sql$
        SELECT
          array_agg(tipo::text || ':' || codigo::text ORDER BY (tipo::text || ':' || codigo::text) COLLATE "C"),
          bool_and(sistema IS TRUE AND ativo IS TRUE)
        FROM public.parametrizacao_catalogos WHERE empresa_id = $1
      $sql$ INTO v_keys, v_canonical USING v_empresa_id;
      IF v_quantidade IS DISTINCT FROM 25 OR v_keys IS DISTINCT FROM ARRAY[
        'categorias_clientes:cliente_contabil', 'categorias_clientes:entidade_isenta',
        'categorias_clientes:holding_patrimonial', 'categorias_clientes:outro',
        'categorias_clientes:pessoa_fisica', 'modelos_checklists:abertura_empresa',
        'modelos_checklists:admissao_funcionario', 'naturezas_juridicas:associacao_privada',
        'naturezas_juridicas:empresario_individual', 'naturezas_juridicas:sociedade_limitada',
        'naturezas_juridicas:sociedade_limitada_unipessoal', 'tipos_documentos:certidao',
        'tipos_documentos:contrato', 'tipos_documentos:guia_comprovante',
        'tipos_documentos:procuracao', 'tipos_empresa:epp',
        'tipos_empresa:holding_patrimonial', 'tipos_empresa:isenta_imune',
        'tipos_empresa:mei', 'tipos_empresa:microempresa', 'tipos_empresa:pessoa_fisica',
        'tipos_parceiros:cliente_contabil', 'tipos_parceiros:correspondente',
        'tipos_parceiros:fornecedor', 'tipos_parceiros:parceiro_comercial'
      ]::text[] OR v_canonical IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Limpeza abortada: os catalogos nao correspondem ao manifesto canonico.';
      END IF;
    END IF;
  END IF;

  IF to_regclass('public.parametrizacao_documentos_funcionarios') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.parametrizacao_documentos_funcionarios WHERE empresa_id = $1'
      INTO v_quantidade USING v_empresa_id;
    IF v_quantidade > 0 THEN
      EXECUTE $sql$
        SELECT array_agg(codigo::text ORDER BY codigo::text COLLATE "C"),
               bool_and(sistema IS TRUE AND ativo IS TRUE)
        FROM public.parametrizacao_documentos_funcionarios WHERE empresa_id = $1
      $sql$ INTO v_keys, v_canonical USING v_empresa_id;
      IF v_quantidade IS DISTINCT FROM 7 OR v_keys IS DISTINCT FROM ARRAY[
        'aso', 'carteira_trabalho', 'certidao_dependentes', 'certificado_reservista',
        'comprovante_residencia', 'documento_identidade', 'titulo_eleitor'
      ]::text[] OR v_canonical IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Limpeza abortada: os documentos funcionais nao correspondem ao manifesto canonico.';
      END IF;
    END IF;
  END IF;

  IF to_regclass('public.parametrizacao_parametros_calculo') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.parametrizacao_parametros_calculo WHERE empresa_id = $1'
      INTO v_quantidade USING v_empresa_id;
    IF v_quantidade > 0 THEN
      EXECUTE $sql$
        SELECT array_agg(versao::text ORDER BY versao),
               bool_and(sistema IS TRUE AND ativo IS TRUE)
        FROM public.parametrizacao_parametros_calculo WHERE empresa_id = $1
      $sql$ INTO v_keys, v_canonical USING v_empresa_id;
      IF v_quantidade IS DISTINCT FROM 1 OR v_keys IS DISTINCT FROM ARRAY['1']::text[]
         OR v_canonical IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Limpeza abortada: os parametros de calculo nao correspondem ao manifesto canonico.';
      END IF;
    END IF;
  END IF;

  IF to_regclass('public.parametrizacao_prazos_entrega') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.parametrizacao_prazos_entrega WHERE empresa_id = $1'
      INTO v_quantidade USING v_empresa_id;
    IF v_quantidade > 0 THEN
      EXECUTE $sql$
        SELECT array_agg(regime::text || ':' || entrega_id::text ORDER BY (regime::text || ':' || entrega_id::text) COLLATE "C"),
               bool_and(sistema IS TRUE AND ativo IS TRUE)
        FROM public.parametrizacao_prazos_entrega WHERE empresa_id = $1
      $sql$ INTO v_keys, v_canonical USING v_empresa_id;
      IF v_quantidade IS DISTINCT FROM 16 OR v_keys IS DISTINCT FROM ARRAY[
        'Isenta:dctfweb', 'Isenta:reinf',
        'Lucro Presumido:dctfweb', 'Lucro Presumido:irpj-csll-trimestral',
        'Lucro Presumido:sped-contribuicoes', 'Lucro Presumido:sped-fiscal',
        'Lucro Real:dctfweb', 'Lucro Real:irpj-csll-trimestral',
        'Lucro Real:sped-contribuicoes', 'Lucro Real:sped-fiscal',
        'MEI:dctfweb', 'MEI:esocial', 'Simples Nacional:dctfweb',
        'Simples Nacional:pgdas', 'Simples Nacional:reinf', 'Simples Nacional:xml-nfe'
      ]::text[] OR v_canonical IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Limpeza abortada: os prazos nao correspondem ao manifesto canonico.';
      END IF;
    END IF;
  END IF;

  IF to_regclass('public.parametrizacao_protocolos_tipos') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.parametrizacao_protocolos_tipos WHERE empresa_id = $1'
      INTO v_quantidade USING v_empresa_id;
    IF v_quantidade > 0 THEN
      EXECUTE $sql$
        SELECT array_agg(codigo::text ORDER BY codigo::text COLLATE "C"),
               bool_and(sistema IS TRUE AND ativo IS TRUE)
        FROM public.parametrizacao_protocolos_tipos WHERE empresa_id = $1
      $sql$ INTO v_keys, v_canonical USING v_empresa_id;
      IF v_quantidade IS DISTINCT FROM 10 OR v_keys IS DISTINCT FROM ARRAY[
        'dctfweb', 'esocial', 'extrato-bancario', 'folha-pagamento',
        'irpj-csll-trimestral', 'pgdas', 'reinf', 'sped-contribuicoes',
        'sped-fiscal', 'xml-nfe'
      ]::text[] OR v_canonical IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Limpeza abortada: os tipos de protocolo nao correspondem ao manifesto canonico.';
      END IF;
    END IF;
  END IF;

  IF to_regclass('public.parametrizacao_regimes_tributarios') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.parametrizacao_regimes_tributarios WHERE empresa_id = $1'
      INTO v_quantidade USING v_empresa_id;
    IF v_quantidade > 0 THEN
      EXECUTE $sql$
        SELECT array_agg(codigo::text ORDER BY codigo::text COLLATE "C"),
               bool_and(sistema IS TRUE AND ativo IS TRUE)
        FROM public.parametrizacao_regimes_tributarios WHERE empresa_id = $1
      $sql$ INTO v_keys, v_canonical USING v_empresa_id;
      IF v_quantidade IS DISTINCT FROM 6 OR v_keys IS DISTINCT FROM ARRAY[
        'isenta', 'lucro_presumido', 'lucro_real', 'mei', 'pessoa_fisica', 'simples_nacional'
      ]::text[] OR v_canonical IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Limpeza abortada: os regimes nao correspondem ao manifesto canonico.';
      END IF;
    END IF;
  END IF;

  IF to_regclass('public.parametrizacao_regras_imposto') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.parametrizacao_regras_imposto WHERE empresa_id = $1'
      INTO v_quantidade USING v_empresa_id;
    IF v_quantidade > 0 THEN
      EXECUTE $sql$
        SELECT array_agg(nome::text || ':' || regime::text || ':' || cnae_codigo::text
                         ORDER BY (nome::text || ':' || regime::text || ':' || cnae_codigo::text) COLLATE "C"),
               bool_and(sistema IS TRUE AND ativo IS TRUE)
        FROM public.parametrizacao_regras_imposto WHERE empresa_id = $1
      $sql$ INTO v_keys, v_canonical USING v_empresa_id;
      IF v_quantidade IS DISTINCT FROM 3 OR v_keys IS DISTINCT FROM ARRAY[
        'Comércio - PIS/COFINS Monofásico:Lucro Presumido:4711-3/00',
        'TI - Alíquota Básica Presumido:Lucro Presumido:6201-5/00',
        'TI - Alíquota Básica Real:Lucro Real:6201-5/00'
      ]::text[] OR v_canonical IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Limpeza abortada: as regras de imposto nao correspondem ao manifesto canonico.';
      END IF;
    END IF;
  END IF;

  IF to_regclass('public.parametrizacao_regras_cnab') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.parametrizacao_regras_cnab WHERE empresa_id = $1'
      INTO v_quantidade USING v_empresa_id;
    IF v_quantidade > 0 THEN
      EXECUTE $sql$
        SELECT array_agg(nome::text || ':' || banco::text || ':' || tipo_regra::text
                         ORDER BY (nome::text || ':' || banco::text || ':' || tipo_regra::text) COLLATE "C"),
               bool_and(sistema IS TRUE AND ativo IS TRUE)
        FROM public.parametrizacao_regras_cnab WHERE empresa_id = $1
      $sql$ INTO v_keys, v_canonical USING v_empresa_id;
      IF v_quantidade IS DISTINCT FROM 3 OR v_keys IS DISTINCT FROM ARRAY[
        'Conciliação automática - Recebimento PIX:Itaú:conciliacao',
        'Conciliação automática - Tarifas Asaas:Asaas:conciliacao',
        'Juros e Multa Padrão Boleto Asaas:Asaas:cobranca'
      ]::text[] OR v_canonical IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Limpeza abortada: as regras CNAB nao correspondem ao manifesto canonico.';
      END IF;
    END IF;
  END IF;

  IF to_regclass('public.agenda_responsaveis') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.agenda_responsaveis WHERE empresa_id = $1'
      INTO v_quantidade USING v_empresa_id;
    IF v_quantidade NOT IN (0, 1) THEN
      RAISE EXCEPTION 'Limpeza abortada: existem responsaveis de agenda fora do scaffold.';
    END IF;
    IF v_quantidade = 1 THEN
      EXECUTE $sql$
        SELECT bool_and(
          nome IS NOT DISTINCT FROM 'João Silva Demonstração'
          AND perfil IS NOT DISTINCT FROM 'Administrador'
          AND status IS NOT DISTINCT FROM 'Inativo'
          AND ativo IS FALSE
          AND sistema IS FALSE
          AND user_id IS NOT DISTINCT FROM $2
          AND config_usuario_id IS NOT DISTINCT FROM $3
        )
        FROM public.agenda_responsaveis WHERE empresa_id = $1
      $sql$ INTO v_canonical USING v_empresa_id, v_user_id, v_config_usuario_id;
      IF v_canonical IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Limpeza abortada: o responsavel da agenda nao corresponde ao scaffold.';
      END IF;
    END IF;
  END IF;

END;
$$;

REVOKE ALL ON FUNCTION public.validar_scaffolds_tenant_demonstracao(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.listar_referencias_tenant_demonstracao(
  p_empresa_id uuid,
  p_ignorar text[]
)
RETURNS text[]
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_relation record;
  v_reference record;
  v_exists boolean;
  v_label text;
  v_blockers text[] := ARRAY[]::text[];
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint reference_constraint
    WHERE reference_constraint.contype = 'f'
      AND reference_constraint.confrelid = 'public.empresas'::regclass
      AND cardinality(reference_constraint.conkey) IS DISTINCT FROM 1
  ) THEN
    RAISE EXCEPTION
      'Limpeza abortada: foi encontrada uma FK nao classificada para empresas.';
  END IF;

  FOR v_relation IN
    SELECT namespace.nspname AS relation_schema, relation.relname AS relation_name
    FROM pg_catalog.pg_attribute attribute
    JOIN pg_catalog.pg_class relation ON relation.oid = attribute.attrelid
    JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relkind IN ('r', 'p')
      AND attribute.attname = 'empresa_id'
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND NOT (relation.relname = ANY(COALESCE(p_ignorar, ARRAY[]::text[])))
    ORDER BY namespace.nspname, relation.relname
  LOOP
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM %I.%I WHERE empresa_id::text = $1::text)',
      v_relation.relation_schema,
      v_relation.relation_name
    ) INTO v_exists USING p_empresa_id;

    IF v_exists THEN
      v_label := format('%I.%I(empresa_id)', v_relation.relation_schema, v_relation.relation_name);
      IF NOT (v_label = ANY(v_blockers)) THEN
        v_blockers := array_append(v_blockers, v_label);
      END IF;
    END IF;
  END LOOP;

  FOR v_reference IN
    SELECT
      namespace.nspname AS relation_schema,
      relation.relname AS relation_name,
      reference_constraint.conname AS constraint_name,
      attribute.attname AS column_name
    FROM pg_catalog.pg_constraint reference_constraint
    JOIN pg_catalog.pg_class relation ON relation.oid = reference_constraint.conrelid
    JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
    JOIN pg_catalog.pg_attribute attribute
      ON attribute.attrelid = reference_constraint.conrelid
     AND attribute.attnum = reference_constraint.conkey[1]
    WHERE reference_constraint.contype = 'f'
      AND reference_constraint.confrelid = 'public.empresas'::regclass
      AND NOT (
        namespace.nspname = 'public'
        AND relation.relname = ANY(COALESCE(p_ignorar, ARRAY[]::text[]))
      )
    ORDER BY namespace.nspname, relation.relname, reference_constraint.conname
  LOOP
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I::text = $1::text)',
      v_reference.relation_schema,
      v_reference.relation_name,
      v_reference.column_name
    ) INTO v_exists USING p_empresa_id;

    IF v_exists THEN
      v_label := format(
        '%I.%I(%I:%I)',
        v_reference.relation_schema,
        v_reference.relation_name,
        v_reference.column_name,
        v_reference.constraint_name
      );
      IF NOT (v_label = ANY(v_blockers)) THEN
        v_blockers := array_append(v_blockers, v_label);
      END IF;
    END IF;
  END LOOP;

  RETURN v_blockers;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_referencias_tenant_demonstracao(uuid, text[])
  FROM PUBLIC, anon, authenticated;
