-- Relatórios gerenciais baseados exclusivamente nos dados do tenant autenticado.

CREATE OR REPLACE FUNCTION public.get_relatorio_faturamento_json(
  p_cliente_id uuid DEFAULT NULL,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_inicio date := COALESCE(p_data_inicio, date_trunc('year', CURRENT_DATE)::date);
  v_fim date := COALESCE(p_data_fim, CURRENT_DATE);
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa vinculada.'; END IF;
  IF v_inicio > v_fim THEN RAISE EXCEPTION 'Período inválido.'; END IF;

  WITH cobrancas_base AS (
    SELECT c.*, COALESCE(r.valor_recebido, 0) AS recebimento_registrado
    FROM public.financeiro_cobrancas c
    LEFT JOIN (
      SELECT referencia_id, sum(valor) AS valor_recebido
      FROM public.financeiro_lancamentos
      WHERE empresa_id = v_empresa_id AND origem = 'cobranca' AND tipo = 'receita' AND status = 'Pago'
      GROUP BY referencia_id
    ) r ON r.referencia_id = c.id
    WHERE c.empresa_id = v_empresa_id AND c.status <> 'Cancelado'
      AND c.data_vencimento BETWEEN v_inicio AND v_fim
      AND (p_cliente_id IS NULL OR c.cliente_empresa_id = p_cliente_id)
  ), movimentos AS (
    SELECT c.cliente_empresa_id AS cliente_id, c.data_vencimento AS data_ref,
      CASE WHEN c.status = 'Pago' THEN GREATEST(c.valor, c.recebimento_registrado)
        ELSE c.valor + c.recebimento_registrado END AS valor,
      CASE WHEN c.recebimento_registrado > 0 THEN c.recebimento_registrado
        WHEN c.status = 'Pago' THEN c.valor ELSE 0 END AS recebido,
      CASE WHEN c.status IN ('Pendente', 'Vencido') THEN c.valor ELSE 0 END AS pendente,
      CASE WHEN c.status = 'Vencido' THEN c.valor ELSE 0 END AS vencido
    FROM cobrancas_base c
    UNION ALL
    SELECT l.cliente_empresa_id, l.data_competencia, l.valor,
      CASE WHEN l.status = 'Pago' THEN l.valor ELSE 0 END,
      CASE WHEN l.status = 'Pendente' THEN l.valor ELSE 0 END,
      CASE WHEN l.status = 'Pendente' AND l.data_competencia < CURRENT_DATE THEN l.valor ELSE 0 END
    FROM public.financeiro_lancamentos l
    WHERE l.empresa_id = v_empresa_id AND l.tipo = 'receita' AND l.origem <> 'cobranca'
      AND l.status <> 'Cancelado' AND l.data_competencia BETWEEN v_inicio AND v_fim
      AND (p_cliente_id IS NULL OR l.cliente_empresa_id = p_cliente_id)
  ),
  totais AS (
    SELECT COALESCE(sum(valor), 0) total_faturado,
      COALESCE(sum(recebido), 0) total_recebido,
      COALESCE(sum(pendente), 0) total_pendente,
      COALESCE(sum(vencido), 0) total_vencido
    FROM movimentos
  ),
  mensal AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'mes', to_char(mes, 'MM/YYYY'), 'faturado', faturado,
      'recebido', recebido, 'inadimplente', inadimplente
    ) ORDER BY mes), '[]'::jsonb) data
    FROM (
      SELECT date_trunc('month', data_ref)::date mes, sum(valor) faturado,
        COALESCE(sum(recebido), 0) recebido,
        COALESCE(sum(vencido), 0) inadimplente
      FROM movimentos GROUP BY 1
    ) agrupado
  ),
  clientes_top AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'valor', valor) ORDER BY valor DESC), '[]'::jsonb) data
    FROM (
      SELECT COALESCE(c.nome, 'Sem cliente vinculado') nome, sum(m.valor) valor
      FROM movimentos m LEFT JOIN public.clientes c ON c.id = m.cliente_id AND c.empresa_id = v_empresa_id
      GROUP BY c.id, c.nome ORDER BY valor DESC LIMIT 5
    ) top5
  )
  SELECT jsonb_build_object(
    'totalFaturado', t.total_faturado, 'totalRecebido', t.total_recebido,
    'totalPendente', t.total_pendente,
    'taxaInadimplencia', CASE WHEN t.total_recebido + t.total_vencido > 0 THEN round(t.total_vencido / (t.total_recebido + t.total_vencido) * 100, 2) ELSE 0 END,
    'historicoMensal', (SELECT data FROM mensal),
    'clientesMaisFaturados', (SELECT data FROM clientes_top)
  ) INTO v_result FROM totais t;
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_relatorio_conformidade_json(p_cliente_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_empresa_id uuid := public.current_empresa_id(); v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa vinculada.'; END IF;
  WITH base AS (
    SELECT ai.*,
      CASE WHEN ai.competencia ~ '^\d{2}/\d{4}$'
        THEN (date_trunc('month', to_date('01/' || ai.competencia, 'DD/MM/YYYY')) + interval '1 month - 1 day')::date
        ELSE (date_trunc('month', to_date(ai.competencia || '-01', 'YYYY-MM-DD')) + interval '1 month - 1 day')::date
      END AS vencimento,
      COALESCE(am.nome, ai.modelo_codigo, 'Obrigação') AS nome_modelo
    FROM public.atividades_instancias ai
    LEFT JOIN public.atividades_modelos am ON am.id = ai.modelo_id AND am.empresa_id = v_empresa_id
    WHERE ai.empresa_id = v_empresa_id AND COALESCE(ai.ativo, true)
      AND (p_cliente_id IS NULL OR ai.cliente_id = p_cliente_id)
  ), totais AS (
    SELECT count(*) total, count(*) FILTER (WHERE status = 'Concluída') concluidas,
      count(*) FILTER (WHERE status <> 'Concluída' AND vencimento >= CURRENT_DATE) pendentes,
      count(*) FILTER (WHERE status <> 'Concluída' AND vencimento < CURRENT_DATE) atrasadas FROM base
  ), distribuicao AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome_modelo, 'total', total, 'concluidas', concluidas) ORDER BY total DESC), '[]'::jsonb) data
    FROM (SELECT nome_modelo, count(*) total, count(*) FILTER (WHERE status = 'Concluída') concluidas FROM base GROUP BY nome_modelo) d
  )
  SELECT jsonb_build_object('totalObrigacoes', total, 'concluidas', concluidas, 'pendentes', pendentes,
    'atrasadas', atrasadas, 'taxaConformidade', CASE WHEN total > 0 THEN round(concluidas::numeric / total * 100, 2) ELSE 100 END,
    'distribuicaoObrigacoes', (SELECT data FROM distribuicao)) INTO v_result FROM totais;
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_relatorio_pessoal_json(p_cliente_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_empresa_id uuid := public.current_empresa_id(); v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa vinculada.'; END IF;
  WITH pessoas AS (
    SELECT c.id cliente_id, f.item,
      COALESCE(f.item->>'status', '') = 'Ativo' ativo,
      COALESCE(NULLIF(f.item->>'salario', '')::numeric, 0) salario,
      COALESCE(NULLIF(f.item->>'cargo', ''), 'Não informado') cargo
    FROM public.clientes c CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c.funcionarios, '[]'::jsonb)) f(item)
    WHERE c.empresa_id = v_empresa_id AND (p_cliente_id IS NULL OR c.id = p_cliente_id)
  ), docs AS (
    SELECT count(*) FILTER (WHERE COALESCE(d.item->>'status', '') = 'Pendente') pendentes
    FROM pessoas p CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.item->'documentosAdmissao', '[]'::jsonb)) d(item)
  ), totais AS (
    SELECT count(*) total, count(*) FILTER (WHERE ativo) ativos,
      COALESCE(sum(salario) FILTER (WHERE ativo), 0) folha,
      COALESCE(avg(salario) FILTER (WHERE ativo), 0) media FROM pessoas
  ), cargos AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('cargo', cargo, 'count', quantidade) ORDER BY quantidade DESC), '[]'::jsonb) data
    FROM (SELECT cargo, count(*) quantidade FROM pessoas WHERE ativo GROUP BY cargo ORDER BY quantidade DESC LIMIT 5) c
  )
  SELECT jsonb_build_object('totalFuncionarios', t.total, 'funcionariosAtivos', t.ativos,
    'custoFolhaMensal', t.folha, 'mediaSalarial', t.media,
    'documentosPendentes', COALESCE((SELECT pendentes FROM docs), 0), 'distribuicaoCargos', (SELECT data FROM cargos))
  INTO v_result FROM totais t;
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.calcular_comparativo_regimes_json(p_faturamento_anual numeric, p_custo_folha_anual numeric)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_empresa_id uuid := public.current_empresa_id(); v_fat numeric := GREATEST(COALESCE(p_faturamento_anual, 0), 0);
  v_folha numeric := GREATEST(COALESCE(p_custo_folha_anual, 0), 0); v_simples numeric; v_presumido numeric; v_real numeric; v_menor numeric;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa vinculada.'; END IF;
  v_simples := v_fat * 0.10; v_presumido := v_fat * 0.1345 + v_folha * 0.20; v_real := v_fat * 0.1935 + v_folha * 0.20;
  v_menor := LEAST(v_simples, v_presumido, v_real);
  RETURN jsonb_build_array(
    jsonb_build_object('regime','Simples Nacional','aliquotaEfetiva',CASE WHEN v_fat > 0 THEN v_simples/v_fat*100 ELSE 0 END,'impostoTotal',v_fat*0.10,'custoPrevidenciario',0,'custoTotal',v_simples,'recomendado',v_simples=v_menor),
    jsonb_build_object('regime','Lucro Presumido','aliquotaEfetiva',CASE WHEN v_fat > 0 THEN v_presumido/v_fat*100 ELSE 0 END,'impostoTotal',v_fat*0.1345,'custoPrevidenciario',v_folha*0.20,'custoTotal',v_presumido,'recomendado',v_presumido=v_menor),
    jsonb_build_object('regime','Lucro Real','aliquotaEfetiva',CASE WHEN v_fat > 0 THEN v_real/v_fat*100 ELSE 0 END,'impostoTotal',v_fat*0.1935,'custoPrevidenciario',v_folha*0.20,'custoTotal',v_real,'recomendado',v_real=v_menor));
END; $$;

REVOKE ALL ON FUNCTION public.get_relatorio_faturamento_json(uuid, date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_relatorio_conformidade_json(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_relatorio_pessoal_json(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calcular_comparativo_regimes_json(numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_relatorio_faturamento_json(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_relatorio_conformidade_json(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_relatorio_pessoal_json(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calcular_comparativo_regimes_json(numeric, numeric) TO authenticated;
