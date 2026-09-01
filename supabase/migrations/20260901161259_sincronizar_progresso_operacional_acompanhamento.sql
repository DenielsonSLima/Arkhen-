-- Expõe progresso operacional calculado no PostgreSQL para Minha Fila e
-- Acompanhamento, sem misturar o estado do checklist com entregas legais.

CREATE OR REPLACE FUNCTION public.obter_progresso_fluxos_acompanhamento()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_hoje date := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;
  v_manage boolean;
  v_create boolean;
  v_view boolean;
  v_view_own boolean;
  v_resultado jsonb;
BEGIN
  v_manage := COALESCE(public.current_user_has_permission(
    v_empresa_id, 'protocolos:manage'
  ), false);
  v_create := COALESCE(public.current_user_has_permission(
    v_empresa_id, 'protocolos:create'
  ), false);
  v_view := COALESCE(public.current_user_has_permission(
    v_empresa_id, 'protocolos:view'
  ), false);
  v_view_own := COALESCE(public.current_user_has_permission(
    v_empresa_id, 'protocolos:view-own'
  ), false);

  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR NOT (v_manage OR v_create OR v_view OR v_view_own) THEN
    RAISE EXCEPTION 'Progresso dos protocolos não encontrado.'
      USING ERRCODE = '42501';
  END IF;

  WITH progresso_tarefa AS (
    SELECT
      tarefa.cliente_id,
      to_char(competencia.competencia_mes, 'YYYY-MM') AS competencia,
      tarefa.status = 'Concluída' AS tarefa_concluida,
      jsonb_array_length(CASE
        WHEN jsonb_typeof(tarefa.checklist) = 'array' THEN tarefa.checklist
        ELSE '[]'::jsonb
      END) AS etapas_total,
      (
        SELECT count(*)::integer
        FROM jsonb_array_elements(CASE
          WHEN jsonb_typeof(tarefa.checklist) = 'array' THEN tarefa.checklist
          ELSE '[]'::jsonb
        END) etapa(item)
        WHERE etapa.item -> 'concluida' = 'true'::jsonb
      ) AS etapas_concluidas
    FROM public.atividades_tarefas tarefa
    JOIN public.atividades_rotinas rotina
      ON rotina.id = tarefa.rotina_id
     AND rotina.empresa_id = tarefa.empresa_id
     AND rotina.protocolo_codigo IS NOT NULL
    JOIN public.parametrizacao_protocolos_tipos tipo
      ON tipo.empresa_id = tarefa.empresa_id
     AND tipo.codigo = rotina.protocolo_codigo
    JOIN public.clientes cliente
      ON cliente.id = tarefa.cliente_id
     AND cliente.empresa_id = tarefa.empresa_id
     AND cliente.status = 'Ativa'
    CROSS JOIN LATERAL (
      SELECT (
        date_trunc('month', tarefa.vencimento::timestamp)
          - CASE WHEN tipo.referencia_mes_anterior
            THEN interval '1 month' ELSE interval '0 months' END
      )::date AS competencia_mes
    ) competencia
    WHERE tarefa.empresa_id = v_empresa_id
      AND tarefa.ativo = true
      -- Espelha a janela legal do Acompanhamento: mês atual e dois anteriores.
      AND competencia.competencia_mes >= (
        date_trunc('month', v_hoje::timestamp) - interval '2 months'
      )::date
      AND competencia.competencia_mes <= date_trunc(
        'month', v_hoje::timestamp
      )::date
      AND public.current_user_can_access_client_row(
        cliente.empresa_id, cliente.id
      )
      AND (
        v_manage OR v_create OR v_view OR (
          v_view_own
          AND public.current_user_has_client_access(cliente.empresa_id, cliente.id)
        )
      )
  ), progresso_grupo AS (
    SELECT
      cliente_id,
      competencia,
      count(*)::integer AS tarefas_total,
      count(*) FILTER (WHERE tarefa_concluida)::integer AS tarefas_concluidas,
      COALESCE(sum(etapas_total), 0)::integer AS etapas_total,
      COALESCE(sum(etapas_concluidas), 0)::integer AS etapas_concluidas
    FROM progresso_tarefa
    GROUP BY cliente_id, competencia
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'clienteId', grupo.cliente_id::text,
    'competencia', grupo.competencia,
    'tarefasTotal', grupo.tarefas_total,
    'tarefasConcluidas', grupo.tarefas_concluidas,
    'etapasTotal', grupo.etapas_total,
    'etapasConcluidas', grupo.etapas_concluidas,
    'percentual', CASE
      WHEN grupo.etapas_total > 0 THEN least(100, greatest(0, round(
        grupo.etapas_concluidas::numeric * 100 / grupo.etapas_total
      )::integer))
      WHEN grupo.tarefas_total > 0 THEN round(
        grupo.tarefas_concluidas::numeric * 100 / grupo.tarefas_total
      )::integer
      ELSE 0
    END
  ) ORDER BY grupo.competencia DESC, grupo.cliente_id), '[]'::jsonb)
  INTO v_resultado
  FROM progresso_grupo grupo;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.obter_progresso_fluxos_acompanhamento()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_progresso_fluxos_acompanhamento()
  TO authenticated;

CREATE OR REPLACE FUNCTION public.obter_progresso_tarefas_operacionais()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_resultado jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Progresso das tarefas não encontrado.'
      USING ERRCODE = '42501';
  END IF;

  WITH progresso AS (
    SELECT
      tarefa.id,
      tarefa.status,
      jsonb_array_length(CASE
        WHEN jsonb_typeof(tarefa.checklist) = 'array' THEN tarefa.checklist
        ELSE '[]'::jsonb
      END) AS etapas_total,
      (
        SELECT count(*)::integer
        FROM jsonb_array_elements(CASE
          WHEN jsonb_typeof(tarefa.checklist) = 'array' THEN tarefa.checklist
          ELSE '[]'::jsonb
        END) etapa(item)
        WHERE etapa.item -> 'concluida' = 'true'::jsonb
      ) AS etapas_concluidas
    FROM public.atividades_tarefas tarefa
    WHERE tarefa.empresa_id = v_empresa_id
      AND tarefa.ativo = true
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'tarefaId', progresso.id::text,
    'etapasTotal', progresso.etapas_total,
    'etapasConcluidas', progresso.etapas_concluidas,
    'percentual', CASE
      WHEN progresso.etapas_total > 0 THEN least(100, greatest(0, round(
        progresso.etapas_concluidas::numeric * 100 / progresso.etapas_total
      )::integer))
      WHEN progresso.status = 'Concluída' THEN 100
      ELSE 0
    END
  ) ORDER BY progresso.id), '[]'::jsonb)
  INTO v_resultado
  FROM progresso;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.obter_progresso_tarefas_operacionais()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_progresso_tarefas_operacionais()
  TO authenticated;

COMMENT ON FUNCTION public.obter_progresso_fluxos_acompanhamento() IS
  'Agrupa o checklist operacional por cliente e competência legal da obrigação.';
COMMENT ON FUNCTION public.obter_progresso_tarefas_operacionais() IS
  'Calcula no PostgreSQL o progresso das tarefas ativas visíveis pela RLS.';
