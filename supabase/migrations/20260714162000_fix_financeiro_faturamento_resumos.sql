-- Corrige o contrato dos resumos financeiro/faturamento e inclui lançamentos avulsos.
-- Cobranças liquidadas geram lançamentos com origem = 'cobranca'; esses lançamentos
-- são excluídos das somas avulsas para evitar dupla contagem.

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
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa vinculada.';
  END IF;

  WITH lancamentos AS (
    SELECT *
    FROM public.financeiro_lancamentos
    WHERE empresa_id = v_empresa_id AND status <> 'Cancelado'
  ),
  recebimentos_cobrancas AS (
    SELECT * FROM lancamentos WHERE origem = 'cobranca' AND tipo = 'receita' AND status = 'Pago'
  ),
  cobrancas_base AS (
    SELECT c.*, COALESCE(r.valor_recebido, 0) AS recebimento_registrado
    FROM public.financeiro_cobrancas c
    LEFT JOIN (
      SELECT referencia_id, sum(valor) AS valor_recebido
      FROM recebimentos_cobrancas GROUP BY referencia_id
    ) r ON r.referencia_id = c.id
    WHERE c.empresa_id = v_empresa_id AND c.status <> 'Cancelado'
  ),
  cobrancas AS (
    SELECT c.*,
      CASE WHEN c.status = 'Pago' THEN GREATEST(c.valor, c.recebimento_registrado)
        ELSE c.valor + c.recebimento_registrado END AS valor_faturado,
      CASE WHEN c.recebimento_registrado > 0 THEN c.recebimento_registrado
        WHEN c.status = 'Pago' THEN c.valor ELSE 0 END AS valor_recebido
    FROM cobrancas_base c
  ),
  lancamentos_avulsos AS (
    SELECT * FROM lancamentos WHERE origem <> 'cobranca'
  ),
  totais AS (
    SELECT
      COALESCE((SELECT sum(saldo_atual) FROM public.configuracoes_contas_bancarias WHERE empresa_id = v_empresa_id), 0) AS saldo_disponivel,
      COALESCE((SELECT sum(valor) FROM cobrancas WHERE status IN ('Pendente', 'Vencido')), 0)
        + COALESCE((SELECT sum(valor) FROM lancamentos_avulsos WHERE tipo = 'receita' AND status = 'Pendente'), 0) AS contas_receber,
      COALESCE((SELECT sum(valor) FROM lancamentos WHERE tipo = 'despesa' AND status = 'Pendente'), 0) AS contas_pagar,
      COALESCE((SELECT sum(valor_recebido) FROM cobrancas), 0)
        + COALESCE((SELECT sum(valor) FROM lancamentos_avulsos WHERE tipo = 'receita' AND status = 'Pago'), 0) AS receitas_recebidas,
      COALESCE((SELECT sum(valor) FROM lancamentos WHERE tipo = 'despesa' AND status = 'Pago'), 0) AS despesas_pagas,
      COALESCE((SELECT sum(valor) FROM cobrancas WHERE status = 'Vencido'), 0)
        + COALESCE((SELECT sum(valor) FROM lancamentos_avulsos WHERE tipo = 'receita' AND status = 'Pendente' AND data_competencia < CURRENT_DATE), 0) AS vencido,
      COALESCE((SELECT sum(valor_faturado) FROM cobrancas), 0)
        + COALESCE((SELECT sum(valor) FROM lancamentos_avulsos WHERE tipo = 'receita'), 0) AS total_faturado
  ),
  periodos AS (
    SELECT (date_trunc('month', CURRENT_DATE) - (n || ' months')::interval)::date AS mes
    FROM generate_series(LEAST(GREATEST(COALESCE(p_meses, 6), 1), 24) - 1, 0, -1) AS n
  ),
  desempenho AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'name', initcap(to_char(p.mes, 'TMMon')),
      'receita', COALESCE((SELECT sum(valor_faturado) FROM cobrancas c WHERE date_trunc('month', c.data_vencimento)::date = p.mes), 0)
        + COALESCE((SELECT sum(valor) FROM lancamentos_avulsos l WHERE l.tipo = 'receita' AND date_trunc('month', l.data_competencia)::date = p.mes), 0),
      'despesas', COALESCE((SELECT sum(valor) FROM lancamentos l WHERE l.tipo = 'despesa' AND date_trunc('month', l.data_competencia)::date = p.mes), 0),
      'lucro', COALESCE((SELECT sum(valor) FROM recebimentos_cobrancas r WHERE date_trunc('month', COALESCE(r.data_pagamento, r.data_competencia))::date = p.mes), 0)
        + COALESCE((SELECT sum(valor) FROM cobrancas c WHERE c.status = 'Pago' AND c.recebimento_registrado = 0 AND date_trunc('month', COALESCE(c.data_pagamento::date, c.data_vencimento))::date = p.mes), 0)
        + COALESCE((SELECT sum(valor) FROM lancamentos_avulsos l WHERE l.tipo = 'receita' AND l.status = 'Pago' AND date_trunc('month', COALESCE(l.data_pagamento, l.data_competencia))::date = p.mes), 0)
        - COALESCE((SELECT sum(valor) FROM lancamentos l WHERE l.tipo = 'despesa' AND l.status = 'Pago' AND date_trunc('month', COALESCE(l.data_pagamento, l.data_competencia))::date = p.mes), 0)
    ) ORDER BY p.mes), '[]'::jsonb) AS data
    FROM periodos p
  ),
  contas AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'banco', banco, 'agencia', agencia, 'conta', numero_conta, 'saldo', saldo_atual) ORDER BY saldo_atual DESC), '[]'::jsonb) AS data
    FROM public.configuracoes_contas_bancarias WHERE empresa_id = v_empresa_id
  ),
  parceiros AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', p.cliente_empresa_id, 'nome', COALESCE(cl.nome, 'Sem cliente vinculado'), 'valor', p.valor_total, 'percentual', CASE WHEN p.total_geral > 0 THEN round((p.valor_total / p.total_geral) * 100, 1) ELSE 0 END) ORDER BY p.valor_total DESC), '[]'::jsonb) AS data
    FROM (
      SELECT cliente_empresa_id, sum(valor) AS valor_total, sum(sum(valor)) OVER () AS total_geral
      FROM (
        SELECT cliente_empresa_id, valor FROM recebimentos_cobrancas
        UNION ALL
        SELECT cliente_empresa_id, valor FROM cobrancas WHERE status = 'Pago' AND recebimento_registrado = 0
        UNION ALL
        SELECT cliente_empresa_id, valor FROM lancamentos_avulsos WHERE tipo = 'receita' AND status = 'Pago'
      ) receitas
      GROUP BY cliente_empresa_id ORDER BY valor_total DESC LIMIT 5
    ) p LEFT JOIN public.clientes cl ON cl.id = p.cliente_empresa_id AND cl.empresa_id = v_empresa_id
  ),
  categorias AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', categoria, 'nome', categoria, 'valor', valor_total, 'percentual', CASE WHEN total_geral > 0 THEN round((valor_total / total_geral) * 100, 1) ELSE 0 END) ORDER BY valor_total DESC), '[]'::jsonb) AS data
    FROM (
      SELECT categoria, sum(valor) AS valor_total, sum(sum(valor)) OVER () AS total_geral
      FROM lancamentos WHERE tipo = 'despesa' GROUP BY categoria ORDER BY valor_total DESC LIMIT 6
    ) despesas
  )
  SELECT jsonb_build_object(
    'totalFaturado', t.total_faturado,
    'totalRecebido', t.receitas_recebidas,
    'totalPendente', t.contas_receber,
    'taxaInadimplencia', CASE WHEN t.receitas_recebidas + t.vencido > 0 THEN round((t.vencido / (t.receitas_recebidas + t.vencido)) * 100, 1) ELSE 0 END,
    'patrimonioLiquido', t.saldo_disponivel,
    'saldoDisponivel', t.saldo_disponivel,
    'contasReceber', t.contas_receber,
    'contasPagar', t.contas_pagar,
    'lucroMes', COALESCE(((SELECT data FROM desempenho)->-1->>'lucro')::numeric, 0),
    'receitasRecebidas', t.receitas_recebidas,
    'despesasPagas', t.despesas_pagas,
    'desempenho', (SELECT data FROM desempenho),
    'contas', (SELECT data FROM contas),
    'receitasPorParceiro', (SELECT data FROM parceiros),
    'despesasPorCategoria', (SELECT data FROM categorias)
  ) INTO v_result FROM totais t;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_faturamento_dashboard(
  p_data_inicial date DEFAULT date_trunc('month', CURRENT_DATE)::date,
  p_data_final date DEFAULT (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date,
  p_cliente_empresa_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL
)
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
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa vinculada.';
  END IF;
  IF p_data_inicial IS NULL OR p_data_final IS NULL OR p_data_inicial > p_data_final THEN
    RAISE EXCEPTION 'Período inválido.';
  END IF;

  WITH cobrancas_filtradas AS (
    SELECT * FROM public.financeiro_cobrancas c
    WHERE c.empresa_id = v_empresa_id
      AND c.data_vencimento BETWEEN p_data_inicial AND p_data_final
      AND (p_cliente_empresa_id IS NULL OR c.cliente_empresa_id = p_cliente_empresa_id)
      AND (p_status IS NULL OR p_status = 'Todos' OR c.status = p_status)
  ),
  recebimentos AS (
    SELECT l.referencia_id, sum(l.valor) AS valor_recebido
    FROM public.financeiro_lancamentos l
    JOIN cobrancas_filtradas c ON c.id = l.referencia_id
    WHERE l.empresa_id = v_empresa_id AND l.origem = 'cobranca'
      AND l.tipo = 'receita' AND l.status = 'Pago'
    GROUP BY l.referencia_id
  ),
  cobrancas AS (
    SELECT c.*,
      COALESCE(r.valor_recebido, 0) AS recebimento_registrado,
      CASE WHEN c.status = 'Pago' THEN GREATEST(c.valor, COALESCE(r.valor_recebido, 0))
        ELSE c.valor + COALESCE(r.valor_recebido, 0) END AS valor_faturado,
      CASE WHEN COALESCE(r.valor_recebido, 0) > 0 THEN r.valor_recebido
        WHEN c.status = 'Pago' THEN c.valor ELSE 0 END AS valor_recebido
    FROM cobrancas_filtradas c LEFT JOIN recebimentos r ON r.referencia_id = c.id
  ),
  nfse_aptas AS (
    SELECT c.id FROM cobrancas c
    JOIN public.clientes cl ON cl.id = c.cliente_empresa_id AND cl.empresa_id = v_empresa_id
    WHERE EXISTS (
      SELECT 1 FROM public.configuracoes_integracao_fiscal cf
      WHERE cf.empresa_id = v_empresa_id AND cf.ativo
        AND (cf.cliente_id = cl.id OR cf.cliente_id IS NULL)
        AND upper(cf.uf) = upper(COALESCE(cl.uf, ''))
        AND lower(trim(cf.municipio)) = lower(trim(COALESCE(cl.cidade, '')))
    )
  ),
  avulsos AS (
    SELECT * FROM public.financeiro_lancamentos l
    WHERE l.empresa_id = v_empresa_id
      AND l.tipo = 'receita' AND l.origem <> 'cobranca'
      AND l.data_competencia BETWEEN p_data_inicial AND p_data_final
      AND (p_cliente_empresa_id IS NULL OR l.cliente_empresa_id = p_cliente_empresa_id)
      AND (
        p_status IS NULL OR p_status = 'Todos'
        OR (p_status = 'Pago' AND l.status = 'Pago')
        OR (p_status = 'Cancelado' AND l.status = 'Cancelado')
        OR (p_status = 'Pendente' AND l.status = 'Pendente' AND l.data_competencia >= CURRENT_DATE)
        OR (p_status = 'Vencido' AND l.status = 'Pendente' AND l.data_competencia < CURRENT_DATE)
      )
  )
  SELECT jsonb_build_object(
    'nfseAEmitir', (SELECT count(*) FROM cobrancas c JOIN nfse_aptas a ON a.id = c.id WHERE c.asaas_nfse_id IS NULL AND c.status <> 'Cancelado'),
    'nfseEmitidas', (SELECT count(*) FROM cobrancas WHERE asaas_nfse_id IS NOT NULL AND status <> 'Cancelado'),
    'nfseCanceladas', (SELECT count(*) FROM cobrancas WHERE status = 'Cancelado' AND asaas_nfse_id IS NOT NULL),
    'cobrancasGeradas', (SELECT count(*) FROM cobrancas),
    'contasReceber', (SELECT count(*) FROM cobrancas WHERE status IN ('Pendente', 'Vencido')) + (SELECT count(*) FROM avulsos WHERE status = 'Pendente'),
    'totalPrevisto', COALESCE((SELECT sum(valor_faturado) FROM cobrancas WHERE status <> 'Cancelado'), 0) + COALESCE((SELECT sum(valor) FROM avulsos WHERE status <> 'Cancelado'), 0),
    'totalRecebido', COALESCE((SELECT sum(valor_recebido) FROM cobrancas), 0) + COALESCE((SELECT sum(valor) FROM avulsos WHERE status = 'Pago'), 0),
    'totalAberto', COALESCE((SELECT sum(valor) FROM cobrancas WHERE status = 'Pendente'), 0) + COALESCE((SELECT sum(valor) FROM avulsos WHERE status = 'Pendente' AND data_competencia >= CURRENT_DATE), 0),
    'totalAtraso', COALESCE((SELECT sum(valor) FROM cobrancas WHERE status = 'Vencido'), 0) + COALESCE((SELECT sum(valor) FROM avulsos WHERE status = 'Pendente' AND data_competencia < CURRENT_DATE), 0)
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_financeiro_dashboard(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_faturamento_dashboard(date, date, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_financeiro_dashboard(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_faturamento_dashboard(date, date, uuid, text) TO authenticated;
