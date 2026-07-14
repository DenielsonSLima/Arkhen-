-- Simulações de Pessoa Física e MEI. Toda regra financeira permanece no banco;
-- o frontend informa dados, escolhe a competência e apresenta o envelope retornado.

CREATE OR REPLACE FUNCTION public.ultimo_dia_util_estimado(p_mes date)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE v_data date := (date_trunc('month', p_mes) + interval '2 months - 1 day')::date;
BEGIN
  WHILE extract(isodow FROM v_data) IN (6, 7) LOOP v_data := v_data - 1; END LOOP;
  RETURN v_data;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalizar_simulacao_tributaria(
  p_tipo text,
  p_competencia date,
  p_entrada jsonb,
  p_versoes jsonb,
  p_resultado jsonb,
  p_memoria jsonb,
  p_alertas jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_envelope jsonb;
  v_historico_id uuid;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa vinculada.'; END IF;
  v_envelope := jsonb_build_object(
    'tipo', p_tipo,
    'competencia', p_competencia,
    'versoesParametros', COALESCE(p_versoes, '[]'::jsonb),
    'resultado', COALESCE(p_resultado, '{}'::jsonb),
    'memoriaCalculo', COALESCE(p_memoria, '[]'::jsonb),
    'alertas', COALESCE(p_alertas, '[]'::jsonb),
    'estimativa', true
  );
  IF COALESCE((p_entrada ->> 'salvarHistorico')::boolean, false) THEN
    INSERT INTO public.simulacoes_historico
      (empresa_id, usuario_id, tipo, competencia, entrada, resultado, versoes_parametros)
    VALUES
      (v_empresa_id, auth.uid(), p_tipo, p_competencia, p_entrada - 'salvarHistorico', v_envelope, COALESCE(p_versoes, '[]'::jsonb))
    RETURNING id INTO v_historico_id;
    v_envelope := v_envelope || jsonb_build_object('historicoId', v_historico_id);
  END IF;
  RETURN v_envelope;
EXCEPTION WHEN invalid_text_representation THEN
  RAISE EXCEPTION 'O campo salvarHistorico deve ser booleano.';
END;
$$;

CREATE OR REPLACE FUNCTION public.simular_carne_leao(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_competencia date;
  v_param jsonb;
  v_irrf_param jsonb;
  v_config jsonb;
  v_pf numeric; v_exterior numeric; v_alugueis numeric; v_outros numeric;
  v_previdencia numeric; v_dependentes integer; v_pensao numeric; v_livro numeric;
  v_excesso_anterior numeric; v_imposto_exterior numeric; v_rend_prof numeric; v_rendimentos numeric;
  v_deducao_dependentes numeric; v_livro_utilizado numeric; v_excesso_transportar numeric;
  v_deducoes_legais numeric; v_desconto_simplificado numeric; v_base_legal numeric; v_base_simplificada numeric;
  v_usar_simplificado boolean; v_base numeric; v_irrf jsonb; v_imposto numeric; v_imposto_devido numeric;
  v_memoria jsonb; v_alertas jsonb := '[]'::jsonb; v_versoes jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa vinculada.'; END IF;
  IF jsonb_typeof(COALESCE(p, '{}'::jsonb)) <> 'object' OR octet_length(COALESCE(p, '{}'::jsonb)::text) > 65536 THEN RAISE EXCEPTION 'Entrada inválida ou muito grande.'; END IF;
  v_competencia := public.tributario_competencia_json(p, CURRENT_DATE);
  v_param := public.obter_parametro_tributario('carne_leao', v_competencia, v_empresa_id);
  v_irrf_param := public.obter_parametro_tributario('irrf_mensal', v_competencia, v_empresa_id);
  IF v_param = '{}'::jsonb OR v_irrf_param = '{}'::jsonb THEN RAISE EXCEPTION 'Parâmetros do Carnê-Leão não configurados para %.', v_competencia; END IF;
  v_config := v_irrf_param -> 'configuracao';

  v_pf := GREATEST(public.tributario_numero_json(p, 'rendimentosPF'), 0);
  v_exterior := GREATEST(public.tributario_numero_json(p, 'rendimentosExterior'), 0);
  v_alugueis := GREATEST(public.tributario_numero_json(p, 'alugueis'), 0);
  v_outros := GREATEST(public.tributario_numero_json(p, 'outrosRendimentos'), 0);
  v_previdencia := GREATEST(public.tributario_numero_json(p, 'previdenciaOficial'), 0);
  v_dependentes := LEAST(GREATEST(public.tributario_numero_json(p, 'dependentes')::integer, 0), 99);
  v_pensao := GREATEST(public.tributario_numero_json(p, 'pensaoAlimenticia'), 0);
  v_livro := GREATEST(public.tributario_numero_json(p, 'livroCaixa'), 0);
  v_excesso_anterior := GREATEST(public.tributario_numero_json(p, 'excessoLivroCaixaAnterior'), 0);
  v_imposto_exterior := GREATEST(public.tributario_numero_json(p, 'impostoExterior'), 0);
  v_rend_prof := v_pf + v_exterior + v_outros;
  v_rendimentos := v_rend_prof + v_alugueis;
  v_deducao_dependentes := v_dependentes * COALESCE((v_config ->> 'deducaoDependente')::numeric, 0);
  v_livro_utilizado := LEAST(v_livro + v_excesso_anterior, v_rend_prof);
  v_excesso_transportar := GREATEST(v_livro + v_excesso_anterior - v_rend_prof, 0);
  v_deducoes_legais := v_previdencia + v_deducao_dependentes + v_pensao + v_livro_utilizado;
  v_desconto_simplificado := LEAST(v_rendimentos, COALESCE((v_config ->> 'descontoSimplificado')::numeric, 0));
  v_base_legal := GREATEST(v_rendimentos - v_deducoes_legais, 0);
  v_base_simplificada := GREATEST(v_rendimentos - v_desconto_simplificado, 0);
  v_usar_simplificado := COALESCE((p ->> 'usarDescontoSimplificado')::boolean, v_base_simplificada < v_base_legal);
  v_base := CASE WHEN v_usar_simplificado THEN v_base_simplificada ELSE v_base_legal END;
  v_irrf := public.calculo_irrf_detalhado(v_base, v_rendimentos, v_competencia, false);
  v_imposto := COALESCE((v_irrf ->> 'valor')::numeric, 0);
  -- Crédito no exterior depende de tratado/reciprocidade e do limite calculado
  -- pela diferença entre o IR com e sem o rendimento externo. Sem esses dados,
  -- o valor é apenas destacado e não reduz automaticamente o imposto brasileiro.
  v_imposto_devido := v_imposto;
  v_memoria := jsonb_build_array(
    jsonb_build_object('descricao', 'Rendimentos sujeitos ao Carnê-Leão', 'base', v_rendimentos, 'aliquota', NULL, 'valor', v_rendimentos),
    jsonb_build_object('descricao', CASE WHEN v_usar_simplificado THEN 'Desconto simplificado mensal' ELSE 'Deduções legais e Livro Caixa' END, 'base', v_rendimentos, 'aliquota', NULL, 'valor', -CASE WHEN v_usar_simplificado THEN v_desconto_simplificado ELSE v_deducoes_legais END)
  ) || COALESCE(v_irrf -> 'memoriaCalculo', '[]'::jsonb);
  IF v_alugueis > 0 AND v_livro > 0 THEN v_alertas := v_alertas || jsonb_build_array('Livro Caixa não foi deduzido dos rendimentos de aluguel.'); END IF;
  IF extract(month FROM v_competencia) = 12 AND v_excesso_transportar > 0 THEN v_alertas := v_alertas || jsonb_build_array('O excesso de Livro Caixa não é transportado para o ano seguinte.'); END IF;
  IF v_imposto_exterior > 0 THEN v_alertas := v_alertas || jsonb_build_array('Imposto pago no exterior foi apenas destacado. A compensação exige tratado ou reciprocidade e cálculo do limite legal.'); END IF;
  v_alertas := v_alertas || jsonb_build_array('Vencimento estimado sem considerar feriados locais ou nacionais.', 'Simulação sem transmissão ao e-CAC e sem emissão oficial de DARF.');
  v_versoes := jsonb_build_array(
    jsonb_build_object('codigo', v_param ->> 'codigo', 'versao', v_param ->> 'versao'),
    jsonb_build_object('codigo', v_irrf_param ->> 'codigo', 'versao', v_irrf_param ->> 'versao')
  );
  RETURN public.finalizar_simulacao_tributaria('carne_leao', v_competencia, p, v_versoes,
    jsonb_build_object(
      'rendimentosTributaveis', round(v_rendimentos, 2), 'deducoesLegais', round(v_deducoes_legais, 2),
      'descontoSimplificado', round(v_desconto_simplificado, 2), 'metodo', CASE WHEN v_usar_simplificado THEN 'simplificado' ELSE 'deducoes_legais' END,
      'baseCalculo', round(v_base, 2), 'impostoTabela', v_irrf -> 'impostoTabela', 'reducao2026', v_irrf -> 'reducao',
      'impostoExteriorInformado', round(v_imposto_exterior, 2), 'impostoExteriorCompensado', 0, 'impostoDevido', round(v_imposto_devido, 2),
      'livroCaixaUtilizado', round(v_livro_utilizado, 2), 'excessoLivroCaixaTransportar', round(v_excesso_transportar, 2),
      'codigoDarf', v_param #>> '{configuracao,codigoDarf}', 'vencimentoEstimado', public.ultimo_dia_util_estimado(v_competencia),
      'deducoesAdmitidas', round(CASE WHEN v_usar_simplificado THEN v_desconto_simplificado ELSE v_deducoes_legais END, 2),
      'reducaoAplicada', v_irrf -> 'reducao', 'codigoReceita', v_param #>> '{configuracao,codigoDarf}',
      'vencimento', public.ultimo_dia_util_estimado(v_competencia), 'excessoLivroCaixa', round(v_excesso_transportar, 2)
    ), v_memoria, v_alertas);
EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Há um valor inválido nos parâmetros do Carnê-Leão.';
END;
$$;

CREATE OR REPLACE FUNCTION public.simular_irpf_anual(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_ano integer; v_competencia date; v_param jsonb; v_config jsonb;
  v_rendimentos numeric; v_isentos numeric; v_exclusivos numeric; v_deducoes numeric;
  v_previdencia numeric; v_dependentes integer; v_saude numeric; v_educacao numeric; v_educacao_admitida numeric;
  v_pensao numeric; v_pgbl numeric; v_pgbl_admitido numeric; v_livro numeric; v_outras_deducoes numeric;
  v_irrf_pago numeric; v_carne_pago numeric; v_complementar_pago numeric; v_exterior_pago numeric; v_ganho_pago numeric; v_pago numeric;
  v_simplificado numeric; v_base_legal numeric; v_base_simplificada numeric;
  v_calc_legal jsonb; v_calc_simplificado jsonb; v_imposto_legal numeric; v_imposto_simplificado numeric;
  v_metodo text; v_imposto numeric; v_saldo numeric; v_memoria jsonb; v_alertas jsonb; v_versoes jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa vinculada.'; END IF;
  IF jsonb_typeof(COALESCE(p, '{}'::jsonb)) <> 'object' OR octet_length(COALESCE(p, '{}'::jsonb)::text) > 65536 THEN RAISE EXCEPTION 'Entrada inválida ou muito grande.'; END IF;
  v_ano := LEAST(GREATEST(public.tributario_numero_json(p, 'anoCalendario', extract(year FROM CURRENT_DATE))::integer, 2000), 2200);
  v_competencia := make_date(v_ano, 12, 1);
  v_param := public.obter_parametro_tributario('irpf_anual', v_competencia, v_empresa_id);
  IF v_param = '{}'::jsonb THEN RAISE EXCEPTION 'Tabela anual do IRPF não configurada para %.', v_ano; END IF;
  v_config := v_param -> 'configuracao';
  v_rendimentos := GREATEST(public.tributario_numero_json(p, 'rendimentosTributaveis'), 0);
  v_isentos := GREATEST(public.tributario_numero_json(p, 'rendimentosIsentos'), 0);
  v_exclusivos := GREATEST(public.tributario_numero_json(p, 'rendimentosExclusivos'), 0);
  v_previdencia := GREATEST(public.tributario_numero_json(p, 'previdenciaOficial'), 0);
  v_dependentes := LEAST(GREATEST(public.tributario_numero_json(p, 'quantidadeDependentes')::integer, 0), 99);
  v_saude := GREATEST(public.tributario_numero_json(p, 'despesasSaude'), 0);
  v_educacao := GREATEST(public.tributario_numero_json(p, 'despesasEducacao'), 0);
  v_educacao_admitida := LEAST(v_educacao, COALESCE((v_config ->> 'limiteEducacaoPorPessoa')::numeric, 0) * GREATEST(public.tributario_numero_json(p, 'quantidadePessoasEducacao', v_dependentes + 1)::integer, 0));
  v_pensao := GREATEST(public.tributario_numero_json(p, 'pensaoAlimenticia'), 0);
  v_pgbl := GREATEST(public.tributario_numero_json(p, 'pgbl'), 0);
  v_pgbl_admitido := CASE
    WHEN v_previdencia > 0 OR COALESCE((p ->> 'contribuiPrevidenciaOficial')::boolean, false)
      THEN LEAST(v_pgbl, v_rendimentos * 0.12)
    ELSE 0
  END;
  v_livro := LEAST(GREATEST(public.tributario_numero_json(p, 'livroCaixa'), 0), v_rendimentos);
  v_outras_deducoes := GREATEST(public.tributario_numero_json(p, 'deducoesLegais'), 0);
  v_deducoes := v_previdencia
    + v_dependentes * COALESCE((v_config ->> 'deducaoDependente')::numeric, 0)
    + v_saude + v_educacao_admitida + v_pensao + v_pgbl_admitido + v_livro + v_outras_deducoes;
  v_irrf_pago := GREATEST(public.tributario_numero_json(p, 'irrfPago'), 0);
  v_carne_pago := GREATEST(public.tributario_numero_json(p, 'carneLeaoPago'), 0);
  v_complementar_pago := GREATEST(public.tributario_numero_json(p, 'impostoComplementarPago'), 0);
  v_exterior_pago := GREATEST(public.tributario_numero_json(p, 'impostoExterior'), 0);
  v_ganho_pago := GREATEST(public.tributario_numero_json(p, 'ganhoCapitalPago'), 0);
  -- Ganho de capital é tributação definitiva/exclusiva e não reduz o imposto
  -- progressivo anual; permanece destacado no resultado para conferência.
  v_pago := v_irrf_pago + v_carne_pago + v_complementar_pago;
  v_simplificado := LEAST(v_rendimentos * COALESCE((v_config ->> 'descontoSimplificadoPercentual')::numeric, 20) / 100, COALESCE((v_config ->> 'descontoSimplificadoLimite')::numeric, 0));
  v_base_legal := GREATEST(v_rendimentos - v_deducoes, 0);
  v_base_simplificada := GREATEST(v_rendimentos - v_simplificado, 0);
  v_calc_legal := public.calculo_irrf_detalhado(v_base_legal, v_rendimentos, v_competencia, true);
  v_calc_simplificado := public.calculo_irrf_detalhado(v_base_simplificada, v_rendimentos, v_competencia, true);
  v_imposto_legal := COALESCE((v_calc_legal ->> 'valor')::numeric, 0);
  v_imposto_simplificado := COALESCE((v_calc_simplificado ->> 'valor')::numeric, 0);
  IF v_imposto_simplificado < v_imposto_legal THEN v_metodo := 'simplificado'; v_imposto := v_imposto_simplificado; ELSE v_metodo := 'deducoes_legais'; v_imposto := v_imposto_legal; END IF;
  v_saldo := v_imposto - v_pago;
  v_memoria := jsonb_build_array(
    jsonb_build_object('descricao', 'Rendimentos tributáveis anuais', 'base', v_rendimentos, 'aliquota', NULL, 'valor', v_rendimentos),
    jsonb_build_object('descricao', 'Deduções legais calculadas', 'base', v_rendimentos, 'aliquota', NULL, 'valor', -v_deducoes),
    jsonb_build_object('descricao', 'Desconto simplificado calculado', 'base', v_rendimentos, 'aliquota', v_config -> 'descontoSimplificadoPercentual', 'valor', -v_simplificado)
  );
  v_alertas := jsonb_build_array('Projeção não substitui a declaração oficial e não avalia todas as fichas, limites e situações especiais.', 'Rendimentos isentos e exclusivos são exibidos, mas não compõem a tabela progressiva nesta projeção.', 'Imposto sobre ganho de capital foi destacado e não compensado no ajuste anual progressivo.');
  IF v_exterior_pago > 0 THEN v_alertas := v_alertas || jsonb_build_array('Imposto pago no exterior foi destacado, mas não compensado: a apuração exige tratado ou reciprocidade e limite legal individualizado.'); END IF;
  IF v_pgbl > 0 AND v_pgbl_admitido = 0 THEN v_alertas := v_alertas || jsonb_build_array('PGBL não admitido porque não foi confirmada contribuição à previdência oficial ou regime próprio.'); END IF;
  v_versoes := jsonb_build_array(jsonb_build_object('codigo', v_param ->> 'codigo', 'versao', v_param ->> 'versao'));
  RETURN public.finalizar_simulacao_tributaria('irpf_anual', v_competencia, p, v_versoes,
    jsonb_build_object(
      'anoCalendario', v_ano, 'rendimentosTributaveis', round(v_rendimentos, 2), 'rendimentosIsentos', round(v_isentos, 2),
      'rendimentosExclusivos', round(v_exclusivos, 2), 'deducoesLegaisCalculadas', round(v_deducoes, 2),
      'educacaoInformada', round(v_educacao, 2), 'educacaoAdmitida', round(v_educacao_admitida, 2),
      'pgblInformado', round(v_pgbl, 2), 'pgblAdmitido', round(v_pgbl_admitido, 2),
      'baseDeducoesLegais', round(v_base_legal, 2), 'baseSimplificada', round(v_base_simplificada, 2),
      'impostoDeducoesLegais', round(v_imposto_legal, 2), 'impostoSimplificado', round(v_imposto_simplificado, 2), 'melhorOpcao', v_metodo,
      'impostoEstimado', round(v_imposto, 2), 'impostoJaPago', round(v_pago, 2), 'impostoExteriorInformado', round(v_exterior_pago, 2), 'impostoGanhoCapitalPago', round(v_ganho_pago, 2),
      'saldoPagar', round(GREATEST(v_saldo, 0), 2), 'restituicaoEstimada', round(GREATEST(-v_saldo, 0), 2),
      'exercicio', v_ano + 1, 'modeloRecomendado', CASE WHEN v_metodo = 'simplificado' THEN 'Desconto simplificado' ELSE 'Deduções legais' END,
      'modeloLegal', jsonb_build_object(
        'nome', 'Deduções legais', 'totalDeducoes', round(v_deducoes, 2), 'baseCalculo', round(v_base_legal, 2),
        'impostoApurado', v_calc_legal -> 'impostoTabela', 'reducaoAplicada', v_calc_legal -> 'reducao',
        'impostoDevido', round(v_imposto_legal, 2), 'impostoPago', round(v_pago, 2),
        'saldoPagar', round(GREATEST(v_imposto_legal - v_pago, 0), 2), 'restituicaoEstimada', round(GREATEST(v_pago - v_imposto_legal, 0), 2)
      ),
      'modeloSimplificado', jsonb_build_object(
        'nome', 'Desconto simplificado', 'totalDeducoes', round(v_simplificado, 2), 'baseCalculo', round(v_base_simplificada, 2),
        'impostoApurado', v_calc_simplificado -> 'impostoTabela', 'reducaoAplicada', v_calc_simplificado -> 'reducao',
        'impostoDevido', round(v_imposto_simplificado, 2), 'impostoPago', round(v_pago, 2),
        'saldoPagar', round(GREATEST(v_imposto_simplificado - v_pago, 0), 2), 'restituicaoEstimada', round(GREATEST(v_pago - v_imposto_simplificado, 0), 2)
      ),
      'pendenciasDocumentais', jsonb_build_array('Comprovantes de rendimentos e retenções', 'Comprovantes das deduções legais informadas', 'Recibos de Carnê-Leão e demais impostos antecipados')
    ), v_memoria, v_alertas);
END;
$$;

CREATE OR REPLACE FUNCTION public.simular_prolabore_dividendos(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id(); v_competencia date; v_div_param jsonb; v_inss_param jsonb; v_irrf_param jsonb;
  v_prolabore numeric; v_prolabore_alt numeric; v_lucro numeric; v_dividendos_solicitados numeric; v_dividendos_ano numeric; v_participacao numeric;
  v_outros_ano numeric; v_prolabore_ano numeric; v_regime text; v_cpp_aliquota numeric; v_cpp_informada boolean; v_inss numeric; v_irrf jsonb; v_cpp numeric;
  v_inss_alt numeric; v_irrf_alt jsonb; v_cpp_alt numeric; v_desconto_simplificado numeric; v_liquido_atual numeric; v_liquido_alt numeric;
  v_disponivel_socio numeric; v_dividendos numeric; v_limite_mensal numeric; v_retencao_aliquota numeric; v_retencao numeric;
  v_total_ano numeric; v_alta_inicio numeric; v_alta_max_em numeric; v_alta_max numeric; v_alta_aliquota numeric;
  v_alertas jsonb := '[]'::jsonb; v_memoria jsonb; v_versoes jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa vinculada.'; END IF;
  IF jsonb_typeof(COALESCE(p, '{}'::jsonb)) <> 'object' OR octet_length(COALESCE(p, '{}'::jsonb)::text) > 65536 THEN RAISE EXCEPTION 'Entrada inválida ou muito grande.'; END IF;
  v_competencia := public.tributario_competencia_json(p, CURRENT_DATE);
  v_div_param := public.obter_parametro_tributario('dividendos', v_competencia, v_empresa_id);
  v_inss_param := public.obter_parametro_tributario('inss', v_competencia, v_empresa_id);
  v_irrf_param := public.obter_parametro_tributario('irrf_mensal', v_competencia, v_empresa_id);
  IF v_div_param = '{}'::jsonb OR v_inss_param = '{}'::jsonb OR v_irrf_param = '{}'::jsonb THEN RAISE EXCEPTION 'Parâmetros de pró-labore/dividendos não configurados para %.', v_competencia; END IF;
  v_prolabore := GREATEST(public.tributario_numero_json(p, 'prolabore'), 0);
  v_prolabore_alt := GREATEST(public.tributario_numero_json(p, 'proLaboreAlternativo', v_prolabore), 0);
  v_lucro := GREATEST(public.tributario_numero_json(p, 'lucroContabilDisponivel'), 0);
  v_dividendos_solicitados := GREATEST(public.tributario_numero_json(p, 'dividendosMes'), 0);
  v_dividendos_ano := GREATEST(public.tributario_numero_json(p, 'dividendosAnoAntes'), 0);
  v_participacao := LEAST(GREATEST(public.tributario_numero_json(p, 'participacaoPercentual', 100), 0), 100);
  v_outros_ano := GREATEST(public.tributario_numero_json(p, 'outrosRendimentosAno'), 0);
  v_prolabore_ano := GREATEST(public.tributario_numero_json(p, 'prolaboreAno', v_prolabore), 0);
  v_regime := COALESCE(NULLIF(p ->> 'regimeTributario', ''), 'lucro_presumido');
  IF v_regime NOT IN ('simples_anexo_iii', 'simples_anexo_iv', 'simples_anexo_v', 'lucro_presumido', 'lucro_real') THEN RAISE EXCEPTION 'Regime tributário inválido.'; END IF;
  v_cpp_informada := p ? 'aliquotaCpp' AND NULLIF(p ->> 'aliquotaCpp', '') IS NOT NULL;
  IF v_regime IN ('simples_anexo_iii', 'simples_anexo_v') THEN
    -- Nos Anexos III e V a CPP está incluída no DAS e não deve ser somada de novo.
    v_cpp_aliquota := 0;
    IF v_cpp_informada AND public.tributario_numero_json(p, 'aliquotaCpp') <> 0 THEN
      v_alertas := v_alertas || jsonb_build_array('A alíquota de CPP informada foi ignorada porque, nos Anexos III e V, a CPP está incluída no DAS.');
    END IF;
  ELSIF v_regime = 'simples_anexo_iv' THEN
    -- No Anexo IV a CPP é recolhida fora do DAS. Exigimos a alíquota para que
    -- RAT/FAP ou particularidades da folha não sejam presumidos silenciosamente.
    IF NOT v_cpp_informada THEN
      RAISE EXCEPTION 'aliquotaCpp é obrigatória para o Simples Nacional Anexo IV.';
    END IF;
    v_cpp_aliquota := LEAST(GREATEST(public.tributario_numero_json(p, 'aliquotaCpp'), 0), 100);
    IF v_cpp_aliquota <= 0 THEN
      RAISE EXCEPTION 'aliquotaCpp deve ser maior que zero para o Simples Nacional Anexo IV.';
    END IF;
  ELSE
    v_cpp_aliquota := LEAST(GREATEST(public.tributario_numero_json(p, 'aliquotaCpp', 20), 0), 100);
  END IF;
  v_inss := LEAST(v_prolabore * 0.11, COALESCE((v_inss_param #>> '{configuracao,tetoBeneficios}')::numeric, 0) * 0.11);
  v_desconto_simplificado := COALESCE((v_irrf_param #>> '{configuracao,descontoSimplificado}')::numeric, 0);
  v_irrf := public.calculo_irrf_detalhado(GREATEST(v_prolabore - GREATEST(v_inss, v_desconto_simplificado), 0), v_prolabore, v_competencia, false);
  v_cpp := v_prolabore * v_cpp_aliquota / 100;
  v_inss_alt := LEAST(v_prolabore_alt * 0.11, COALESCE((v_inss_param #>> '{configuracao,tetoBeneficios}')::numeric, 0) * 0.11);
  v_irrf_alt := public.calculo_irrf_detalhado(GREATEST(v_prolabore_alt - GREATEST(v_inss_alt, v_desconto_simplificado), 0), v_prolabore_alt, v_competencia, false);
  v_cpp_alt := v_prolabore_alt * v_cpp_aliquota / 100;
  v_disponivel_socio := v_lucro * v_participacao / 100;
  v_dividendos := LEAST(v_dividendos_solicitados, v_disponivel_socio);
  v_limite_mensal := (v_div_param #>> '{configuracao,limiteMensalPorFonte}')::numeric;
  v_retencao_aliquota := (v_div_param #>> '{configuracao,aliquotaRetencao}')::numeric;
  v_retencao := CASE WHEN v_dividendos > v_limite_mensal THEN v_dividendos * v_retencao_aliquota / 100 ELSE 0 END;
  v_liquido_atual := v_prolabore - v_inss - COALESCE((v_irrf ->> 'valor')::numeric, 0) + v_dividendos - v_retencao;
  v_liquido_alt := v_prolabore_alt - v_inss_alt - COALESCE((v_irrf_alt ->> 'valor')::numeric, 0) + v_dividendos - v_retencao;
  v_total_ano := v_dividendos_ano + v_dividendos + v_outros_ano + v_prolabore_ano;
  v_alta_inicio := (v_div_param #>> '{configuracao,altaRendaInicioAnual}')::numeric;
  v_alta_max_em := (v_div_param #>> '{configuracao,altaRendaAliquotaMaximaEm}')::numeric;
  v_alta_max := (v_div_param #>> '{configuracao,altaRendaAliquotaMaxima}')::numeric;
  v_alta_aliquota := CASE WHEN v_total_ano <= v_alta_inicio THEN 0 WHEN v_total_ano >= v_alta_max_em THEN v_alta_max ELSE (v_total_ano - v_alta_inicio) / (v_alta_max_em - v_alta_inicio) * v_alta_max END;
  IF v_dividendos_solicitados > v_disponivel_socio THEN v_alertas := v_alertas || jsonb_build_array('Dividendos limitados ao lucro contábil disponível e à participação societária informada.'); END IF;
  IF v_total_ano > v_alta_inicio THEN v_alertas := v_alertas || jsonb_build_array('Há indicação de enquadramento nas regras de tributação mínima de alta renda; a apuração final exige todos os rendimentos, exclusões e impostos pagos.'); END IF;
  v_alertas := v_alertas || jsonb_build_array('Distribuição condicionada à existência de lucro contábil regularmente apurado.', 'A CPP depende do regime tributário e da atividade; confirme a alíquota informada quando ela for recolhida fora do DAS.');
  v_memoria := jsonb_build_array(
    jsonb_build_object('descricao', 'INSS do sócio sobre pró-labore', 'base', v_prolabore, 'aliquota', 11, 'valor', round(v_inss, 2)),
    jsonb_build_object('descricao', 'IRRF sobre pró-labore', 'base', v_irrf -> 'base', 'aliquota', v_irrf -> 'aliquota', 'valor', v_irrf -> 'valor'),
    jsonb_build_object('descricao', 'Retenção sobre dividendos no mês', 'base', v_dividendos, 'aliquota', CASE WHEN v_dividendos > v_limite_mensal THEN v_retencao_aliquota ELSE 0 END, 'valor', round(v_retencao, 2))
  );
  v_versoes := jsonb_build_array(
    jsonb_build_object('codigo', v_div_param ->> 'codigo', 'versao', v_div_param ->> 'versao'),
    jsonb_build_object('codigo', v_inss_param ->> 'codigo', 'versao', v_inss_param ->> 'versao'),
    jsonb_build_object('codigo', v_irrf_param ->> 'codigo', 'versao', v_irrf_param ->> 'versao')
  );
  RETURN public.finalizar_simulacao_tributaria('prolabore_dividendos', v_competencia, p, v_versoes,
    jsonb_build_object(
      'regimeTributario', v_regime, 'aliquotaCppAplicada', round(v_cpp_aliquota, 4),
      'cppIncluidaNoDas', v_regime IN ('simples_anexo_iii', 'simples_anexo_v'),
      'prolaboreBruto', round(v_prolabore, 2), 'inssSocio', round(v_inss, 2), 'irrfProlabore', v_irrf -> 'valor',
      'prolaboreLiquido', round(v_prolabore - v_inss - COALESCE((v_irrf ->> 'valor')::numeric, 0), 2),
      'cppEmpresa', round(v_cpp, 2), 'custoEmpresaProlabore', round(v_prolabore + v_cpp, 2),
      'lucroDisponivelSocio', round(v_disponivel_socio, 2), 'dividendosSimulados', round(v_dividendos, 2),
      'retencaoDividendos', round(v_retencao, 2), 'dividendosLiquidos', round(v_dividendos - v_retencao, 2),
      'rendaAnualProjetadaInformada', round(v_total_ano, 2), 'aliquotaMinimaAltaRendaIndicativa', round(v_alta_aliquota, 4),
      'cenarioAtual', jsonb_build_object('prolabore', round(v_prolabore, 2), 'inss', round(v_inss, 2), 'irrf', v_irrf -> 'valor', 'cppEmpresa', round(v_cpp, 2), 'liquidoSocioComDividendos', round(v_liquido_atual, 2), 'custoEmpresaProlabore', round(v_prolabore + v_cpp, 2)),
      'cenarioAlternativo', jsonb_build_object('prolabore', round(v_prolabore_alt, 2), 'inss', round(v_inss_alt, 2), 'irrf', v_irrf_alt -> 'valor', 'cppEmpresa', round(v_cpp_alt, 2), 'liquidoSocioComDividendos', round(v_liquido_alt, 2), 'custoEmpresaProlabore', round(v_prolabore_alt + v_cpp_alt, 2)),
      'diferencaLiquidoSocio', round(v_liquido_alt - v_liquido_atual, 2), 'diferencaCustoEmpresa', round((v_prolabore_alt + v_cpp_alt) - (v_prolabore + v_cpp), 2),
      'dividendosBrutos', round(v_dividendos, 2), 'liquidoTotalSocio', round(v_liquido_atual, 2),
      'custoTotalEmpresa', round(v_prolabore + v_cpp + v_dividendos, 2), 'rendimentoAnualAcumulado', round(v_total_ano, 2),
      'lucroDisponivelComprovado', COALESCE((p ->> 'lucroContabilComprovado')::boolean, false),
      'distribuicaoPermitida', COALESCE((p ->> 'lucroContabilComprovado')::boolean, false) AND v_dividendos_solicitados <= v_disponivel_socio,
      'alertaAltaRenda', v_total_ano > v_alta_inicio,
      'mensagemAltaRenda', CASE WHEN v_total_ano > v_alta_inicio THEN 'Rendimentos informados indicam necessidade de apuração da tributação mínima anual de alta renda.' ELSE 'Rendimentos informados abaixo do início da faixa anual de alta renda.' END
    ), v_memoria, v_alertas);
END;
$$;

CREATE OR REPLACE FUNCTION public.simular_ganho_capital(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id(); v_data_venda date; v_competencia date; v_param jsonb; v_config jsonb;
  v_tipo text; v_custo numeric; v_benfeitorias numeric; v_venda numeric; v_despesas numeric; v_participacao numeric;
  v_valores_proporcionais boolean; v_venda_normalizada numeric; v_reinvestido numeric; v_data_reinvestimento date; v_reinvestimento_valido boolean := false; v_ganho numeric; v_ganho_tributavel numeric; v_isento boolean := false; v_motivo text;
  v_total_mes numeric; v_unico_imovel boolean; v_sem_alienacao_5_anos boolean; v_reinvestimento_180 boolean;
  v_faixa jsonb; v_anterior numeric := 0; v_superior numeric; v_parcela numeric; v_aliquota numeric; v_imposto numeric := 0;
  v_aliquota_marginal numeric := 0; v_aliquota_efetiva numeric := 0; v_cronograma jsonb; v_cronograma_resultado jsonb := '[]'::jsonb; v_soma_parcelas numeric := 0;
  v_memoria jsonb := '[]'::jsonb; v_alertas jsonb; v_versoes jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa vinculada.'; END IF;
  IF jsonb_typeof(COALESCE(p, '{}'::jsonb)) <> 'object' OR octet_length(COALESCE(p, '{}'::jsonb)::text) > 65536 THEN RAISE EXCEPTION 'Entrada inválida ou muito grande.'; END IF;
  v_data_venda := public.calculo_data_segura(p ->> 'dataVenda', CURRENT_DATE);
  v_competencia := date_trunc('month', v_data_venda)::date;
  v_param := public.obter_parametro_tributario('ganho_capital', v_competencia, v_empresa_id);
  IF v_param = '{}'::jsonb THEN RAISE EXCEPTION 'Parâmetros de ganho de capital não configurados para %.', v_competencia; END IF;
  v_config := v_param -> 'configuracao';
  v_tipo := COALESCE(NULLIF(p ->> 'tipoBem', ''), 'outros');
  IF v_tipo NOT IN ('imovel', 'imovel_residencial', 'veiculo', 'participacao_societaria', 'outros') THEN RAISE EXCEPTION 'Tipo de bem inválido. Operações em bolsa devem ser apuradas no módulo de renda variável.'; END IF;
  v_custo := GREATEST(public.tributario_numero_json(p, 'custoAquisicao'), 0);
  v_benfeitorias := GREATEST(public.tributario_numero_json(p, 'benfeitorias'), 0);
  v_venda := GREATEST(public.tributario_numero_json(p, 'valorVenda'), 0);
  v_despesas := GREATEST(public.tributario_numero_json(p, 'despesasVenda'), 0);
  v_participacao := LEAST(GREATEST(public.tributario_numero_json(p, 'percentualPropriedade', 100), 0), 100);
  v_valores_proporcionais := COALESCE((p ->> 'valoresJaProporcionais')::boolean, false);
  v_venda_normalizada := CASE WHEN v_valores_proporcionais THEN v_venda ELSE v_venda * v_participacao / 100 END;
  v_reinvestido := GREATEST(public.tributario_numero_json(p, 'valorReinvestidoImovel180Dias'), 0);
  v_total_mes := GREATEST(public.tributario_numero_json(p, 'totalAlienacoesMesMesmaNatureza', v_venda_normalizada), 0);
  IF v_total_mes <= 0 THEN v_total_mes := v_venda_normalizada; END IF;
  v_unico_imovel := COALESCE((p ->> 'unicoImovelAte440Mil')::boolean, false);
  v_sem_alienacao_5_anos := COALESCE((p ->> 'semOutraAlienacaoImovel5Anos')::boolean, false);
  v_reinvestimento_180 := COALESCE((p ->> 'reinvestimentoResidencialDentro180Dias')::boolean, v_reinvestido > 0);
  IF NULLIF(trim(COALESCE(p ->> 'dataReinvestimento', '')), '') IS NOT NULL THEN
    BEGIN
      v_data_reinvestimento := (p ->> 'dataReinvestimento')::date;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      v_data_reinvestimento := NULL;
    END;
  END IF;
  v_reinvestimento_valido := v_reinvestimento_180
    AND v_reinvestido > 0
    AND v_data_reinvestimento IS NOT NULL
    AND v_data_reinvestimento BETWEEN v_data_venda AND (v_data_venda + 180);
  v_ganho := GREATEST(
    CASE WHEN v_valores_proporcionais THEN v_venda - v_custo - v_benfeitorias - v_despesas
         ELSE (v_venda - v_custo - v_benfeitorias - v_despesas) * v_participacao / 100 END,
    0
  );
  IF COALESCE((p ->> 'isencaoDeclarada')::boolean, false) THEN
    v_isento := true; v_motivo := 'Hipótese de isenção declarada pelo usuário e pendente de validação documental.';
  ELSIF v_tipo IN ('imovel', 'imovel_residencial') AND v_venda_normalizada <= 440000 AND v_unico_imovel AND v_sem_alienacao_5_anos THEN
    v_isento := true; v_motivo := 'Único imóvel até R$ 440 mil, condicionado à confirmação de nenhuma outra alienação imobiliária nos últimos cinco anos.';
  ELSIF v_total_mes > 0 AND v_total_mes <= (v_config ->> 'limitePequenaAlienacaoGeral')::numeric THEN
    v_isento := true; v_motivo := 'Alienações mensais de bens da mesma natureza dentro do limite informado.';
  END IF;
  v_ganho_tributavel := CASE
    WHEN v_isento THEN 0
    WHEN v_tipo = 'imovel_residencial' AND v_venda_normalizada > 0 AND v_reinvestimento_valido
      THEN v_ganho * GREATEST(v_venda_normalizada - LEAST(v_reinvestido, v_venda_normalizada), 0) / v_venda_normalizada
    ELSE v_ganho
  END;
  FOR v_faixa IN SELECT value FROM jsonb_array_elements(v_param -> 'faixas') LOOP
    EXIT WHEN v_ganho_tributavel <= v_anterior;
    v_superior := COALESCE((v_faixa ->> 'limiteSuperior')::numeric, v_ganho_tributavel);
    v_aliquota := (v_faixa ->> 'aliquota')::numeric;
    v_parcela := GREATEST(LEAST(v_ganho_tributavel, v_superior) - v_anterior, 0);
    v_imposto := v_imposto + v_parcela * v_aliquota / 100;
    IF v_parcela > 0 THEN v_aliquota_marginal := v_aliquota; END IF;
    v_memoria := v_memoria || jsonb_build_array(jsonb_build_object('descricao', 'Ganho de capital — faixa ' || (v_faixa ->> 'ordem'), 'base', round(v_parcela, 2), 'aliquota', v_aliquota, 'valor', round(v_parcela * v_aliquota / 100, 2)));
    v_anterior := v_superior;
  END LOOP;
  v_aliquota_efetiva := CASE WHEN v_ganho_tributavel > 0 THEN v_imposto / v_ganho_tributavel * 100 ELSE 0 END;
  v_cronograma := COALESCE(p -> 'cronogramaParcelas', '[]'::jsonb);
  IF jsonb_typeof(v_cronograma) <> 'array' THEN RAISE EXCEPTION 'cronogramaParcelas deve ser uma lista de {data, valor}.'; END IF;
  IF jsonb_array_length(v_cronograma) > 0 THEN
    SELECT COALESCE(sum(GREATEST(public.tributario_numero_json(value, 'valor'), 0)), 0),
      COALESCE(jsonb_agg(jsonb_build_object(
        'numero', ord,
        'data', value ->> 'data',
        'vencimento', COALESCE(NULLIF(value ->> 'data', '')::date, v_data_venda),
        'valorRecebido', round(GREATEST(public.tributario_numero_json(value, 'valor'), 0), 2),
        'impostoEstimado', round(CASE WHEN v_venda_normalizada > 0 THEN v_imposto * GREATEST(public.tributario_numero_json(value, 'valor'), 0) / v_venda_normalizada ELSE 0 END, 2)
      ) ORDER BY ord), '[]'::jsonb)
    INTO v_soma_parcelas, v_cronograma_resultado
    FROM jsonb_array_elements(v_cronograma) WITH ORDINALITY AS parcelas(value, ord);
  END IF;
  v_alertas := jsonb_build_array('Estimativa para conferência; valide a operação no GCAP.', 'Isenções, reduções por data de aquisição e situações especiais dependem de documentação e não são presumidas automaticamente.');
  IF v_reinvestido > 0 AND NOT v_reinvestimento_valido THEN
    v_alertas := v_alertas || jsonb_build_array('O benefício de reinvestimento residencial não foi aplicado: informe uma data válida entre a venda e os 180 dias seguintes.');
  END IF;
  IF v_isento THEN v_alertas := v_alertas || jsonb_build_array(v_motivo); END IF;
  IF jsonb_array_length(v_cronograma) > 0 AND abs(v_soma_parcelas - v_venda_normalizada) > 0.01 THEN v_alertas := v_alertas || jsonb_build_array('O cronograma parcelado não soma o valor de venda correspondente à participação; revise as parcelas.'); END IF;
  v_versoes := jsonb_build_array(jsonb_build_object('codigo', v_param ->> 'codigo', 'versao', v_param ->> 'versao'));
  RETURN public.finalizar_simulacao_tributaria('ganho_capital', v_competencia, p, v_versoes,
    jsonb_build_object(
      'valorVenda', round(v_venda, 2), 'valorVendaCorrespondenteParticipacao', round(v_venda_normalizada, 2),
      'valoresJaProporcionais', v_valores_proporcionais, 'percentualPropriedade', v_participacao,
      'custoAjustado', round(v_custo + v_benfeitorias + v_despesas, 2), 'totalAlienacoesMesMesmaNatureza', round(v_total_mes, 2),
      'ganhoCapital', round(v_ganho, 2), 'parcelaIsenta', round(v_ganho - v_ganho_tributavel, 2),
      'ganhoTributavel', round(v_ganho_tributavel, 2), 'impostoEstimado', round(v_imposto, 2),
      'aliquotaMarginal', round(v_aliquota_marginal, 4), 'aliquotaEfetiva', round(v_aliquota_efetiva, 4),
      'isento', v_isento, 'motivoIsencao', v_motivo, 'codigoDarf', v_config ->> 'codigoDarf',
      'dataReinvestimento', v_data_reinvestimento, 'reinvestimento180DiasAplicado', v_reinvestimento_valido,
      'cronogramaParcelas', v_cronograma_resultado,
      'ganhoBruto', round(v_ganho, 2), 'valorIsento', round(v_ganho - v_ganho_tributavel, 2),
      'baseCalculo', round(v_ganho_tributavel, 2), 'vencimento', public.ultimo_dia_util_estimado(v_competencia),
      'isencaoDescricao', v_motivo, 'parcelas', v_cronograma_resultado
    ), v_memoria, v_alertas);
EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Há um valor inválido nos parâmetros de ganho de capital.';
END;
$$;

CREATE OR REPLACE FUNCTION public.simular_mei(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id(); v_competencia date; v_param jsonb; v_config jsonb;
  v_tipo text; v_atividade text; v_ocupacao text; v_ocupacao_confirmada boolean; v_catalogo_completo boolean; v_quantidade_empregados integer; v_possui_socio boolean; v_possui_filial boolean; v_ano_referencia integer; v_ano_abertura integer; v_mes_abertura integer; v_mes_competencia integer; v_mes_inicio_acumulado integer; v_meses_limite integer;
  v_receitas jsonb; v_faturamento numeric; v_faturamento_mes numeric; v_meses_informados integer;
  v_limite_mensal numeric; v_limite numeric; v_tolerancia numeric; v_projecao numeric; v_percentual numeric;
  v_inss_percentual numeric; v_das numeric; v_status text; v_alertas jsonb := '[]'::jsonb; v_memoria jsonb; v_versoes jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa vinculada.'; END IF;
  IF jsonb_typeof(COALESCE(p, '{}'::jsonb)) <> 'object' OR octet_length(COALESCE(p, '{}'::jsonb)::text) > 65536 THEN RAISE EXCEPTION 'Entrada inválida ou muito grande.'; END IF;
  v_competencia := public.tributario_competencia_json(p, CURRENT_DATE);
  v_param := public.obter_parametro_tributario('mei', v_competencia, v_empresa_id);
  IF v_param = '{}'::jsonb THEN RAISE EXCEPTION 'Parâmetros do MEI não configurados para %.', v_competencia; END IF;
  v_config := v_param -> 'configuracao';
  v_tipo := COALESCE(NULLIF(p ->> 'tipoMei', ''), 'normal');
  v_atividade := COALESCE(NULLIF(p ->> 'atividade', ''), 'servico');
  IF v_tipo NOT IN ('normal', 'caminhoneiro') OR v_atividade NOT IN ('comercio', 'servico', 'comercio_servico') THEN RAISE EXCEPTION 'Tipo de MEI ou atividade inválida.'; END IF;
  v_ano_referencia := public.tributario_numero_json(p, 'anoReferencia', extract(year FROM v_competencia))::integer;
  IF v_ano_referencia <> extract(year FROM v_competencia)::integer THEN RAISE EXCEPTION 'O ano de referência deve ser o mesmo ano da competência.'; END IF;
  v_ocupacao := regexp_replace(COALESCE(p ->> 'ocupacaoCodigo', ''), '[^0-9]', '', 'g');
  v_catalogo_completo := COALESCE((v_config ->> 'ocupacoesCatalogoCompleto')::boolean, false);
  v_ocupacao_confirmada := v_ocupacao <> '' AND COALESCE((v_config -> 'ocupacoesPermitidas') ? v_ocupacao, false);
  IF NOT v_ocupacao_confirmada AND v_catalogo_completo THEN RAISE EXCEPTION 'Ocupação não permitida no parâmetro MEI vigente.'; END IF;
  IF NOT v_ocupacao_confirmada THEN v_alertas := v_alertas || jsonb_build_array('Ocupação pendente de confirmação no Anexo XI vigente; o catálogo local ainda não está completo.'); END IF;
  v_possui_socio := COALESCE((p ->> 'possuiSocio')::boolean, false);
  v_possui_filial := COALESCE((p ->> 'possuiFilial')::boolean, false);
  v_quantidade_empregados := GREATEST(public.tributario_numero_json(p, 'quantidadeEmpregados')::integer, 0);
  v_ano_abertura := public.tributario_numero_json(p, 'anoAbertura', extract(year FROM v_competencia))::integer;
  v_mes_abertura := LEAST(GREATEST(public.tributario_numero_json(p, 'mesAbertura', 1)::integer, 1), 12);
  IF v_ano_abertura > extract(year FROM v_competencia)::integer OR (v_ano_abertura = extract(year FROM v_competencia)::integer AND v_mes_abertura > extract(month FROM v_competencia)::integer) THEN RAISE EXCEPTION 'A abertura não pode ser posterior à competência.'; END IF;
  v_mes_competencia := extract(month FROM v_competencia)::integer;
  v_mes_inicio_acumulado := CASE WHEN v_ano_abertura = extract(year FROM v_competencia)::integer THEN v_mes_abertura ELSE 1 END;
  v_meses_limite := CASE WHEN v_ano_abertura = extract(year FROM v_competencia)::integer THEN 13 - v_mes_abertura ELSE 12 END;
  v_receitas := COALESCE(p -> 'receitasMensais', '[]'::jsonb);
  IF jsonb_typeof(v_receitas) <> 'array' THEN RAISE EXCEPTION 'receitasMensais deve ser uma lista de valores.'; END IF;
  IF jsonb_array_length(v_receitas) > 12 THEN RAISE EXCEPTION 'receitasMensais deve conter no máximo 12 competências.'; END IF;
  IF jsonb_array_length(v_receitas) > 0 THEN
    SELECT
      COALESCE(sum(GREATEST(public.tributario_numero_json(jsonb_build_object('v', value), 'v'), 0)), 0),
      GREATEST(v_mes_competencia - v_mes_inicio_acumulado + 1, 1),
      COALESCE(max(GREATEST(public.tributario_numero_json(jsonb_build_object('v', value), 'v'), 0)) FILTER (WHERE ord = v_mes_competencia), 0)
    INTO v_faturamento, v_meses_informados, v_faturamento_mes
    FROM jsonb_array_elements(v_receitas) WITH ORDINALITY AS receitas(value, ord)
    WHERE ord BETWEEN v_mes_inicio_acumulado AND v_mes_competencia;
  ELSE
    v_faturamento := GREATEST(public.tributario_numero_json(p, 'faturamentoAcumulado'), 0);
    v_meses_informados := GREATEST(v_mes_competencia - v_mes_inicio_acumulado + 1, 1);
    v_faturamento_mes := GREATEST(public.tributario_numero_json(p, 'faturamentoMes', CASE WHEN v_meses_informados > 0 THEN v_faturamento / v_meses_informados ELSE 0 END), 0);
  END IF;
  IF p ? 'faturamentoMes' THEN v_faturamento_mes := GREATEST(public.tributario_numero_json(p, 'faturamentoMes'), 0); END IF;
  v_limite_mensal := CASE WHEN v_tipo = 'caminhoneiro' THEN (v_config ->> 'limiteMensalCaminhoneiro')::numeric ELSE (v_config ->> 'limiteMensalProporcional')::numeric END;
  v_limite := CASE
    WHEN v_ano_abertura = extract(year FROM v_competencia)::integer THEN v_limite_mensal * v_meses_limite
    WHEN v_tipo = 'caminhoneiro' THEN (v_config ->> 'limiteAnualCaminhoneiro')::numeric
    ELSE (v_config ->> 'limiteAnual')::numeric
  END;
  v_tolerancia := (v_config ->> 'toleranciaExcessoPercentual')::numeric;
  v_projecao := CASE WHEN v_meses_informados > 0 THEN v_faturamento / v_meses_informados * v_meses_limite ELSE 0 END;
  v_percentual := CASE WHEN v_limite > 0 THEN v_faturamento / v_limite * 100 ELSE 0 END;
  v_inss_percentual := CASE WHEN v_tipo = 'caminhoneiro' THEN (v_config ->> 'inssCaminhoneiroPercentual')::numeric ELSE (v_config ->> 'inssPercentual')::numeric END;
  v_das := (v_config ->> 'salarioMinimo')::numeric * v_inss_percentual / 100
    + CASE WHEN v_atividade IN ('comercio', 'comercio_servico') THEN (v_config ->> 'icmsFixo')::numeric ELSE 0 END
    + CASE WHEN v_atividade IN ('servico', 'comercio_servico') THEN (v_config ->> 'issFixo')::numeric ELSE 0 END;
  v_status := CASE WHEN v_faturamento > v_limite * (1 + v_tolerancia / 100) THEN 'excesso_superior_20' WHEN v_faturamento > v_limite THEN 'excesso_ate_20' WHEN v_projecao > v_limite OR v_percentual >= 80 THEN 'atencao' ELSE 'dentro_limite' END;
  IF v_quantidade_empregados > 1 THEN v_status := 'condicao_impeditiva'; v_alertas := v_alertas || jsonb_build_array('Mais de um empregado é condição impeditiva para permanência no MEI.'); END IF;
  IF v_possui_socio THEN v_status := 'condicao_impeditiva'; v_alertas := v_alertas || jsonb_build_array('Participação de sócio é condição impeditiva para permanência no MEI.'); END IF;
  IF v_possui_filial THEN v_status := 'condicao_impeditiva'; v_alertas := v_alertas || jsonb_build_array('Manutenção de filial é condição impeditiva para permanência no MEI.'); END IF;
  IF v_status = 'excesso_superior_20' THEN v_alertas := v_alertas || jsonb_build_array('Excesso superior a 20%: pode haver desenquadramento retroativo; faça a análise formal do período.');
  ELSIF v_status = 'excesso_ate_20' THEN v_alertas := v_alertas || jsonb_build_array('Limite excedido em até 20%: confira tributação do excesso e desenquadramento para o ano seguinte.');
  ELSIF v_status = 'atencao' THEN v_alertas := v_alertas || jsonb_build_array('Faturamento ou projeção próximos/acima do limite anual proporcional.'); END IF;
  v_alertas := v_alertas || jsonb_build_array('A permanência no SIMEI também depende da ocupação permitida e da ausência de condições impeditivas.', 'O valor do DAS é estimado pelos componentes fixos vigentes; confira a guia oficial do período.');
  v_memoria := jsonb_build_array(
    jsonb_build_object('descricao', 'Limite proporcional', 'base', v_limite_mensal, 'aliquota', NULL, 'valor', round(v_limite, 2)),
    jsonb_build_object('descricao', 'INSS no DAS-MEI', 'base', v_config -> 'salarioMinimo', 'aliquota', v_inss_percentual, 'valor', round((v_config ->> 'salarioMinimo')::numeric * v_inss_percentual / 100, 2))
  );
  v_versoes := jsonb_build_array(jsonb_build_object('codigo', v_param ->> 'codigo', 'versao', v_param ->> 'versao'));
  RETURN public.finalizar_simulacao_tributaria('mei', v_competencia, p, v_versoes,
    jsonb_build_object(
      'tipoMei', v_tipo, 'atividade', v_atividade, 'ocupacaoCodigo', NULLIF(v_ocupacao, ''), 'ocupacaoConfirmada', v_ocupacao_confirmada,
      'quantidadeEmpregados', v_quantidade_empregados, 'possuiSocio', v_possui_socio, 'possuiFilial', v_possui_filial,
      'mesesConsideradosAcumulado', v_meses_informados, 'mesesConsideradosLimite', v_meses_limite,
      'faturamentoAcumulado', round(v_faturamento, 2), 'faturamentoMes', round(v_faturamento_mes, 2),
      'limiteProporcional', round(v_limite, 2), 'percentualConsumido', round(v_percentual, 2),
      'projecaoAnual', round(v_projecao, 2), 'excesso', round(GREATEST(v_faturamento - v_limite, 0), 2),
      'status', v_status, 'dasMensalEstimado', round(v_das, 2),
      'limiteAnual', round(v_limite, 2), 'receitaAcumulada', round(v_faturamento, 2),
      'receitaProjetada', round(v_projecao, 2), 'percentualUtilizado', round(v_percentual, 2),
      'faixaRisco', CASE v_status WHEN 'dentro_limite' THEN 'regular' WHEN 'atencao' THEN 'atencao' WHEN 'excesso_ate_20' THEN 'excesso_ate_20' WHEN 'excesso_superior_20' THEN 'excesso_acima_20' ELSE 'impeditivo' END,
      'faixaRiscoDescricao', CASE v_status WHEN 'dentro_limite' THEN 'Receita dentro do limite proporcional.' WHEN 'atencao' THEN 'Receita projetada próxima ou acima do limite.' WHEN 'excesso_ate_20' THEN 'Excesso de receita em até 20%.' WHEN 'excesso_superior_20' THEN 'Excesso de receita superior a 20%.' ELSE 'Condição impeditiva identificada.' END,
      'valorExcesso', round(GREATEST(v_faturamento - v_limite, 0), 2),
      'desenquadramentoDescricao', CASE v_status WHEN 'excesso_ate_20' THEN 'Possível desenquadramento a partir do ano seguinte, sujeito à apuração formal.' WHEN 'excesso_superior_20' THEN 'Possível desenquadramento retroativo, sujeito à apuração formal.' WHEN 'condicao_impeditiva' THEN 'Condição impeditiva exige análise de desenquadramento.' ELSE 'Sem indicação de desenquadramento apenas pelo faturamento informado.' END,
      'competenciaParametros', v_competencia
    ), v_memoria, v_alertas);
END;
$$;

REVOKE ALL ON FUNCTION public.ultimo_dia_util_estimado(date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalizar_simulacao_tributaria(text,date,jsonb,jsonb,jsonb,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.simular_carne_leao(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.simular_irpf_anual(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.simular_prolabore_dividendos(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.simular_ganho_capital(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.simular_mei(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simular_carne_leao(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simular_irpf_anual(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simular_prolabore_dividendos(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simular_ganho_capital(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simular_mei(jsonb) TO authenticated;
