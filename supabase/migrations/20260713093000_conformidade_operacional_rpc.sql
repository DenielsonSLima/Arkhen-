CREATE OR REPLACE FUNCTION public.get_conformidade_operacional(p_cliente_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_result jsonb;
BEGIN
  v_empresa_id := public.current_empresa_id();

  SELECT COALESCE(jsonb_agg(item ORDER BY item->>'vencimento', item->>'clienteNome'), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id', ai.id::text,
      'tipo', 'fiscal',
      'clienteId', COALESCE(ai.cliente_id::text, ai.cliente_nome),
      'clienteNome', ai.cliente_nome,
      'cnpj', COALESCE(c.cnpj, ''),
      'competencia', ai.competencia,
      'rotina', COALESCE(am.nome, ai.modelo_codigo, 'Atividade operacional'),
      'descricao', COALESCE(am.descricao, 'Risco derivado de atividade operacional.'),
      'responsavel', 'Sem responsável',
      'vencimento', (
        date_trunc('month', to_date(ai.competencia || '-01', 'YYYY-MM-DD')) + interval '1 month - 1 day'
      )::date::text,
      'prioridade', CASE
        WHEN (
          date_trunc('month', to_date(ai.competencia || '-01', 'YYYY-MM-DD')) + interval '1 month - 1 day'
        )::date < CURRENT_DATE THEN 'vermelho'
        WHEN (
          date_trunc('month', to_date(ai.competencia || '-01', 'YYYY-MM-DD')) + interval '1 month - 1 day'
        )::date <= CURRENT_DATE + 3 THEN 'amarelo'
        ELSE 'verde'
      END,
      'status', CASE
        WHEN ai.status = 'Concluída' THEN 'Concluído'
        WHEN ai.status = 'Em andamento' THEN 'Em andamento'
        ELSE 'Pendente'
      END,
      'atrasoDias', GREATEST(
        0,
        CURRENT_DATE - (
          date_trunc('month', to_date(ai.competencia || '-01', 'YYYY-MM-DD')) + interval '1 month - 1 day'
        )::date
      ),
      'regraContrato', jsonb_build_object(
        'prazoDias', 0,
        'impacto', CASE WHEN ai.status = 'Concluída' THEN 1 ELSE 4 END,
        'consequencia', 'Risco operacional calculado a partir das atividades do cliente.'
      ),
      'etapas', jsonb_build_array(
        jsonb_build_object('id', 'recebimento', 'label', 'Recebimento', 'concluida', COALESCE((ai.checklists->>'recebimento')::boolean, false)),
        jsonb_build_object('id', 'conferencia', 'label', 'Conferência', 'concluida', COALESCE((ai.checklists->>'conferencia')::boolean, false)),
        jsonb_build_object('id', 'apuracao', 'label', 'Apuração', 'concluida', COALESCE((ai.checklists->>'apuracao')::boolean, false)),
        jsonb_build_object('id', 'entrega', 'label', 'Entrega', 'concluida', COALESCE((ai.checklists->>'entrega')::boolean, false)),
        jsonb_build_object('id', 'fechamento', 'label', 'Fechamento', 'concluida', ai.status = 'Concluída')
      ),
      'documentosPendentes', '[]'::jsonb,
      'criadoEm', COALESCE(ai.criado_em, now())::text,
      'atualizadoEm', COALESCE(ai.atualizado_em, now())::text
    ) AS item
    FROM public.atividades_instancias ai
    LEFT JOIN public.clientes c ON c.id = ai.cliente_id
    LEFT JOIN public.atividades_modelos am ON am.id = ai.modelo_id
    WHERE ai.empresa_id = v_empresa_id
      AND COALESCE(ai.ativo, true) = true
      AND (p_cliente_id IS NULL OR ai.cliente_id = p_cliente_id)
  ) source;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_conformidade_operacional(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_conformidade_operacional(uuid) TO authenticated;
