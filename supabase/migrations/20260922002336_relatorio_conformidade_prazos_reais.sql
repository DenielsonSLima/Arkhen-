BEGIN;
CREATE SCHEMA IF NOT EXISTS app_private;
-- Historical instances contain no proven delivery timestamp or deadline.
-- Preserve their counts, but never infer timely delivery from updated_at.
CREATE OR REPLACE FUNCTION app_private.relatorio_conformidade_prazos(p_cliente_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_empresa uuid := public.current_empresa_id();
  v_hoje date := (current_timestamp AT TIME ZONE 'America/Sao_Paulo')::date;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL
    OR NOT coalesce(public.current_user_access_allowed(v_empresa), false) THEN
    RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE = '42501';
  END IF;
  IF p_cliente_id IS NOT NULL AND NOT coalesce(
    public.current_user_can_access_client_row(v_empresa, p_cliente_id), false) THEN
    RAISE EXCEPTION 'Cliente não autorizado.' USING ERRCODE = '42501';
  END IF;
  WITH base AS (
    SELECT t.status, coalesce(m.nome, t.titulo, 'Obrigação') AS nome,
      coalesce(t.prazo_legal, t.prazo_interno) AS prazo,
      (coalesce(t.concluido_em, t.data_hora_conclusao) AT TIME ZONE 'America/Sao_Paulo')::date AS entrega
    FROM public.atividades_tarefas t
    LEFT JOIN public.atividades_modelos m ON m.id=t.modelo_id AND m.empresa_id=t.empresa_id
    WHERE t.empresa_id=v_empresa AND t.ativo AND t.status <> 'Cancelada'
      AND t.modelo_id IS NOT NULL AND t.cliente_id IS NOT NULL
      AND (p_cliente_id IS NULL OR t.cliente_id=p_cliente_id)
      AND public.current_user_can_access_client_row(v_empresa,t.cliente_id)
      AND (
        public.current_user_has_permission(v_empresa,'atividades:manage')
        OR ((public.current_user_has_permission(v_empresa,'atividades:view')
          OR public.current_user_has_permission(v_empresa,'atividades:update-own'))
          AND (t.responsavel_user_id=auth.uid() OR t.revisor_user_id=auth.uid()))
        OR (public.current_user_has_permission(v_empresa,'atividades:view-own')
          AND public.current_user_has_client_access(v_empresa,t.cliente_id))
      )
    UNION ALL
    SELECT i.status, coalesce(m.nome,i.modelo_codigo,'Obrigação'), NULL::date, NULL::date
    FROM public.atividades_instancias i
    LEFT JOIN public.atividades_modelos m ON m.id=i.modelo_id AND m.empresa_id=i.empresa_id
    WHERE i.empresa_id=v_empresa AND i.ativo AND i.status <> 'Cancelada'
      AND i.cliente_id IS NOT NULL
      AND (p_cliente_id IS NULL OR i.cliente_id=p_cliente_id)
      AND public.current_user_can_access_client_row(v_empresa,i.cliente_id)
      AND public.current_user_has_permission(v_empresa,'atividades:manage')
      AND NOT EXISTS (SELECT 1 FROM public.atividades_tarefas t
        WHERE t.empresa_id=i.empresa_id AND t.ativo
          AND t.cliente_id=i.cliente_id AND t.modelo_id=i.modelo_id
          AND t.competencia=i.competencia)
  ), totais AS (
    SELECT count(*) AS total,
      count(*) FILTER (WHERE status='Concluída') AS concluidas,
      count(*) FILTER (WHERE status<>'Concluída' AND (prazo IS NULL OR prazo>=v_hoje)) AS pendentes,
      count(*) FILTER (WHERE status<>'Concluída' AND prazo<v_hoje) AS atrasadas,
      count(*) FILTER (WHERE status='Concluída' AND entrega<=prazo) AS no_prazo,
      count(*) FILTER (WHERE status='Concluída' AND (entrega IS NULL OR prazo IS NULL)) AS sem_evidencia
    FROM base
  ), distribuicao AS (
    SELECT nome,count(*) AS total,count(*) FILTER (WHERE status='Concluída') AS concluidas
    FROM base GROUP BY nome
  )
  SELECT jsonb_build_object('totalObrigacoes',total,'concluidas',concluidas,
    'pendentes',pendentes,'atrasadas',atrasadas,'entregasNoPrazo',no_prazo,
    'entregasSemEvidenciaPrazo',sem_evidencia,
    'taxaConformidade',coalesce(round(100.0*no_prazo/nullif(concluidas,0),2),0),
    'distribuicaoObrigacoes',(SELECT coalesce(jsonb_agg(jsonb_build_object(
      'nome',d.nome,'total',d.total,'concluidas',d.concluidas,
      'percentualConcluido',coalesce(round(100.0*d.concluidas/nullif(d.total,0),2),0)
    ) ORDER BY d.total DESC,d.nome),'[]'::jsonb) FROM distribuicao d))
  INTO v_result FROM totais;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION app_private.relatorio_conformidade_prazos(uuid) FROM PUBLIC,anon,service_role;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.relatorio_conformidade_prazos(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_relatorio_conformidade_json(p_cliente_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT app_private.relatorio_conformidade_prazos(p_cliente_id);
$$;
REVOKE ALL ON FUNCTION public.get_relatorio_conformidade_json(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.get_relatorio_conformidade_json(uuid) TO authenticated;
COMMIT;
