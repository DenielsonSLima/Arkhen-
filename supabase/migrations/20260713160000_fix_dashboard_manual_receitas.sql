-- Migration to fix get_financeiro_dashboard to include manual accounts receipts (tipo = 'receita')

CREATE OR REPLACE FUNCTION public.get_financeiro_dashboard(p_meses integer DEFAULT 6)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_result jsonb;
BEGIN
  IF v_empresa_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  WITH cobrancas AS (
    SELECT *
    FROM public.financeiro_cobrancas
    WHERE empresa_id = v_empresa_id
      AND status <> 'Cancelado'
  ),
  lancamentos AS (
    SELECT *
    FROM public.financeiro_lancamentos
    WHERE empresa_id = v_empresa_id
      AND status <> 'Cancelado'
  ),
  totais AS (
    SELECT
      COALESCE((SELECT sum(saldo_atual) FROM public.configuracoes_contas_bancarias WHERE empresa_id = v_empresa_id), 0) AS saldo_disponivel,
      COALESCE((SELECT sum(valor) FROM cobrancas WHERE status IN ('Pendente', 'Vencido')), 0) 
        + COALESCE((SELECT sum(valor) FROM lancamentos WHERE tipo = 'receita' AND status = 'Pendente'), 0) AS contas_receber,
      COALESCE((SELECT sum(valor) FROM lancamentos WHERE origem = 'conta_pagar' AND status = 'Pendente'), 0) AS contas_pagar,
      COALESCE((SELECT sum(valor) FROM cobrancas WHERE status = 'Pago'), 0)
        + COALESCE((SELECT sum(valor) FROM lancamentos WHERE tipo = 'receita' AND status = 'Pago'), 0) AS receitas_recebidas,
      COALESCE((SELECT sum(valor) FROM lancamentos WHERE tipo = 'despesa' AND status = 'Pago'), 0) AS despesas_pagas,
      COALESCE((SELECT sum(valor) FROM cobrancas WHERE status = 'Vencido'), 0) AS vencido
  ),
  periodos AS (
    SELECT date_trunc('month', CURRENT_DATE)::date - (n || ' months')::interval AS mes
    FROM generate_series(GREATEST(COALESCE(p_meses, 6), 1) - 1, 0, -1) AS n
  ),
  desempenho AS (
    SELECT jsonb_agg(jsonb_build_object(
      'name', initcap(to_char(p.mes, 'Mon')),
      'receita', COALESCE((SELECT sum(valor) FROM cobrancas c WHERE date_trunc('month', c.data_vencimento)::date = p.mes), 0)
               + COALESCE((SELECT sum(valor) FROM lancamentos l WHERE l.tipo = 'receita' AND date_trunc('month', l.data_competencia)::date = p.mes), 0),
      'despesas', COALESCE((SELECT sum(valor) FROM lancamentos l WHERE l.tipo = 'despesa' AND date_trunc('month', l.data_competencia)::date = p.mes), 0),
      'lucro', (COALESCE((SELECT sum(valor) FROM cobrancas c WHERE c.status = 'Pago' AND date_trunc('month', c.data_vencimento)::date = p.mes), 0)
               + COALESCE((SELECT sum(valor) FROM lancamentos l WHERE l.tipo = 'receita' AND l.status = 'Pago' AND date_trunc('month', l.data_competencia)::date = p.mes), 0))
             - COALESCE((SELECT sum(valor) FROM lancamentos l WHERE l.tipo = 'despesa' AND l.status = 'Pago' AND date_trunc('month', l.data_competencia)::date = p.mes), 0)
    )) AS data
    FROM periodos p
  ),
  contas AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'banco', banco,
      'agencia', agencia,
      'conta', numero_conta,
      'saldo', saldo_atual
    ) ORDER BY saldo_atual DESC), '[]'::jsonb) AS data
    FROM public.configuracoes_contas_bancarias
    WHERE empresa_id = v_empresa_id
  ),
  parceiros AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', cliente_empresa_id,
      'nome', COALESCE(cl.nome, 'Cliente removido'),
      'valor', valor_total,
      'percentual', CASE WHEN total_geral > 0 THEN round((valor_total / total_geral) * 100, 1) ELSE 0 END
    ) ORDER BY valor_total DESC), '[]'::jsonb) AS data
    FROM (
      SELECT cliente_empresa_id, sum(valor) AS valor_total, sum(sum(valor)) OVER () AS total_geral
      FROM (
        SELECT cliente_empresa_id, valor FROM cobrancas WHERE status = 'Pago'
        UNION ALL
        SELECT cliente_empresa_id, valor FROM lancamentos WHERE tipo = 'receita' AND status = 'Pago' AND cliente_empresa_id IS NOT NULL
      ) combined
      GROUP BY cliente_empresa_id
      LIMIT 5
    ) p
    LEFT JOIN public.clientes cl ON cl.id = p.cliente_empresa_id
  ),
  categorias AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', categoria,
      'nome', categoria,
      'valor', valor_total,
      'percentual', CASE WHEN total_geral > 0 THEN round((valor_total / total_geral) * 100, 1) ELSE 0 END
    ) ORDER BY valor_total DESC), '[]'::jsonb) AS data
    FROM (
      SELECT categoria, sum(valor) AS valor_total, sum(sum(valor)) OVER () AS total_geral
      FROM lancamentos
      WHERE tipo = 'despesa'
      GROUP BY categoria
      LIMIT 6
    ) c
  )
  SELECT jsonb_build_object(
    'totais', (SELECT row_to_json(t) FROM totais t),
    'desempenho', (SELECT data FROM desempenho),
    'contas', (SELECT data FROM contas),
    'parceiros', (SELECT data FROM parceiros),
    'categorias', (SELECT data FROM categorias)
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;
