-- Mantém somente a Calculadora de Rescisão no módulo Simulações.
-- A remoção é física: apaga RPCs, tabelas e parâmetros exclusivos dos fluxos
-- descontinuados, sem afetar Reforma Tributária nem os helpers de INSS/IRRF.

-- Entradas públicas/agregadoras devem sair antes dos helpers que elas chamam.
DROP FUNCTION IF EXISTS public.calcular_simulacoes_contabeis(jsonb);
DROP FUNCTION IF EXISTS public.calcular_simulacao_contabil(text, jsonb);
DROP FUNCTION IF EXISTS public.envelope_simulacao_existente(text, jsonb);
DROP FUNCTION IF EXISTS public.executar_simulacao_contabil_interna(text, jsonb);

DROP FUNCTION IF EXISTS public.simular_carne_leao(jsonb);
DROP FUNCTION IF EXISTS public.simular_comparativo_regime(jsonb);
DROP FUNCTION IF EXISTS public.simular_contratacao(jsonb);
DROP FUNCTION IF EXISTS public.simular_custos(jsonb);
DROP FUNCTION IF EXISTS public.simular_das(jsonb);
DROP FUNCTION IF EXISTS public.simular_encargos_trabalhistas(jsonb);
DROP FUNCTION IF EXISTS public.simular_ferias(jsonb);
DROP FUNCTION IF EXISTS public.simular_folha(jsonb);
DROP FUNCTION IF EXISTS public.simular_ganho_capital(jsonb);
DROP FUNCTION IF EXISTS public.simular_imposto_estimado(jsonb);
DROP FUNCTION IF EXISTS public.simular_irpf_anual(jsonb);
DROP FUNCTION IF EXISTS public.simular_mei(jsonb);
DROP FUNCTION IF EXISTS public.simular_mei_calculo_versionado(jsonb);
DROP FUNCTION IF EXISTS public.simular_multas(jsonb);
DROP FUNCTION IF EXISTS public.simular_pis_cofins(jsonb);
DROP FUNCTION IF EXISTS public.simular_prolabore(jsonb);
DROP FUNCTION IF EXISTS public.simular_prolabore_dividendos(jsonb);
DROP FUNCTION IF EXISTS public.simular_tempo_empresa(jsonb);

-- O Planejamento Tributário era um fluxo filho oculto de Simulações.
DROP FUNCTION IF EXISTS public.salvar_planejamento_tributario(uuid, text);
DROP FUNCTION IF EXISTS public.gerar_diagnostico_tributario_json(jsonb, jsonb);
DROP FUNCTION IF EXISTS public.get_planejamento_historico();
DROP FUNCTION IF EXISTS public.get_planejamento_clientes();
DROP FUNCTION IF EXISTS public.consultar_enquadramento_simples_json(numeric, text);
DROP FUNCTION IF EXISTS public.calcular_planejamento_tributario(numeric, text);
DROP TABLE IF EXISTS public.planejamento_tributario_historico;

-- Estruturas sem qualquer consumidor depois da exclusão dos simuladores.
DROP FUNCTION IF EXISTS public.ultimo_dia_util_estimado(date);
DROP FUNCTION IF EXISTS public.calculo_data_segura(text, date);
DROP FUNCTION IF EXISTS public.tributario_competencia_json(jsonb, date);
DROP TABLE IF EXISTS public.taxas_selic_mensais;

-- Remove inclusive overrides por empresa e faixas ligadas aos tipos antigos.
-- As faixas são apagadas por ON DELETE CASCADE.
DELETE FROM public.parametros_tributarios
WHERE tipo NOT IN ('inss', 'irrf_mensal');

ALTER TABLE public.parametros_tributarios
  DROP CONSTRAINT IF EXISTS parametros_tributarios_tipo_check;
ALTER TABLE public.parametros_tributarios
  ADD CONSTRAINT parametros_tributarios_tipo_check
  CHECK (tipo IN ('inss', 'irrf_mensal'));

-- Elimina históricos antigos e impede que qualquer fluxo removido volte a
-- persistir registros nessa tabela.
DELETE FROM public.simulacoes_historico
WHERE tipo <> 'rescisao';

ALTER TABLE public.simulacoes_historico
  DROP CONSTRAINT IF EXISTS simulacoes_historico_tipo_check;
ALTER TABLE public.simulacoes_historico
  ADD CONSTRAINT simulacoes_historico_tipo_check
  CHECK (tipo = 'rescisao');

-- Em instalações que ainda possuem somente a implementação antiga pública,
-- transforma-a em helper privado antes de publicar o contrato validado.
DO $$
BEGIN
  IF pg_catalog.to_regprocedure('public.simular_rescisao_interna(jsonb)') IS NULL THEN
    IF pg_catalog.to_regprocedure('public.simular_rescisao(jsonb)') IS NULL THEN
      RAISE EXCEPTION 'A implementação da Calculadora de Rescisão não foi encontrada.';
    END IF;
    ALTER FUNCTION public.simular_rescisao(jsonb)
      RENAME TO simular_rescisao_interna;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.simular_rescisao_interna(jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.simular_rescisao(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_chave text;
  v_valor numeric;
  v_tipo text;
  v_aviso text;
  v_chaves constant text[] := ARRAY[
    'salario', 'saldoFGTS', 'adicionalTempoServicoValor',
    'adicionalTempoServicoPercentual'
  ]::text[];
BEGIN
  IF auth.uid() IS NULL
     OR v_empresa_id IS NULL
     OR COALESCE(public.current_user_is_client_scoped(v_empresa_id), true)
     OR NOT COALESCE(
       public.current_user_has_permission(v_empresa_id, 'simulacoes:view'),
       false
     ) THEN
    RAISE EXCEPTION 'Sem permissão para simular rescisão'
      USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p) IS DISTINCT FROM 'object'
     OR octet_length(COALESCE(p, 'null'::jsonb)::text) > 65536 THEN
    RAISE EXCEPTION 'Parâmetros da rescisão inválidos ou muito grandes'
      USING ERRCODE = '22023';
  END IF;

  v_tipo := COALESCE(NULLIF(p ->> 'tipo', ''), 'sem_justa_causa');
  v_aviso := COALESCE(NULLIF(p ->> 'avisoPrevioModo', ''), 'cumprido');
  IF v_tipo NOT IN ('sem_justa_causa', 'com_justa_causa', 'pedido_demissao')
     OR v_aviso NOT IN ('cumprido', 'descontado', 'indenizado')
     OR (v_tipo = 'sem_justa_causa' AND v_aviso NOT IN ('cumprido', 'indenizado'))
     OR (v_tipo = 'com_justa_causa' AND v_aviso <> 'cumprido')
     OR (v_tipo = 'pedido_demissao' AND v_aviso NOT IN ('cumprido', 'descontado')) THEN
    RAISE EXCEPTION 'Combinação de tipo de rescisão e aviso prévio inválida'
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE(NULLIF(p ->> 'adicionalTempoServicoTipo', ''), 'trienio')
       NOT IN ('trienio', 'quinquenio', 'manual') THEN
    RAISE EXCEPTION 'Tipo de adicional por tempo de serviço inválido'
      USING ERRCODE = '22023';
  END IF;

  IF (p ? 'adicionalTempoServicoAtivo'
      AND jsonb_typeof(p -> 'adicionalTempoServicoAtivo') IS DISTINCT FROM 'boolean')
     OR (p ? 'feriasVencidasEmDobro'
      AND jsonb_typeof(p -> 'feriasVencidasEmDobro') IS DISTINCT FROM 'boolean') THEN
    RAISE EXCEPTION 'Indicador booleano da rescisão inválido'
      USING ERRCODE = '22023';
  END IF;

  IF p ? 'feriasVencidasPeriodos' THEN
    IF jsonb_typeof(p -> 'feriasVencidasPeriodos') NOT IN ('number', 'string')
       OR octet_length(p ->> 'feriasVencidasPeriodos') > 4
       OR (jsonb_typeof(p -> 'feriasVencidasPeriodos') = 'string'
         AND (p ->> 'feriasVencidasPeriodos') !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Quantidade de férias vencidas inválida'
        USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_valor := (p ->> 'feriasVencidasPeriodos')::numeric;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'Quantidade de férias vencidas inválida'
        USING ERRCODE = '22023';
    END;
    IF v_valor < 0 OR v_valor > 100 OR trunc(v_valor) <> v_valor THEN
      RAISE EXCEPTION 'Quantidade de férias vencidas inválida'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  FOREACH v_chave IN ARRAY v_chaves LOOP
    IF NOT (p ? v_chave) THEN
      CONTINUE;
    END IF;
    IF jsonb_typeof(p -> v_chave) NOT IN ('number', 'string')
       OR octet_length(p ->> v_chave) > 40
       OR (jsonb_typeof(p -> v_chave) = 'string'
         AND (p ->> v_chave) !~ '^[0-9]+([.][0-9]+)?$') THEN
      RAISE EXCEPTION 'Valor numérico da rescisão inválido: %', v_chave
        USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_valor := (p ->> v_chave)::numeric;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'Valor numérico da rescisão inválido: %', v_chave
        USING ERRCODE = '22023';
    END;
    IF v_valor < 0
       OR (v_chave = 'adicionalTempoServicoPercentual' AND v_valor > 100)
       OR (v_chave <> 'adicionalTempoServicoPercentual' AND v_valor > 999999999.99) THEN
      RAISE EXCEPTION 'Valor numérico da rescisão fora da faixa: %', v_chave
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  RETURN public.simular_rescisao_interna(p);
END;
$$;

REVOKE ALL ON FUNCTION public.simular_rescisao(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simular_rescisao(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.listar_parametros_tributarios(p_tipo text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_resultado jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR COALESCE(public.current_user_is_client_scoped(v_empresa_id), true)
     OR NOT COALESCE(
       public.current_user_has_permission(v_empresa_id, 'simulacoes:view')
       OR public.current_user_has_permission(v_empresa_id, 'parametrizacao:view')
       OR public.current_user_has_permission(v_empresa_id, 'parametrizacao:manage'),
       false
     ) THEN
    RAISE EXCEPTION 'Parâmetros tributários não encontrados.' USING ERRCODE = '42501';
  END IF;
  IF p_tipo IS NOT NULL AND p_tipo NOT IN ('inss', 'irrf_mensal') THEN
    RAISE EXCEPTION 'Tipo de parâmetro tributário inválido.';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(resultado) ORDER BY resultado.tipo, resultado.nome), '[]'::jsonb)
  INTO v_resultado
  FROM (
    SELECT DISTINCT ON (parametro.codigo)
      parametro.id,
      parametro.codigo,
      parametro.tipo,
      parametro.nome,
      parametro.vigencia_inicio AS "vigenciaInicio",
      parametro.vigencia_fim AS "vigenciaFim",
      parametro.versao,
      parametro.fonte_url AS fonte,
      parametro.norma,
      parametro.bloqueado,
      (parametro.empresa_id IS NULL) AS oficial,
      parametro.configuracao,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'ordem', faixa.ordem,
          'limiteInferior', faixa.limite_inferior,
          'limiteSuperior', faixa.limite_superior,
          'aliquota', faixa.aliquota,
          'parcelaDeduzir', faixa.parcela_deduzir,
          'configuracao', faixa.configuracao
        ) ORDER BY faixa.ordem)
        FROM public.parametros_tributarios_faixas faixa
        WHERE faixa.parametro_id = parametro.id
      ), '[]'::jsonb) AS faixas
    FROM public.parametros_tributarios parametro
    WHERE (parametro.empresa_id IS NULL OR parametro.empresa_id = v_empresa_id)
      AND parametro.tipo IN ('inss', 'irrf_mensal')
      AND (p_tipo IS NULL OR parametro.tipo = p_tipo)
      AND parametro.vigencia_inicio <= CURRENT_DATE
      AND (parametro.vigencia_fim IS NULL OR parametro.vigencia_fim >= CURRENT_DATE)
    ORDER BY parametro.codigo,
      (parametro.empresa_id = v_empresa_id) DESC,
      parametro.vigencia_inicio DESC,
      parametro.criado_em DESC
  ) resultado;
  RETURN v_resultado;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_parametros_tributarios_por_competencia(
  p_tipo text DEFAULT NULL,
  p_competencia date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_competencia date := COALESCE(p_competencia, CURRENT_DATE);
  v_resultado jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR COALESCE(public.current_user_is_client_scoped(v_empresa_id), true)
     OR NOT COALESCE(
       public.current_user_has_permission(v_empresa_id, 'simulacoes:view')
       OR public.current_user_has_permission(v_empresa_id, 'parametrizacao:view')
       OR public.current_user_has_permission(v_empresa_id, 'parametrizacao:manage'),
       false
     ) THEN
    RAISE EXCEPTION 'Parâmetros tributários não encontrados.' USING ERRCODE = '42501';
  END IF;
  IF p_tipo IS NOT NULL AND p_tipo NOT IN ('inss', 'irrf_mensal') THEN
    RAISE EXCEPTION 'Tipo de parâmetro tributário inválido.';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(resultado) ORDER BY resultado.tipo, resultado.nome), '[]'::jsonb)
  INTO v_resultado
  FROM (
    SELECT DISTINCT ON (parametro.codigo)
      parametro.id,
      parametro.codigo,
      parametro.tipo,
      parametro.nome,
      parametro.vigencia_inicio AS "vigenciaInicio",
      parametro.vigencia_fim AS "vigenciaFim",
      parametro.versao,
      parametro.fonte_url AS fonte,
      parametro.norma,
      parametro.bloqueado,
      (parametro.empresa_id IS NULL) AS oficial,
      parametro.configuracao,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'ordem', faixa.ordem,
          'limiteInferior', faixa.limite_inferior,
          'limiteSuperior', faixa.limite_superior,
          'aliquota', faixa.aliquota,
          'parcelaDeduzir', faixa.parcela_deduzir,
          'configuracao', faixa.configuracao
        ) ORDER BY faixa.ordem)
        FROM public.parametros_tributarios_faixas faixa
        WHERE faixa.parametro_id = parametro.id
      ), '[]'::jsonb) AS faixas
    FROM public.parametros_tributarios parametro
    WHERE (parametro.empresa_id IS NULL OR parametro.empresa_id = v_empresa_id)
      AND parametro.tipo IN ('inss', 'irrf_mensal')
      AND (p_tipo IS NULL OR parametro.tipo = p_tipo)
      AND parametro.vigencia_inicio <= v_competencia
      AND (parametro.vigencia_fim IS NULL OR parametro.vigencia_fim >= v_competencia)
    ORDER BY parametro.codigo,
      (parametro.empresa_id = v_empresa_id) DESC,
      parametro.vigencia_inicio DESC,
      parametro.criado_em DESC
  ) resultado;
  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_parametros_tributarios(text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.listar_parametros_tributarios_por_competencia(text, date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_parametros_tributarios(text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_parametros_tributarios_por_competencia(text, date)
  TO authenticated;

-- Atualiza o catálogo canônico sem depender de uma migration remota anterior:
-- quando o guard mais novo existir ele é usado; em instalação limpa, cai para
-- a verificação de membresia já presente no histórico local.
CREATE OR REPLACE FUNCTION public.listar_configuracoes_modulos_sistema()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_access_allowed boolean := false;
  v_modulos jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.' USING ERRCODE = '42501';
  END IF;

  IF pg_catalog.to_regprocedure('public.current_user_access_allowed(uuid)') IS NOT NULL THEN
    EXECUTE 'SELECT public.current_user_access_allowed($1)'
      INTO v_access_allowed
      USING v_empresa_id;
  ELSE
    v_access_allowed := public.is_empresa_member(v_empresa_id);
  END IF;
  IF NOT COALESCE(v_access_allowed, false) THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.' USING ERRCODE = '42501';
  END IF;

  WITH catalogo(modulo, nome, descricao, categoria, obrigatorio, ordem, permissoes) AS (
    VALUES
      ('inicio', 'Início', 'Painel principal e atalhos do escritório.', 'Essencial', true, 10, ARRAY['inicio:view']),
      ('clientes', 'Clientes', 'Cadastro e gestão da carteira de empresas.', 'Essencial', true, 20, ARRAY['clientes:view','clientes:create','clientes:update']),
      ('atividades', 'Atividades', 'Filas, rotinas, equipe e fechamentos.', 'Operação', false, 30, ARRAY['atividades:view','atividades:view-own','atividades:manage']),
      ('conformidade', 'Conformidade', 'Controle de prazos, riscos e obrigações.', 'Operação', false, 40, ARRAY['conformidade:view']),
      ('protocolos', 'Acompanhamento', 'Histórico mensal, evidências e entregas por empresa.', 'Operação', false, 50, ARRAY['protocolos:view','protocolos:create','protocolos:manage']),
      ('simulacoes-calculos', 'Simulações', 'Calculadora de Rescisão.', 'Trabalhista', false, 60, ARRAY['simulacoes:view']),
      ('reforma-tributaria', 'Reforma Tributária', 'Adequação, XML, IBS/CBS e split payment.', 'Tributário', false, 70, ARRAY['reforma-tributaria:view','reforma-tributaria:manage']),
      ('faturamento', 'Faturamento', 'Contratos, cobranças e recebimentos.', 'Financeiro', false, 80, ARRAY['faturamento:view','faturamento:manage']),
      ('financeiro', 'Financeiro', 'Caixa, contas a pagar e movimentações.', 'Financeiro', false, 90, ARRAY['financeiro:view','financeiro:manage']),
      ('documentos', 'Documentos', 'Biblioteca e arquivos dos clientes.', 'Documentos', false, 100, ARRAY['documentos:view','documentos:view-own','documentos:create','documentos:create-own','documentos:manage']),
      ('agenda', 'Agenda', 'Prazos, compromissos e datas do escritório.', 'Operação', false, 110, ARRAY['agenda:view','agenda:view-own','agenda:manage']),
      ('parametrizacao', 'Parametrização', 'Catálogos, impostos e regras operacionais.', 'Administração', false, 120, ARRAY['parametrizacao:view','parametrizacao:manage']),
      ('configuracoes', 'Configurações', 'Empresa, usuários, permissões e integrações.', 'Essencial', true, 130, ARRAY['configuracoes:view','configuracoes:manage','meu-perfil:manage','usuarios:manage','perfis:manage','contas-bancarias:manage','integracao-bancaria:manage','integracao-fiscal:manage'])
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', catalogo.modulo,
    'nome', catalogo.nome,
    'descricao', catalogo.descricao,
    'categoria', catalogo.categoria,
    'obrigatorio', catalogo.obrigatorio,
    'habilitado',
      (CASE
        WHEN catalogo.obrigatorio THEN true
        ELSE COALESCE(configuracao.habilitado, true)
      END)
      AND CASE
        WHEN catalogo.modulo = 'conformidade' THEN
          public.current_user_has_permission(v_empresa_id, 'conformidade:view')
          AND (
            public.current_user_has_permission(v_empresa_id, 'atividades:manage')
            OR public.current_user_has_permission(v_empresa_id, 'atividades:view')
            OR public.current_user_has_permission(v_empresa_id, 'atividades:view-own')
          )
        ELSE EXISTS (
          SELECT 1
          FROM pg_catalog.unnest(catalogo.permissoes) permissao
          WHERE public.current_user_has_permission(v_empresa_id, permissao)
        )
      END,
    'ordem', catalogo.ordem
  ) ORDER BY catalogo.ordem), '[]'::jsonb)
  INTO v_modulos
  FROM catalogo
  LEFT JOIN public.configuracoes_modulos_sistema configuracao
    ON configuracao.empresa_id = v_empresa_id
   AND configuracao.modulo = catalogo.modulo;

  RETURN jsonb_build_object(
    'canManage', public.configuracoes_modulos_can_manage(),
    'modulos', v_modulos
  );
END;
$$;

REVOKE ALL ON FUNCTION public.listar_configuracoes_modulos_sistema()
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_configuracoes_modulos_sistema()
  TO authenticated;
