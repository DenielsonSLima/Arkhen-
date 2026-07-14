-- Helpers internos selecionam a versão tributária pela competência. As RPCs
-- públicas são pequenas e separadas para que o frontend calcule apenas a aba ativa.

CREATE OR REPLACE FUNCTION public.tributario_numero_json(
  p_json jsonb,
  p_chave text,
  p_padrao numeric DEFAULT 0
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE v_valor numeric;
BEGIN
  v_valor := NULLIF(trim(p_json ->> p_chave), '')::numeric;
  IF v_valor IS NULL OR v_valor <> v_valor THEN
    RETURN p_padrao;
  END IF;
  RETURN v_valor;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
  RETURN p_padrao;
END;
$$;

CREATE OR REPLACE FUNCTION public.tributario_competencia_json(
  p_json jsonb,
  p_padrao date DEFAULT CURRENT_DATE
)
RETURNS date
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE v_texto text := NULLIF(trim(p_json ->> 'competencia'), '');
BEGIN
  IF v_texto IS NULL THEN RETURN date_trunc('month', p_padrao)::date; END IF;
  IF v_texto ~ '^\d{4}-\d{2}$' THEN v_texto := v_texto || '-01'; END IF;
  RETURN date_trunc('month', v_texto::date)::date;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
  RETURN date_trunc('month', p_padrao)::date;
END;
$$;

CREATE OR REPLACE FUNCTION public.obter_parametro_tributario(
  p_tipo text,
  p_competencia date,
  p_empresa_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((
    SELECT jsonb_build_object(
      'id', p.id,
      'codigo', p.codigo,
      'tipo', p.tipo,
      'nome', p.nome,
      'versao', p.versao,
      'vigenciaInicio', p.vigencia_inicio,
      'vigenciaFim', p.vigencia_fim,
      'fonte', p.fonte_url,
      'norma', p.norma,
      'configuracao', p.configuracao,
      'faixas', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'ordem', f.ordem,
          'limiteInferior', f.limite_inferior,
          'limiteSuperior', f.limite_superior,
          'aliquota', f.aliquota,
          'parcelaDeduzir', f.parcela_deduzir,
          'configuracao', f.configuracao
        ) ORDER BY f.ordem)
        FROM public.parametros_tributarios_faixas f
        WHERE f.parametro_id = p.id
      ), '[]'::jsonb)
    )
    FROM public.parametros_tributarios p
    WHERE p.tipo = p_tipo
      AND (p.empresa_id IS NULL OR p.empresa_id = p_empresa_id)
      AND p.vigencia_inicio <= p_competencia
      AND (p.vigencia_fim IS NULL OR p.vigencia_fim >= p_competencia)
    ORDER BY (p.empresa_id = p_empresa_id) DESC, p.vigencia_inicio DESC, p.criado_em DESC
    LIMIT 1
  ), '{}'::jsonb)
$$;

CREATE OR REPLACE FUNCTION public.calculo_inss_progressivo_detalhado(
  p_base numeric,
  p_competencia date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_param jsonb;
  v_faixa jsonb;
  v_base numeric := GREATEST(COALESCE(p_base, 0), 0);
  v_base_limitada numeric;
  v_anterior numeric := 0;
  v_superior numeric;
  v_aliquota numeric;
  v_parcela_base numeric;
  v_parcela_valor numeric;
  v_total numeric := 0;
  v_memoria jsonb := '[]'::jsonb;
BEGIN
  v_param := public.obter_parametro_tributario('inss', p_competencia, v_empresa_id);
  IF v_param = '{}'::jsonb THEN RAISE EXCEPTION 'Tabela INSS não configurada para a competência %.', p_competencia; END IF;
  v_base_limitada := LEAST(v_base, COALESCE((v_param #>> '{configuracao,tetoBeneficios}')::numeric, v_base));

  FOR v_faixa IN SELECT value FROM jsonb_array_elements(v_param -> 'faixas') LOOP
    EXIT WHEN v_base_limitada <= v_anterior;
    v_superior := COALESCE((v_faixa ->> 'limiteSuperior')::numeric, v_base_limitada);
    v_aliquota := COALESCE((v_faixa ->> 'aliquota')::numeric, 0);
    v_parcela_base := GREATEST(LEAST(v_base_limitada, v_superior) - v_anterior, 0);
    v_parcela_valor := v_parcela_base * v_aliquota / 100;
    v_total := v_total + v_parcela_valor;
    v_memoria := v_memoria || jsonb_build_array(jsonb_build_object(
      'descricao', 'INSS — faixa ' || (v_faixa ->> 'ordem'),
      'base', round(v_parcela_base, 2),
      'aliquota', v_aliquota,
      'valor', round(v_parcela_valor, 2)
    ));
    v_anterior := v_superior;
  END LOOP;

  RETURN jsonb_build_object(
    'valor', round(v_total, 2),
    'baseOriginal', round(v_base, 2),
    'baseLimitada', round(v_base_limitada, 2),
    'parametro', jsonb_build_object('codigo', v_param ->> 'codigo', 'versao', v_param ->> 'versao'),
    'memoriaCalculo', v_memoria
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.calculo_inss_progressivo(p_base numeric, p_competencia date)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((public.calculo_inss_progressivo_detalhado(p_base, p_competencia) ->> 'valor')::numeric, 0)
$$;

CREATE OR REPLACE FUNCTION public.calculo_inss_progressivo(p_base numeric)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.calculo_inss_progressivo(
    p_base,
    COALESCE(NULLIF(current_setting('app.competencia_simulacao', true), '')::date, CURRENT_DATE)
  )
$$;

CREATE OR REPLACE FUNCTION public.calculo_irrf_detalhado(
  p_base numeric,
  p_rendimento numeric,
  p_competencia date,
  p_anual boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_tipo text := CASE WHEN p_anual THEN 'irpf_anual' ELSE 'irrf_mensal' END;
  v_param jsonb;
  v_config jsonb;
  v_faixa jsonb;
  v_base numeric := GREATEST(COALESCE(p_base, 0), 0);
  v_rendimento numeric := GREATEST(COALESCE(p_rendimento, p_base, 0), 0);
  v_aliquota numeric := 0;
  v_deducao numeric := 0;
  v_imposto_tabela numeric := 0;
  v_reducao numeric := 0;
  v_imposto numeric := 0;
BEGIN
  v_param := public.obter_parametro_tributario(v_tipo, p_competencia, v_empresa_id);
  IF v_param = '{}'::jsonb THEN RAISE EXCEPTION 'Tabela % não configurada para a competência %.', upper(v_tipo), p_competencia; END IF;
  v_config := v_param -> 'configuracao';

  SELECT value INTO v_faixa
  FROM jsonb_array_elements(v_param -> 'faixas')
  WHERE (value ->> 'limiteSuperior') IS NULL
     OR v_base <= (value ->> 'limiteSuperior')::numeric
  ORDER BY (value ->> 'ordem')::integer
  LIMIT 1;

  v_aliquota := COALESCE((v_faixa ->> 'aliquota')::numeric, 0);
  v_deducao := COALESCE((v_faixa ->> 'parcelaDeduzir')::numeric, 0);
  v_imposto_tabela := round(GREATEST(v_base * v_aliquota / 100 - v_deducao, 0), 2);

  IF v_rendimento <= COALESCE((v_config ->> 'reducaoIntegralAte')::numeric, 0) THEN
    v_reducao := LEAST(v_imposto_tabela, COALESCE((v_config ->> 'reducaoMaxima')::numeric, 0));
  ELSIF v_rendimento < COALESCE((v_config ->> 'reducaoParcialAte')::numeric, 0) THEN
    v_reducao := LEAST(
      v_imposto_tabela,
      GREATEST(
        COALESCE((v_config ->> 'reducaoParcialConstante')::numeric, 0)
          - COALESCE((v_config ->> 'reducaoParcialCoeficiente')::numeric, 0) * v_rendimento,
        0
      )
    );
  END IF;
  v_reducao := round(v_reducao, 2);
  v_imposto := round(GREATEST(v_imposto_tabela - v_reducao, 0), 2);

  RETURN jsonb_build_object(
    'valor', v_imposto,
    'base', round(v_base, 2),
    'rendimento', round(v_rendimento, 2),
    'aliquota', v_aliquota,
    'parcelaDeduzir', v_deducao,
    'impostoTabela', v_imposto_tabela,
    'reducao', round(v_reducao, 2),
    'parametro', jsonb_build_object('codigo', v_param ->> 'codigo', 'versao', v_param ->> 'versao'),
    'memoriaCalculo', jsonb_build_array(
      jsonb_build_object('descricao', CASE WHEN p_anual THEN 'IRPF anual pela tabela progressiva' ELSE 'IRRF pela tabela progressiva' END, 'base', round(v_base, 2), 'aliquota', v_aliquota, 'valor', v_imposto_tabela),
      jsonb_build_object('descricao', 'Redução legal aplicável', 'base', round(v_rendimento, 2), 'aliquota', NULL, 'valor', round(-v_reducao, 2))
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.calculo_irrf(p_base numeric, p_competencia date)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((public.calculo_irrf_detalhado(p_base, p_base, p_competencia, false) ->> 'valor')::numeric, 0)
$$;

CREATE OR REPLACE FUNCTION public.calculo_irrf(p_base numeric)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.calculo_irrf(
    p_base,
    COALESCE(NULLIF(current_setting('app.competencia_simulacao', true), '')::date, CURRENT_DATE)
  )
$$;

CREATE OR REPLACE FUNCTION public.executar_simulacao_contabil_interna(p_tipo text, p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_competencia date := public.tributario_competencia_json(p, CURRENT_DATE);
  v_resultado jsonb;
  v_inss numeric;
  v_inss_antigo numeric;
  v_irrf jsonb;
  v_irrf_antigo numeric;
  v_base numeric;
  v_bruto numeric;
  v_beneficios numeric;
  v_deducoes_legais numeric;
  v_desconto_simplificado numeric;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa vinculada.';
  END IF;
  IF jsonb_typeof(COALESCE(p, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Os parâmetros da simulação devem ser um objeto JSON.';
  END IF;
  PERFORM set_config('app.competencia_simulacao', v_competencia::text, true);
  v_resultado := public.calcular_simulacao_contabil(p_tipo, COALESCE(p, '{}'::jsonb));

  -- O redutor de 2026 considera o rendimento bruto, não a base após deduções.
  -- Recompõe os contratos antigos que antes só conheciam a base do IRRF.
  IF p_tipo = 'folha' THEN
    v_bruto := COALESCE((v_resultado ->> 'salarioBruto')::numeric, 0);
    v_inss_antigo := COALESCE((v_resultado ->> 'inss')::numeric, 0);
    v_inss := CASE
      WHEN COALESCE(p ->> 'tipoFuncionario', 'clt') = 'prolabore' THEN
        LEAST(v_bruto * 0.11, COALESCE((public.obter_parametro_tributario('inss', v_competencia, v_empresa_id) #>> '{configuracao,tetoBeneficios}')::numeric, 0) * 0.11)
      ELSE public.calculo_inss_progressivo(v_bruto, v_competencia)
    END;
    v_deducoes_legais := v_inss
      + GREATEST(public.tributario_numero_json(p, 'dependentes'), 0) * COALESCE((public.obter_parametro_tributario('irrf_mensal', v_competencia, v_empresa_id) #>> '{configuracao,deducaoDependente}')::numeric, 0)
      + GREATEST(public.tributario_numero_json(p, 'pensaoAlimenticia'), 0);
    v_desconto_simplificado := COALESCE((public.obter_parametro_tributario('irrf_mensal', v_competencia, v_empresa_id) #>> '{configuracao,descontoSimplificado}')::numeric, 0);
    v_base := GREATEST(v_bruto - GREATEST(v_deducoes_legais, v_desconto_simplificado), 0);
    v_irrf_antigo := COALESCE((v_resultado ->> 'irrf')::numeric, 0);
    v_irrf := public.calculo_irrf_detalhado(v_base, v_bruto, v_competencia, false);
    v_resultado := v_resultado || jsonb_build_object(
      'inss', round(v_inss, 2),
      'baseIRRF', round(v_base, 2),
      'irrf', v_irrf -> 'valor',
      'descontosFuncionario', round(COALESCE((v_resultado ->> 'descontosFuncionario')::numeric, 0) - v_inss_antigo - v_irrf_antigo + v_inss + (v_irrf ->> 'valor')::numeric, 2),
      'salarioLiquido', round(COALESCE((v_resultado ->> 'salarioLiquido')::numeric, 0) + v_inss_antigo + v_irrf_antigo - v_inss - (v_irrf ->> 'valor')::numeric, 2)
    );
  ELSIF p_tipo = 'ferias' THEN
    v_bruto := COALESCE((v_resultado ->> 'valorFerias')::numeric, 0) + COALESCE((v_resultado ->> 'tercoConstitucional')::numeric, 0);
    v_inss := COALESCE((v_resultado ->> 'inss')::numeric, 0);
    v_deducoes_legais := v_inss + GREATEST(public.tributario_numero_json(p, 'dependentes'), 0) * COALESCE((public.obter_parametro_tributario('irrf_mensal', v_competencia, v_empresa_id) #>> '{configuracao,deducaoDependente}')::numeric, 0);
    v_desconto_simplificado := COALESCE((public.obter_parametro_tributario('irrf_mensal', v_competencia, v_empresa_id) #>> '{configuracao,descontoSimplificado}')::numeric, 0);
    v_base := GREATEST(v_bruto - GREATEST(v_deducoes_legais, v_desconto_simplificado), 0);
    v_irrf_antigo := COALESCE((v_resultado ->> 'irrf')::numeric, 0);
    v_irrf := public.calculo_irrf_detalhado(v_base, v_bruto, v_competencia, false);
    v_resultado := v_resultado || jsonb_build_object(
      'irrf', v_irrf -> 'valor',
      'totalLiquido', round(COALESCE((v_resultado ->> 'totalLiquido')::numeric, 0) + v_irrf_antigo - (v_irrf ->> 'valor')::numeric, 2)
    );
  ELSIF p_tipo = 'prolabore' THEN
    v_bruto := GREATEST(public.tributario_numero_json(p, 'valor'), 0);
    v_inss := LEAST(v_bruto * 0.11,
      COALESCE((public.obter_parametro_tributario('inss', v_competencia, v_empresa_id) #>> '{configuracao,tetoBeneficios}')::numeric, 0) * 0.11);
    v_desconto_simplificado := COALESCE((public.obter_parametro_tributario('irrf_mensal', v_competencia, v_empresa_id) #>> '{configuracao,descontoSimplificado}')::numeric, 0);
    v_irrf := public.calculo_irrf_detalhado(GREATEST(v_bruto - GREATEST(v_inss, v_desconto_simplificado), 0), v_bruto, v_competencia, false);
    v_resultado := v_resultado || jsonb_build_object(
      'inss', round(v_inss, 2), 'irrf', v_irrf -> 'valor',
      'liquido', round(v_bruto - v_inss - (v_irrf ->> 'valor')::numeric, 2)
    );
  ELSIF p_tipo = 'simulacao-contratacao' THEN
    v_bruto := GREATEST(public.tributario_numero_json(p, 'salarioProposto'), 0);
    v_inss := public.calculo_inss_progressivo(v_bruto, v_competencia);
    v_desconto_simplificado := COALESCE((public.obter_parametro_tributario('irrf_mensal', v_competencia, v_empresa_id) #>> '{configuracao,descontoSimplificado}')::numeric, 0);
    v_irrf := public.calculo_irrf_detalhado(GREATEST(v_bruto - GREATEST(v_inss, v_desconto_simplificado), 0), v_bruto, v_competencia, false);
    v_beneficios := public.tributario_numero_json(p, 'valeTransporte')
      + public.tributario_numero_json(p, 'valeAlimentacao')
      + public.tributario_numero_json(p, 'planoSaude');
    v_resultado := v_resultado || jsonb_build_object(
      'liquidoClt', round(v_bruto - v_inss - (v_irrf ->> 'valor')::numeric + v_beneficios * 0.7, 2)
    );
  ELSIF p_tipo = 'rescisao' THEN
    -- Mantém o escopo estimativo da calculadora existente, mas elimina teto e
    -- faixas fixas: INSS/IRRF passam a usar a tabela da competência escolhida.
    v_bruto := COALESCE((v_resultado ->> 'saldoSalario')::numeric, 0)
      + COALESCE((v_resultado ->> 'decimoTerceiroProporcional')::numeric, 0)
      + COALESCE((v_resultado ->> 'avisoPrevio')::numeric, 0);
    v_inss_antigo := COALESCE((v_resultado ->> 'inssRescisao')::numeric, 0);
    v_irrf_antigo := COALESCE((v_resultado ->> 'irrfRescisao')::numeric, 0);
    v_inss := public.calculo_inss_progressivo(v_bruto, v_competencia);
    v_desconto_simplificado := COALESCE((public.obter_parametro_tributario('irrf_mensal', v_competencia, v_empresa_id) #>> '{configuracao,descontoSimplificado}')::numeric, 0);
    v_irrf := public.calculo_irrf_detalhado(GREATEST(v_bruto - GREATEST(v_inss, v_desconto_simplificado), 0), v_bruto, v_competencia, false);
    v_resultado := v_resultado || jsonb_build_object(
      'inssRescisao', round(v_inss, 2), 'irrfRescisao', v_irrf -> 'valor',
      'totalLiquido', round(COALESCE((v_resultado ->> 'totalLiquido')::numeric, 0) + v_inss_antigo + v_irrf_antigo - v_inss - (v_irrf ->> 'valor')::numeric, 2)
    );
  END IF;
  RETURN v_resultado;
END;
$$;

CREATE OR REPLACE FUNCTION public.envelope_simulacao_existente(p_tipo text, p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_competencia date := public.tributario_competencia_json(p, CURRENT_DATE);
  v_resultado jsonb;
  v_versoes jsonb := '[]'::jsonb;
  v_param jsonb;
BEGIN
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

CREATE OR REPLACE FUNCTION public.simular_folha(p jsonb) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$ SELECT public.envelope_simulacao_existente('folha', p) $$;
CREATE OR REPLACE FUNCTION public.simular_rescisao(p jsonb) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$ SELECT public.envelope_simulacao_existente('rescisao', p) $$;
CREATE OR REPLACE FUNCTION public.simular_ferias(p jsonb) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$ SELECT public.envelope_simulacao_existente('ferias', p) $$;
CREATE OR REPLACE FUNCTION public.simular_prolabore(p jsonb) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$ SELECT public.envelope_simulacao_existente('prolabore', p) $$;
CREATE OR REPLACE FUNCTION public.simular_das(p jsonb) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$ SELECT public.envelope_simulacao_existente('das', p) $$;
CREATE OR REPLACE FUNCTION public.simular_pis_cofins(p jsonb) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$ SELECT public.envelope_simulacao_existente('piscofins', p) $$;
CREATE OR REPLACE FUNCTION public.simular_multas(p jsonb) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$ SELECT public.envelope_simulacao_existente('multas', p) $$;
CREATE OR REPLACE FUNCTION public.simular_tempo_empresa(p jsonb) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$ SELECT public.envelope_simulacao_existente('tempo-empresa', p) $$;
CREATE OR REPLACE FUNCTION public.simular_encargos_trabalhistas(p jsonb) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$ SELECT public.envelope_simulacao_existente('encargos-trabalhistas', p) $$;
CREATE OR REPLACE FUNCTION public.simular_contratacao(p jsonb) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$ SELECT public.envelope_simulacao_existente('simulacao-contratacao', p) $$;
CREATE OR REPLACE FUNCTION public.simular_comparativo_regime(p jsonb) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$ SELECT public.envelope_simulacao_existente('comparativo-regime', p) $$;
CREATE OR REPLACE FUNCTION public.simular_imposto_estimado(p jsonb) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$ SELECT public.envelope_simulacao_existente('simulacao-imposto', p) $$;
CREATE OR REPLACE FUNCTION public.simular_custos(p jsonb) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$ SELECT public.envelope_simulacao_existente('simulacao-custos', p) $$;

-- Mantém o contrato legado do lote, mas agora a competência informada é propagada
-- aos helpers. O frontend novo deve preferir as RPCs individuais acima.
CREATE OR REPLACE FUNCTION public.calcular_simulacoes_contabeis(p_solicitacoes jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_chave text;
  v_parametros jsonb;
  v_result jsonb := '{}'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa vinculada.'; END IF;
  IF jsonb_typeof(COALESCE(p_solicitacoes, '{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'Solicitações inválidas.'; END IF;
  FOR v_chave, v_parametros IN SELECT * FROM jsonb_each(COALESCE(p_solicitacoes, '{}'::jsonb)) LOOP
    v_result := v_result || jsonb_build_object(v_chave, public.executar_simulacao_contabil_interna(v_chave, v_parametros));
  END LOOP;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.tributario_numero_json(jsonb,text,numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tributario_competencia_json(jsonb,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.obter_parametro_tributario(text,date,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calculo_inss_progressivo_detalhado(numeric,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calculo_inss_progressivo(numeric,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calculo_inss_progressivo(numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calculo_irrf_detalhado(numeric,numeric,date,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calculo_irrf(numeric,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calculo_irrf(numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.executar_simulacao_contabil_interna(text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.envelope_simulacao_existente(text,jsonb) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.simular_folha(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.simular_rescisao(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.simular_ferias(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.simular_prolabore(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.simular_das(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.simular_pis_cofins(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.simular_multas(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.simular_tempo_empresa(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.simular_encargos_trabalhistas(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.simular_contratacao(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.simular_comparativo_regime(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.simular_imposto_estimado(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.simular_custos(jsonb) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.simular_folha(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simular_rescisao(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simular_ferias(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simular_prolabore(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simular_das(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simular_pis_cofins(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simular_multas(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simular_tempo_empresa(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simular_encargos_trabalhistas(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simular_contratacao(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simular_comparativo_regime(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simular_imposto_estimado(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simular_custos(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.calcular_simulacoes_contabeis(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_simulacoes_contabeis(jsonb) TO authenticated;
