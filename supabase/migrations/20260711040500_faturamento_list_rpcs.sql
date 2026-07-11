-- Listagens de faturamento consumidas pelo front sem dados mockados.

CREATE OR REPLACE FUNCTION public.get_faturamento_recorrencias()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH contratos AS (
    SELECT
      fc.id,
      COALESCE(c.nome, 'Cliente removido') AS cliente,
      fc.descricao_servico AS servico,
      fc.valor_mensal AS valor,
      fc.dia_vencimento AS dia,
      CASE WHEN fc.ativo THEN 'Ativo' ELSE 'Inativo' END AS status,
      fc.emissao_automatica_nfse AS emissao_nfse,
      true AS cobranca,
      COALESCE((
        SELECT max((CURRENT_DATE - cb.data_vencimento)::integer)
        FROM public.financeiro_cobrancas cb
        WHERE cb.contrato_id = fc.id
          AND cb.empresa_id = fc.empresa_id
          AND cb.status IN ('Pendente', 'Vencido')
          AND cb.data_vencimento < CURRENT_DATE
      ), 0) AS dias_atraso,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', cb.id,
          'data', to_char(cb.data_vencimento, 'DD/MM/YYYY'),
          'valor', cb.valor,
          'status', cb.status,
          'tipo', CASE WHEN cb.asaas_nfse_id IS NULL THEN 'Cobrança' ELSE 'NFS-e + Cobrança' END
        ) ORDER BY cb.data_vencimento DESC)
        FROM public.financeiro_cobrancas cb
        WHERE cb.contrato_id = fc.id
          AND cb.empresa_id = fc.empresa_id
      ), '[]'::jsonb) AS historico
    FROM public.financeiro_configuracoes fc
    LEFT JOIN public.clientes c ON c.id = fc.cliente_empresa_id
    WHERE fc.empresa_id = public.current_empresa_id()
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'cliente', cliente,
    'servico', servico,
    'valor', valor,
    'dia', dia::text,
    'status', status,
    'emissaoNfse', emissao_nfse,
    'cobranca', cobranca,
    'situacao', CASE WHEN dias_atraso > 0 THEN 'inadimplente' ELSE 'em_dia' END,
    'diasAtraso', dias_atraso,
    'historico', historico
  ) ORDER BY cliente), '[]'::jsonb)
  FROM contratos
$$;

CREATE OR REPLACE FUNCTION public.get_faturamento_nfse(p_status text DEFAULT 'Todas', p_search text DEFAULT '')
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH nfse AS (
    SELECT
      cb.id,
      COALESCE(NULLIF('#' || cb.asaas_nfse_id, '#'), '-') AS numero,
      COALESCE(c.nome, 'Cliente removido') AS parceiro,
      to_char(COALESCE(cb.data_pagamento::date, cb.data_vencimento), 'DD/MM/YYYY') AS emissao,
      cb.valor,
      CASE
        WHEN cb.status = 'Cancelado' THEN 'Cancelada'
        WHEN cb.asaas_nfse_id IS NOT NULL THEN 'Emitida'
        ELSE 'A Emitir'
      END AS status,
      CASE WHEN cb.contrato_id IS NULL THEN 'Manual' ELSE 'Automática' END AS tipo
    FROM public.financeiro_cobrancas cb
    LEFT JOIN public.clientes c ON c.id = cb.cliente_empresa_id
    WHERE cb.empresa_id = public.current_empresa_id()
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'numero', numero,
    'parceiro', parceiro,
    'emissao', emissao,
    'valor', valor,
    'status', status,
    'tipo', tipo
  ) ORDER BY emissao DESC), '[]'::jsonb)
  FROM nfse
  WHERE (p_status IS NULL OR p_status = '' OR p_status = 'Todas' OR status = p_status)
    AND (
      COALESCE(trim(p_search), '') = ''
      OR lower(parceiro) LIKE '%' || lower(trim(p_search)) || '%'
      OR lower(numero) LIKE '%' || lower(trim(p_search)) || '%'
    )
$$;

CREATE OR REPLACE FUNCTION public.get_faturamento_inadimplencia(p_min_dias integer DEFAULT 0, p_search text DEFAULT '')
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH atrasos AS (
    SELECT
      cb.id,
      COALESCE(c.nome, 'Cliente removido') AS parceiro,
      cb.valor,
      cb.data_vencimento AS vencimento,
      (CURRENT_DATE - cb.data_vencimento)::integer AS dias,
      COALESCE(cb.updated_at::date::text, 'Sem contato') AS ultimo_contato
    FROM public.financeiro_cobrancas cb
    LEFT JOIN public.clientes c ON c.id = cb.cliente_empresa_id
    WHERE cb.empresa_id = public.current_empresa_id()
      AND cb.status IN ('Pendente', 'Vencido')
      AND cb.data_vencimento < CURRENT_DATE
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'parceiro', parceiro,
    'valor', valor,
    'vencimento', vencimento,
    'dias', dias,
    'ultimoContato', ultimo_contato
  ) ORDER BY dias DESC), '[]'::jsonb)
  FROM atrasos
  WHERE dias >= COALESCE(p_min_dias, 0)
    AND (
      COALESCE(trim(p_search), '') = ''
      OR lower(parceiro) LIKE '%' || lower(trim(p_search)) || '%'
    )
$$;

REVOKE EXECUTE ON FUNCTION public.get_faturamento_recorrencias() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_faturamento_nfse(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_faturamento_inadimplencia(integer, text) FROM anon;

GRANT EXECUTE ON FUNCTION public.get_faturamento_recorrencias() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_faturamento_nfse(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_faturamento_inadimplencia(integer, text) TO authenticated;
