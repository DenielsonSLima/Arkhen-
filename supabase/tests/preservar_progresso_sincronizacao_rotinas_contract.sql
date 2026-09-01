-- Execute após 20260901164502_preservar_progresso_sincronizacao_rotinas.
-- Exercita uma ocorrência real dentro de transação e desfaz toda alteração.

BEGIN;

DO $$
DECLARE
  v_trigger_def text;
  v_horizonte_def text;
  v_rotina_id uuid;
  v_tarefa_id uuid;
  v_status text;
  v_checklist jsonb := jsonb_build_array(
    jsonb_build_object('titulo', 'Etapa preservada', 'concluida', true),
    jsonb_build_object('titulo', 'Etapa pendente', 'concluida', false)
  );
  v_data_ancora date;
  v_proxima_base date;
  v_proxima date;
  v_ativas integer;
  v_arquivamentos integer;
BEGIN
  SELECT pg_get_functiondef(
    'app_private.sincronizar_fila_rotina_trigger()'::regprocedure
  ) INTO v_trigger_def;
  SELECT pg_get_functiondef(
    'app_private.preservar_horizonte_rotina_aberta_trigger()'::regprocedure
  ) INTO v_horizonte_def;

  IF v_trigger_def LIKE '%NEW.modelo_id IS DISTINCT FROM OLD.modelo_id%'
     OR v_trigger_def NOT LIKE '%app.obrigacao_preservar_ocorrencias%'
     OR v_trigger_def NOT LIKE '%NEW.protocolo_codigo IS NOT NULL%'
     OR v_trigger_def NOT LIKE
       '%v_preservar_ocorrencias := v_preservar_ocorrencias OR (%'
     OR v_trigger_def NOT LIKE '%tarefa.checklist%'
     OR v_trigger_def NOT LIKE '%v_tem_ocorrencia_ativa%' THEN
    RAISE EXCEPTION 'Trigger da fila não preserva a ocorrência protocolizada.';
  END IF;

  IF v_horizonte_def NOT LIKE '%NEW.proxima_execucao_base := OLD.proxima_execucao_base%'
     OR v_horizonte_def NOT LIKE '%NEW.proxima_execucao := OLD.proxima_execucao%'
     OR v_horizonte_def NOT LIKE '%NEW.data_ancora IS DISTINCT FROM OLD.data_ancora%'
     OR v_horizonte_def NOT LIKE '%status NOT IN (''Concluída'', ''Cancelada'')%' THEN
    RAISE EXCEPTION 'Trigger de horizonte não protege a próxima ocorrência.';
  END IF;

  IF NOT EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE tgrelid = 'public.atividades_rotinas'::regclass
         AND tgname = 'zz_preservar_horizonte_rotina_aberta'
         AND tgenabled <> 'D'
     ) OR NOT EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE tgrelid = 'public.atividades_rotinas'::regclass
         AND tgname = 'sincronizar_fila_rotina'
         AND tgenabled <> 'D'
     ) OR has_function_privilege(
       'authenticated',
       'app_private.preservar_horizonte_rotina_aberta_trigger()',
       'EXECUTE'
     ) OR has_function_privilege(
       'authenticated',
       'app_private.sincronizar_fila_rotina_trigger()',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Trigger corretivo ausente, desabilitado ou exposto.';
  END IF;

  SELECT rotina.id, tarefa.id, tarefa.status,
         rotina.data_ancora, rotina.proxima_execucao_base,
         rotina.proxima_execucao
  INTO v_rotina_id, v_tarefa_id, v_status,
       v_data_ancora, v_proxima_base, v_proxima
  FROM public.atividades_tarefas tarefa
  JOIN public.atividades_rotinas rotina
    ON rotina.id = tarefa.rotina_id
   AND rotina.empresa_id = tarefa.empresa_id
  WHERE tarefa.ativo = true
    AND tarefa.status NOT IN ('Concluída', 'Cancelada')
    AND rotina.protocolo_codigo IS NOT NULL
    AND rotina.ativa = true
    AND rotina.data_ancora IS NOT NULL
    AND rotina.proxima_execucao_base IS NOT NULL
    AND rotina.proxima_execucao IS NOT NULL
  ORDER BY tarefa.criado_em, tarefa.id
  LIMIT 1
  FOR UPDATE OF tarefa, rotina;

  -- Ambientes sem dados operacionais ainda validam integralmente a estrutura.
  -- Quando há uma ocorrência, o bloco abaixo prova o comportamento de ponta a
  -- ponta sem manter nenhuma mutação por causa do ROLLBACK final.
  IF v_tarefa_id IS NOT NULL THEN
    UPDATE public.atividades_tarefas
    SET checklist = v_checklist,
        status = 'Em andamento'
    WHERE id = v_tarefa_id;

    SELECT count(*) INTO v_ativas
    FROM public.atividades_tarefas tarefa
    WHERE tarefa.rotina_id = v_rotina_id
      AND tarefa.ativo = true;

    SELECT count(*) INTO v_arquivamentos
    FROM public.atividades_tarefa_eventos evento
    WHERE evento.tarefa_id = v_tarefa_id
      AND evento.tipo = 'arquivada';

    -- Reproduz o gatilho original: a agenda canônica muda enquanto o checklist
    -- tem progresso. A mesma tarefa deve sobreviver, sem uma substituta.
    UPDATE public.atividades_rotinas
    SET data_ancora = data_ancora - 1,
        atualizado_em = now()
    WHERE id = v_rotina_id;

    IF NOT EXISTS (
      SELECT 1 FROM public.atividades_tarefas tarefa
      WHERE tarefa.id = v_tarefa_id
        AND tarefa.ativo = true
        AND tarefa.status = 'Em andamento'
        AND tarefa.checklist = v_checklist
    ) THEN
      RAISE EXCEPTION 'A sincronização alterou ID, status ou checklist em andamento.';
    END IF;

    IF (SELECT count(*) FROM public.atividades_tarefas tarefa
        WHERE tarefa.rotina_id = v_rotina_id AND tarefa.ativo = true) <> v_ativas THEN
      RAISE EXCEPTION 'A sincronização criou uma ocorrência substituta.';
    END IF;

    IF (SELECT count(*) FROM public.atividades_tarefa_eventos evento
        WHERE evento.tarefa_id = v_tarefa_id AND evento.tipo = 'arquivada')
       <> v_arquivamentos THEN
      RAISE EXCEPTION 'A sincronização registrou arquivamento indevido.';
    END IF;

    IF (SELECT rotina.proxima_execucao_base FROM public.atividades_rotinas rotina
        WHERE rotina.id = v_rotina_id) IS DISTINCT FROM v_proxima_base
       OR (SELECT rotina.proxima_execucao FROM public.atividades_rotinas rotina
           WHERE rotina.id = v_rotina_id) IS DISTINCT FROM v_proxima THEN
      RAISE EXCEPTION 'A sincronização voltou o horizonte para a tarefa aberta.';
    END IF;

    -- O cron/materializador altera apenas o horizonte. Esse avanço não pode
    -- ser bloqueado pelo trigger corretivo, senão a ocorrência se repetiria.
    UPDATE public.atividades_rotinas
    SET proxima_execucao_base = v_proxima_base + 1,
        proxima_execucao = v_proxima + 1,
        atualizado_em = now()
    WHERE id = v_rotina_id;

    IF (SELECT rotina.proxima_execucao_base FROM public.atividades_rotinas rotina
        WHERE rotina.id = v_rotina_id) IS DISTINCT FROM v_proxima_base + 1
       OR (SELECT rotina.proxima_execucao FROM public.atividades_rotinas rotina
           WHERE rotina.id = v_rotina_id) IS DISTINCT FROM v_proxima + 1 THEN
      RAISE EXCEPTION 'O trigger bloqueou o avanço normal do materializador.';
    END IF;

    -- Garante que o caminho realmente alterou a definição de agenda.
    IF (SELECT rotina.data_ancora FROM public.atividades_rotinas rotina
        WHERE rotina.id = v_rotina_id) IS NOT DISTINCT FROM v_data_ancora THEN
      RAISE EXCEPTION 'O teste não exercitou uma alteração real de agenda.';
    END IF;
  END IF;
END;
$$;

ROLLBACK;
