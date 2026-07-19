-- Corrige cálculos objetivos identificados na auditoria de Simulações.
-- Fontes principais:
-- - MTE: rescisão, férias e 13º proporcional
-- - RFB: incidências previdenciárias/IRRF e acréscimos legais
-- - CAIXA: recolhimentos rescisórios do FGTS
-- - BCB SGS 4390: Selic acumulada no mês

CREATE TABLE IF NOT EXISTS public.taxas_selic_mensais (
  competencia date PRIMARY KEY,
  taxa_percentual numeric(8, 4) NOT NULL CHECK (taxa_percentual >= 0),
  fonte text NOT NULL DEFAULT 'BCB SGS 4390',
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CHECK (competencia = date_trunc('month', competencia)::date)
);

ALTER TABLE public.taxas_selic_mensais ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.taxas_selic_mensais FROM PUBLIC, anon, authenticated;

INSERT INTO public.taxas_selic_mensais (competencia, taxa_percentual)
VALUES
  ('2025-01-01', 1.01), ('2025-02-01', 0.99), ('2025-03-01', 0.96),
  ('2025-04-01', 1.06), ('2025-05-01', 1.14), ('2025-06-01', 1.10),
  ('2025-07-01', 1.28), ('2025-08-01', 1.16), ('2025-09-01', 1.22),
  ('2025-10-01', 1.28), ('2025-11-01', 1.05), ('2025-12-01', 1.22),
  ('2026-01-01', 1.16), ('2026-02-01', 1.00), ('2026-03-01', 1.21),
  ('2026-04-01', 1.09), ('2026-05-01', 1.07), ('2026-06-01', 1.12)
ON CONFLICT (competencia) DO UPDATE SET
  taxa_percentual = EXCLUDED.taxa_percentual,
  fonte = EXCLUDED.fonte,
  atualizado_em = now();

COMMENT ON TABLE public.taxas_selic_mensais IS
  'Taxa Selic acumulada no mês, série oficial BCB SGS 4390; usada nos acréscimos legais de DARF.';

CREATE OR REPLACE FUNCTION public.envelope_simulacao_existente(p_tipo text, p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_competencia date;
  v_resultado jsonb;
  v_versoes jsonb := '[]'::jsonb;
  v_param jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.current_empresa_id() IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa vinculada.';
  END IF;
  IF jsonb_typeof(COALESCE(p, '{}'::jsonb)) <> 'object'
     OR octet_length(COALESCE(p, '{}'::jsonb)::text) > 65536 THEN
    RAISE EXCEPTION 'Entrada inválida ou muito grande.';
  END IF;

  v_competencia := public.tributario_competencia_json(p, CURRENT_DATE);
  v_resultado := public.executar_simulacao_contabil_interna(p_tipo, p);
  IF p_tipo IN ('folha', 'ferias', 'rescisao', 'prolabore', 'simulacao-contratacao') THEN
    v_param := public.obter_parametro_tributario('inss', v_competencia, public.current_empresa_id());
    v_versoes := v_versoes || jsonb_build_array(jsonb_build_object('codigo', v_param ->> 'codigo', 'versao', v_param ->> 'versao'));
    v_param := public.obter_parametro_tributario('irrf_mensal', v_competencia, public.current_empresa_id());
    v_versoes := v_versoes || jsonb_build_array(jsonb_build_object('codigo', v_param ->> 'codigo', 'versao', v_param ->> 'versao'));
  END IF;
  RETURN jsonb_build_object(
    'tipo', replace(p_tipo, '-', '_'),
    'competencia', v_competencia,
    'versoesParametros', v_versoes,
    'resultado', v_resultado,
    'memoriaCalculo', '[]'::jsonb,
    'alertas', jsonb_build_array('Resultado estimativo. Confira os dados e a legislação aplicável antes de concluir.'),
    'estimativa', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.envelope_simulacao_existente(text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.simular_rescisao(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_admissao date;
  v_demissao date;
  v_data_projetada date;
  v_competencia date;
  v_tipo text;
  v_aviso_modo text;
  v_salario numeric;
  v_adicional numeric := 0;
  v_base numeric;
  v_anos integer;
  v_anos_projetados integer;
  v_aviso_dias integer := 0;
  v_aviso_valor numeric := 0;
  v_aviso_desconto numeric := 0;
  v_avos_13 integer := 0;
  v_avos_ferias integer := 0;
  v_dias_saldo integer := 0;
  v_periodos_integrais_projecao integer := 0;
  v_inicio_aquisitivo date;
  v_idade_aquisitiva interval;
  v_saldo_salario numeric;
  v_decimo_terceiro numeric := 0;
  v_ferias_proporcionais numeric := 0;
  v_terco_proporcional numeric := 0;
  v_ferias_vencidas numeric;
  v_terco_vencidas numeric;
  v_inss_saldo numeric;
  v_inss_13 numeric := 0;
  v_irrf_saldo jsonb;
  v_irrf_13 jsonb := jsonb_build_object('valor', 0);
  v_desconto_simplificado numeric;
  v_total_bruto numeric;
  v_total_descontos numeric;
  v_total_liquido numeric;
  v_saldo_fgts numeric;
  v_fgts_rescisorio numeric;
  v_base_multa_fgts numeric;
  v_multa_fgts numeric := 0;
  v_memoria jsonb;
  v_alertas jsonb;
  v_versoes jsonb;
  v_inss_param jsonb;
  v_irrf_param jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa vinculada.'; END IF;
  IF jsonb_typeof(COALESCE(p, '{}'::jsonb)) <> 'object'
     OR octet_length(COALESCE(p, '{}'::jsonb)::text) > 65536 THEN
    RAISE EXCEPTION 'Entrada inválida ou muito grande.';
  END IF;

  v_admissao := NULLIF(p ->> 'dataAdmissao', '')::date;
  v_demissao := NULLIF(p ->> 'dataDemissao', '')::date;
  IF v_admissao IS NULL OR v_demissao IS NULL OR v_demissao < v_admissao THEN
    RAISE EXCEPTION 'Datas de admissão e demissão inválidas.';
  END IF;

  v_tipo := COALESCE(NULLIF(p ->> 'tipo', ''), 'sem_justa_causa');
  IF v_tipo NOT IN ('sem_justa_causa', 'com_justa_causa', 'pedido_demissao') THEN
    RAISE EXCEPTION 'Tipo de rescisão não suportado.';
  END IF;
  v_aviso_modo := COALESCE(NULLIF(p ->> 'avisoPrevioModo', ''), 'cumprido');
  IF v_aviso_modo NOT IN ('cumprido', 'descontado', 'indenizado') THEN RAISE EXCEPTION 'Modo de aviso prévio inválido.'; END IF;

  v_salario := GREATEST(public.tributario_numero_json(p, 'salario'), 0);
  v_anos := GREATEST(extract(year FROM age(v_demissao, v_admissao))::integer, 0);
  IF COALESCE((p ->> 'adicionalTempoServicoAtivo')::boolean, false) THEN
    IF p ->> 'adicionalTempoServicoTipo' = 'manual' THEN
      v_adicional := GREATEST(public.tributario_numero_json(p, 'adicionalTempoServicoValor'), 0);
    ELSIF p ->> 'adicionalTempoServicoTipo' = 'quinquenio' THEN
      v_adicional := v_salario * floor(v_anos / 5.0) * GREATEST(public.tributario_numero_json(p, 'adicionalTempoServicoPercentual'), 0) / 100;
    ELSE
      v_adicional := v_salario * floor(v_anos / 3.0) * GREATEST(public.tributario_numero_json(p, 'adicionalTempoServicoPercentual'), 0) / 100;
    END IF;
  END IF;
  v_base := v_salario + v_adicional;

  IF v_tipo = 'sem_justa_causa' AND v_aviso_modo = 'indenizado' THEN
    v_aviso_dias := LEAST(30 + v_anos * 3, 90);
    v_aviso_valor := v_base / 30 * v_aviso_dias;
  ELSIF v_tipo = 'pedido_demissao' AND v_aviso_modo = 'descontado' THEN
    v_aviso_desconto := v_base;
  END IF;
  v_data_projetada := v_demissao + v_aviso_dias;
  v_anos_projetados := GREATEST(extract(year FROM age(v_data_projetada, v_admissao))::integer, 0);

  -- Mensalistas usam divisor 30; limita o saldo aos dias efetivamente trabalhados
  -- no mês para também cobrir admissão e desligamento na mesma competência.
  v_dias_saldo := LEAST(
    GREATEST(v_demissao - GREATEST(v_admissao, date_trunc('month', v_demissao)::date) + 1, 0),
    30
  );
  v_saldo_salario := v_base / 30 * v_dias_saldo;
  IF v_tipo <> 'com_justa_causa' THEN
    SELECT count(*)::integer
      INTO v_avos_13
    FROM generate_series(
      date_trunc('month', GREATEST(v_admissao, date_trunc('year', v_demissao)::date)),
      date_trunc('month', v_data_projetada),
      interval '1 month'
    ) AS mes
    WHERE LEAST(v_data_projetada, (mes + interval '1 month - 1 day')::date)
      - GREATEST(v_admissao, mes::date) + 1 >= 15;

    v_inicio_aquisitivo := (v_admissao + make_interval(years => v_anos_projetados))::date;
    v_idade_aquisitiva := age(v_data_projetada, v_inicio_aquisitivo);
    v_avos_ferias := LEAST(
      extract(month FROM v_idade_aquisitiva)::integer
        + CASE WHEN extract(day FROM v_idade_aquisitiva) >= 15 THEN 1 ELSE 0 END,
      12
    );
    v_periodos_integrais_projecao := GREATEST(v_anos_projetados - v_anos, 0);
    v_decimo_terceiro := v_base / 12 * v_avos_13;
    v_ferias_proporcionais := v_base / 12 * v_avos_ferias;
    v_terco_proporcional := v_ferias_proporcionais / 3;
  END IF;

  v_ferias_vencidas := v_base
    * (GREATEST(public.tributario_numero_json(p, 'feriasVencidasPeriodos'), 0) + v_periodos_integrais_projecao)
    * CASE WHEN COALESCE((p ->> 'feriasVencidasEmDobro')::boolean, false) THEN 2 ELSE 1 END;
  v_terco_vencidas := v_ferias_vencidas / 3;
  v_competencia := date_trunc('month', v_demissao)::date;
  v_inss_param := public.obter_parametro_tributario('inss', v_competencia, v_empresa_id);
  v_irrf_param := public.obter_parametro_tributario('irrf_mensal', v_competencia, v_empresa_id);
  IF v_inss_param = '{}'::jsonb OR v_irrf_param = '{}'::jsonb THEN RAISE EXCEPTION 'Parâmetros de INSS/IRRF ausentes para a rescisão.'; END IF;
  v_desconto_simplificado := COALESCE((v_irrf_param #>> '{configuracao,descontoSimplificado}')::numeric, 0);

  v_inss_saldo := public.calculo_inss_progressivo(v_saldo_salario, v_competencia);
  v_inss_13 := public.calculo_inss_progressivo(v_decimo_terceiro, v_competencia);
  v_irrf_saldo := public.calculo_irrf_detalhado(
    GREATEST(v_saldo_salario - GREATEST(v_inss_saldo, v_desconto_simplificado), 0),
    v_saldo_salario,
    v_competencia,
    false
  );
  IF v_decimo_terceiro > 0 THEN
    v_irrf_13 := public.calculo_irrf_detalhado(
      GREATEST(v_decimo_terceiro - GREATEST(v_inss_13, v_desconto_simplificado), 0),
      v_decimo_terceiro,
      v_competencia,
      false
    );
  END IF;

  v_total_bruto := v_saldo_salario + v_decimo_terceiro + v_ferias_proporcionais
    + v_terco_proporcional + v_ferias_vencidas + v_terco_vencidas + v_aviso_valor;
  v_total_descontos := v_inss_saldo + v_inss_13
    + COALESCE((v_irrf_saldo ->> 'valor')::numeric, 0)
    + COALESCE((v_irrf_13 ->> 'valor')::numeric, 0) + v_aviso_desconto;
  v_total_liquido := GREATEST(v_total_bruto - v_total_descontos, 0);

  v_saldo_fgts := GREATEST(public.tributario_numero_json(p, 'saldoFGTS'), 0);
  v_fgts_rescisorio := (v_saldo_salario + v_decimo_terceiro + v_aviso_valor) * 0.08;
  v_base_multa_fgts := v_saldo_fgts + v_fgts_rescisorio;
  IF v_tipo = 'sem_justa_causa' THEN v_multa_fgts := v_base_multa_fgts * 0.40; END IF;

  v_memoria := jsonb_build_array(
    jsonb_build_object('descricao', 'Saldo de salário (' || v_dias_saldo || '/30)', 'base', round(v_base, 2), 'aliquota', v_dias_saldo / 30.0 * 100, 'valor', round(v_saldo_salario, 2)),
    jsonb_build_object('descricao', '13º proporcional (' || v_avos_13 || '/12)', 'base', round(v_base, 2), 'aliquota', v_avos_13 / 12.0 * 100, 'valor', round(v_decimo_terceiro, 2)),
    jsonb_build_object('descricao', 'Férias proporcionais (' || v_avos_ferias || '/12)', 'base', round(v_base, 2), 'aliquota', v_avos_ferias / 12.0 * 100, 'valor', round(v_ferias_proporcionais, 2)),
    jsonb_build_object('descricao', 'FGTS rescisório estimado', 'base', round(v_saldo_salario + v_decimo_terceiro + v_aviso_valor, 2), 'aliquota', 8, 'valor', round(v_fgts_rescisorio, 2))
  );
  v_alertas := jsonb_build_array(
    'A multa do FGTS é depositada na conta vinculada e não compõe o líquido das verbas do TRCT.',
    'Médias de adicionais, comissões, horas extras, CCT/ACT, estabilidade e afastamentos exigem conferência individual.',
    'O saldo do FGTS informado deve ser conferido no extrato analítico; o cálculo soma uma estimativa dos depósitos rescisórios.'
  );
  v_versoes := jsonb_build_array(
    jsonb_build_object('codigo', v_inss_param ->> 'codigo', 'versao', v_inss_param ->> 'versao'),
    jsonb_build_object('codigo', v_irrf_param ->> 'codigo', 'versao', v_irrf_param ->> 'versao')
  );

  RETURN public.finalizar_simulacao_tributaria('rescisao', v_competencia, p, v_versoes,
    jsonb_build_object(
      'tipo', v_tipo, 'salarioBaseCalculo', round(v_base, 2), 'adicionalTempoServico', round(v_adicional, 2),
      'saldoSalario', round(v_saldo_salario, 2), 'avosDecimoTerceiro', v_avos_13,
      'decimoTerceiroProporcional', round(v_decimo_terceiro, 2), 'avosFerias', v_avos_ferias,
      'feriasProporcionais', round(v_ferias_proporcionais, 2), 'adicionalFerias', round(v_terco_proporcional, 2),
      'feriasVencidas', round(v_ferias_vencidas, 2), 'adicionalFeriasVencidas', round(v_terco_vencidas, 2),
      'avisoPrevioDias', v_aviso_dias, 'avisoPrevio', round(v_aviso_valor, 2),
      'avisoPrevioDesconto', round(v_aviso_desconto, 2), 'dataProjetadaAviso', v_data_projetada,
      'inssSaldoSalario', round(v_inss_saldo, 2), 'inssDecimoTerceiro', round(v_inss_13, 2),
      'inssRescisao', round(v_inss_saldo + v_inss_13, 2),
      'irrfSaldoSalario', round(COALESCE((v_irrf_saldo ->> 'valor')::numeric, 0), 2),
      'irrfDecimoTerceiro', round(COALESCE((v_irrf_13 ->> 'valor')::numeric, 0), 2),
      'irrfRescisao', round(COALESCE((v_irrf_saldo ->> 'valor')::numeric, 0) + COALESCE((v_irrf_13 ->> 'valor')::numeric, 0), 2),
      'fgtsRescisorio', round(v_fgts_rescisorio, 2), 'baseMultaFGTS', round(v_base_multa_fgts, 2),
      'multaFGTS', round(v_multa_fgts, 2), 'totalBruto', round(v_total_bruto, 2),
      'totalDescontos', round(v_total_descontos, 2), 'totalLiquido', round(v_total_liquido, 2),
      'totalComFgts', round(v_total_liquido + v_multa_fgts, 2)
    ), v_memoria, v_alertas);
EXCEPTION
  WHEN invalid_datetime_format OR datetime_field_overflow OR invalid_text_representation THEN
    RAISE EXCEPTION 'Há data, número ou opção inválida nos parâmetros da rescisão.';
END;
$$;

REVOKE ALL ON FUNCTION public.simular_rescisao(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simular_rescisao(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.simular_tempo_empresa(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_admissao date;
  v_referencia date;
  v_competencia date;
  v_salario numeric;
  v_idade interval;
  v_anos integer;
  v_meses integer;
  v_dias integer;
  v_inicio_aquisitivo date;
  v_idade_aquisitiva interval;
  v_avos_ferias integer;
  v_avos_13 integer;
  v_meses_estimados integer;
  v_provisao_13 numeric;
  v_provisao_ferias numeric;
  v_provisao_terco numeric;
  v_fgts numeric;
  v_multa numeric;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa vinculada.'; END IF;
  IF jsonb_typeof(COALESCE(p, '{}'::jsonb)) <> 'object'
     OR octet_length(COALESCE(p, '{}'::jsonb)::text) > 65536 THEN RAISE EXCEPTION 'Entrada inválida ou muito grande.'; END IF;
  v_admissao := NULLIF(p ->> 'dataAdmissao', '')::date;
  v_referencia := NULLIF(p ->> 'dataReferencia', '')::date;
  IF v_admissao IS NULL OR v_referencia IS NULL OR v_referencia < v_admissao THEN RAISE EXCEPTION 'Datas do vínculo inválidas.'; END IF;
  v_competencia := date_trunc('month', v_referencia)::date;
  v_salario := GREATEST(public.tributario_numero_json(p, 'salarioBase'), 0);
  v_idade := age(v_referencia, v_admissao);
  v_anos := extract(year FROM v_idade)::integer;
  v_meses := extract(month FROM v_idade)::integer;
  v_dias := extract(day FROM v_idade)::integer;
  v_inicio_aquisitivo := (v_admissao + make_interval(years => v_anos))::date;
  v_idade_aquisitiva := age(v_referencia, v_inicio_aquisitivo);
  v_avos_ferias := LEAST(extract(month FROM v_idade_aquisitiva)::integer + CASE WHEN extract(day FROM v_idade_aquisitiva) >= 15 THEN 1 ELSE 0 END, 12);
  SELECT count(*)::integer INTO v_avos_13
  FROM generate_series(
    date_trunc('month', GREATEST(v_admissao, date_trunc('year', v_referencia)::date)),
    date_trunc('month', v_referencia),
    interval '1 month'
  ) AS mes
  WHERE LEAST(v_referencia, (mes + interval '1 month - 1 day')::date)
    - GREATEST(v_admissao, mes::date) + 1 >= 15;
  v_meses_estimados := v_anos * 12 + v_meses + 1;
  v_provisao_13 := v_salario / 12 * v_avos_13;
  v_provisao_ferias := v_salario / 12 * v_avos_ferias;
  v_provisao_terco := v_provisao_ferias / 3;
  -- Estimativa histórica: salário atual constante e FGTS sobre remuneração + 13º.
  v_fgts := v_salario * v_meses_estimados * (13.0 / 12.0) * 0.08;
  v_multa := v_fgts * 0.40;
  RETURN public.finalizar_simulacao_tributaria('tempo_empresa', v_competencia, p, '[]'::jsonb,
    jsonb_build_object(
      'anos', v_anos, 'meses', v_meses, 'dias', v_dias,
      'avosDecimoTerceiro', v_avos_13, 'avosFerias', v_avos_ferias,
      'provisao13', round(v_provisao_13, 2), 'provisaoFerias', round(v_provisao_ferias, 2),
      'provisaoTerco', round(v_provisao_terco, 2), 'fgtsAcumulado', round(v_fgts, 2),
      'multaFgtsProjetada', round(v_multa, 2),
      'custoTotalAcumulado', round(v_provisao_13 + v_provisao_ferias + v_provisao_terco + v_fgts + v_multa, 2)
    ),
    jsonb_build_array(
      jsonb_build_object('descricao', '13º proporcional do ano corrente (' || v_avos_13 || '/12)', 'base', v_salario, 'aliquota', v_avos_13 / 12.0 * 100, 'valor', round(v_provisao_13, 2)),
      jsonb_build_object('descricao', 'Férias do período aquisitivo corrente (' || v_avos_ferias || '/12)', 'base', v_salario, 'aliquota', v_avos_ferias / 12.0 * 100, 'valor', round(v_provisao_ferias, 2))
    ),
    jsonb_build_array(
      'O FGTS histórico é uma estimativa com salário atual constante; use o extrato analítico da CAIXA para rescisão.',
      'O total reúne provisões correntes e estimativas de FGTS, não representa sozinho o passivo trabalhista completo.'
    ));
EXCEPTION
  WHEN invalid_datetime_format OR datetime_field_overflow OR invalid_text_representation THEN
    RAISE EXCEPTION 'Há data ou número inválido nos parâmetros do tempo de empresa.';
END;
$$;

REVOKE ALL ON FUNCTION public.simular_tempo_empresa(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simular_tempo_empresa(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.simular_multas(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_valor numeric;
  v_vencimento date;
  v_pagamento date;
  v_competencia date;
  v_dias integer;
  v_multa_percentual numeric;
  v_juros_percentual numeric := 0;
  v_inicio_selic date;
  v_fim_selic date;
  v_esperadas integer := 0;
  v_encontradas integer := 0;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa vinculada.'; END IF;
  IF jsonb_typeof(COALESCE(p, '{}'::jsonb)) <> 'object'
     OR octet_length(COALESCE(p, '{}'::jsonb)::text) > 65536 THEN RAISE EXCEPTION 'Entrada inválida ou muito grande.'; END IF;
  v_valor := GREATEST(public.tributario_numero_json(p, 'valorOriginal'), 0);
  v_vencimento := NULLIF(p ->> 'dataVencimento', '')::date;
  v_pagamento := NULLIF(p ->> 'dataPagamento', '')::date;
  IF v_vencimento IS NULL OR v_pagamento IS NULL THEN RAISE EXCEPTION 'Datas de vencimento e pagamento são obrigatórias.'; END IF;
  v_competencia := date_trunc('month', v_pagamento)::date;
  v_dias := GREATEST(v_pagamento - v_vencimento, 0);
  v_multa_percentual := LEAST(v_dias * 0.33, 20);
  IF date_trunc('month', v_pagamento) > date_trunc('month', v_vencimento) THEN
    v_inicio_selic := (date_trunc('month', v_vencimento) + interval '1 month')::date;
    v_fim_selic := (date_trunc('month', v_pagamento) - interval '1 month')::date;
    IF v_inicio_selic <= v_fim_selic THEN
      v_esperadas := ((extract(year FROM v_fim_selic) - extract(year FROM v_inicio_selic)) * 12
        + extract(month FROM v_fim_selic) - extract(month FROM v_inicio_selic) + 1)::integer;
      SELECT count(*)::integer, COALESCE(sum(taxa_percentual), 0)
        INTO v_encontradas, v_juros_percentual
      FROM public.taxas_selic_mensais
      WHERE competencia BETWEEN v_inicio_selic AND v_fim_selic;
      IF v_encontradas <> v_esperadas THEN RAISE EXCEPTION 'Taxas Selic oficiais ausentes para parte do período informado.'; END IF;
    END IF;
    v_juros_percentual := v_juros_percentual + 1;
  END IF;
  RETURN public.finalizar_simulacao_tributaria('multas_darf', v_competencia, p,
    jsonb_build_array(jsonb_build_object('codigo', 'BCB_SGS_4390', 'versao', 'atualizado_2026-06')),
    jsonb_build_object(
      'valorOriginal', round(v_valor, 2), 'diasAtraso', v_dias,
      'jurosPercentual', round(v_juros_percentual, 2), 'jurosValor', round(v_valor * v_juros_percentual / 100, 2),
      'multaPercentual', round(v_multa_percentual, 2), 'multaValor', round(v_valor * v_multa_percentual / 100, 2),
      'totalPagar', round(v_valor * (1 + v_juros_percentual / 100 + v_multa_percentual / 100), 2)
    ),
    jsonb_build_array(
      jsonb_build_object('descricao', 'Multa de mora', 'base', v_valor, 'aliquota', round(v_multa_percentual, 2), 'valor', round(v_valor * v_multa_percentual / 100, 2)),
      jsonb_build_object('descricao', 'Selic acumulada + 1% no mês do pagamento', 'base', v_valor, 'aliquota', round(v_juros_percentual, 2), 'valor', round(v_valor * v_juros_percentual / 100, 2))
    ),
    jsonb_build_array('Confira o valor final no Sicalc antes de emitir ou pagar o DARF.'));
EXCEPTION
  WHEN invalid_datetime_format OR datetime_field_overflow OR invalid_text_representation THEN
    RAISE EXCEPTION 'Há data ou número inválido nos parâmetros de multas e juros.';
END;
$$;

REVOKE ALL ON FUNCTION public.simular_multas(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simular_multas(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.simular_comparativo_regime(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_envelope jsonb;
  v_resultado jsonb;
BEGIN
  v_envelope := public.envelope_simulacao_existente('comparativo-regime', p);
  v_resultado := COALESCE(v_envelope -> 'resultado', '{}'::jsonb);
  v_resultado := v_resultado || jsonb_build_object(
    'melhorOpcao', 'Indeterminado',
    'melhorOpcaoDesc', 'Triagem preliminar: não é possível recomendar regime sem CNAE, receitas segregadas, município/ISS, benefícios, créditos e ajustes fiscais.',
    'alertas', jsonb_build_array(
      'Os valores são cenários genéricos e não constituem apuração nem recomendação de regime.',
      'Lucro Presumido e Lucro Real dependem da atividade, adicional de IRPJ, ajustes fiscais e regras vigentes em 2026.',
      'Simples Nacional depende do anexo, RBT12, fator R, sublimites e segregação das receitas.'
    )
  );
  RETURN jsonb_set(v_envelope, '{resultado}', v_resultado, true);
END;
$$;

REVOKE ALL ON FUNCTION public.simular_comparativo_regime(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simular_comparativo_regime(jsonb) TO authenticated;

-- Reforça que a implementação interna do MEI não pode contornar a validação CNAE/tenant.
REVOKE ALL ON FUNCTION public.simular_mei_calculo_versionado(jsonb) FROM PUBLIC, anon, authenticated;
