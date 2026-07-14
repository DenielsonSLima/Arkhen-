-- Impede que CPP ausente, vazia ou igual a zero seja aceita no Anexo IV.

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

REVOKE ALL ON FUNCTION public.simular_prolabore_dividendos(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simular_prolabore_dividendos(jsonb) TO authenticated;
