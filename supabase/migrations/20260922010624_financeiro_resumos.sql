-- Somente leitura: usa o valor efetivamente pago preservado nos metadados.
-- Nao ajusta retroativamente saldos nem substitui principal/juros/desconto.
BEGIN;
CREATE OR REPLACE FUNCTION app_private.financeiro_valor_pago(p_valor numeric,p_status text,p_metadados jsonb)
RETURNS numeric LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT CASE WHEN p_status='Pago' AND p_metadados#>>'{pagamento_detalhes,valor_pago}' ~ '^[0-9]+([.][0-9]{1,2})?$'
      AND length(p_metadados#>>'{pagamento_detalhes,valor_pago}')<=17
    THEN (p_metadados#>>'{pagamento_detalhes,valor_pago}')::numeric ELSE p_valor END;
$$;
REVOKE ALL ON FUNCTION app_private.financeiro_valor_pago(numeric,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.financeiro_valor_pago(numeric,text,jsonb) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.get_financeiro_dashboard(p_meses integer DEFAULT 6)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY INVOKER
 SET search_path = ''
AS $function$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa vinculada.';
  END IF;

  WITH lancamentos AS (
    SELECT *, app_private.financeiro_valor_pago(valor, status, metadados) AS valor_efetivo
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
      COALESCE((SELECT sum(valor_efetivo) FROM lancamentos WHERE tipo = 'despesa' AND status = 'Pago'), 0) AS despesas_pagas,
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
      'despesas', COALESCE((SELECT sum(valor_efetivo) FROM lancamentos l WHERE l.tipo = 'despesa' AND date_trunc('month', l.data_competencia)::date = p.mes), 0),
      'lucro', COALESCE((SELECT sum(valor) FROM recebimentos_cobrancas r WHERE date_trunc('month', COALESCE(r.data_pagamento, r.data_competencia))::date = p.mes), 0)
        + COALESCE((SELECT sum(valor) FROM cobrancas c WHERE c.status = 'Pago' AND c.recebimento_registrado = 0 AND date_trunc('month', COALESCE(c.data_pagamento::date, c.data_vencimento))::date = p.mes), 0)
        + COALESCE((SELECT sum(valor) FROM lancamentos_avulsos l WHERE l.tipo = 'receita' AND l.status = 'Pago' AND date_trunc('month', COALESCE(l.data_pagamento, l.data_competencia))::date = p.mes), 0)
        - COALESCE((SELECT sum(valor_efetivo) FROM lancamentos l WHERE l.tipo = 'despesa' AND l.status = 'Pago' AND date_trunc('month', COALESCE(l.data_pagamento, l.data_competencia))::date = p.mes), 0)
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
      SELECT categoria, sum(valor_efetivo) AS valor_total, sum(sum(valor_efetivo)) OVER () AS total_geral
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
    'despesasPorCategoria', (SELECT data FROM categorias),
    'entradasRecentes', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.data DESC,r.id), '[]'::jsonb) FROM (
      SELECT id,coalesce(data_pagamento,data_competencia) AS data,descricao,valor_efetivo AS valor FROM lancamentos
      WHERE status='Pago' AND tipo IN ('receita','transferencia_entrada')
      ORDER BY coalesce(data_pagamento,data_competencia) DESC,id LIMIT 5) r),
    'saidasRecentes', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.data DESC,r.id), '[]'::jsonb) FROM (
      SELECT id,coalesce(data_pagamento,data_competencia) AS data,descricao,valor_efetivo AS valor FROM lancamentos
      WHERE status='Pago' AND tipo IN ('despesa','transferencia_saida')
      ORDER BY coalesce(data_pagamento,data_competencia) DESC,id LIMIT 5) r)
  ) INTO v_result FROM totais t;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_contas_pagar_resumo()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE t uuid:=public.current_empresa_id(); hoje date:=(now() AT TIME ZONE 'America/Maceio')::date; result jsonb;
BEGIN
  IF auth.uid() IS NULL OR t IS NULL THEN RAISE EXCEPTION 'Usuario sem empresa vinculada.' USING ERRCODE='42501'; END IF;
  WITH base AS (SELECT *,app_private.financeiro_valor_pago(valor,status,metadados) AS pago FROM public.financeiro_lancamentos
    WHERE empresa_id=t AND tipo='despesa' AND origem='conta_pagar')
  SELECT jsonb_build_object(
    'pagarHojeVal',coalesce(sum(valor) FILTER(WHERE status='Pendente' AND data_competencia=hoje),0),
    'pagarHojeQty',count(*) FILTER(WHERE status='Pendente' AND data_competencia=hoje),
    'emAtrasoVal',coalesce(sum(valor) FILTER(WHERE status='Pendente' AND data_competencia<hoje),0),
    'emAtrasoQty',count(*) FILTER(WHERE status='Pendente' AND data_competencia<hoje),
    'pagoNoMesVal',coalesce(sum(pago) FILTER(WHERE status='Pago' AND date_trunc('month',data_pagamento)=date_trunc('month',hoje)),0),
    'pagoNoMesQty',count(*) FILTER(WHERE status='Pago' AND date_trunc('month',data_pagamento)=date_trunc('month',hoje)),
    'previstoNoMesVal',coalesce(sum(valor) FILTER(WHERE status<>'Cancelado' AND date_trunc('month',data_competencia)=date_trunc('month',hoje)),0),
    'previstoNoMesQty',count(*) FILTER(WHERE status<>'Cancelado' AND date_trunc('month',data_competencia)=date_trunc('month',hoje)),
    'pendenteVal',coalesce(sum(valor) FILTER(WHERE status='Pendente'),0),'pendenteQty',count(*) FILTER(WHERE status='Pendente'))
  INTO result FROM base;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_contas_pagar_resumo() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_contas_pagar_resumo() TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.get_financeiro_dashboard(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_financeiro_dashboard(integer) TO authenticated,service_role;
COMMIT;
