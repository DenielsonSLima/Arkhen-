-- Corrige instalações nas quais o backfill de agenda já foi executado. Uma
-- rotina protocolizada pode receber uma nova definição canônica, mas a
-- ocorrência operacional aberta continua sendo a mesma unidade auditável.

CREATE OR REPLACE FUNCTION app_private.preservar_horizonte_rotina_aberta_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.protocolo_codigo IS NOT NULL
     AND (
       NEW.frequencia IS DISTINCT FROM OLD.frequencia
       OR NEW.intervalo_dias IS DISTINCT FROM OLD.intervalo_dias
       OR NEW.data_ancora IS DISTINCT FROM OLD.data_ancora
       OR NEW.dia_mes IS DISTINCT FROM OLD.dia_mes
       OR NEW.dia_semana_iso IS DISTINCT FROM OLD.dia_semana_iso
       OR NEW.incluir_finais_de_semana
         IS DISTINCT FROM OLD.incluir_finais_de_semana
     )
     AND EXISTS (
       SELECT 1
       FROM public.atividades_tarefas tarefa
       WHERE tarefa.empresa_id = OLD.empresa_id
         AND tarefa.rotina_id = OLD.id
         AND tarefa.ativo = true
         AND tarefa.status NOT IN ('Concluída', 'Cancelada')
     ) THEN
    -- A nova cadência passa a valer ao avançar a ocorrência seguinte. Updates
    -- que apenas avançam o horizonte (materializador/cron) seguem normalmente.
    NEW.proxima_execucao_base := OLD.proxima_execucao_base;
    NEW.proxima_execucao := OLD.proxima_execucao;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.preservar_horizonte_rotina_aberta_trigger()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS zz_preservar_horizonte_rotina_aberta
  ON public.atividades_rotinas;
CREATE TRIGGER zz_preservar_horizonte_rotina_aberta
  BEFORE UPDATE OF
    frequencia,
    intervalo_dias,
    proxima_execucao,
    data_ancora,
    proxima_execucao_base,
    dia_mes,
    dia_semana_iso,
    incluir_finais_de_semana
  ON public.atividades_rotinas
  FOR EACH ROW
  EXECUTE FUNCTION app_private.preservar_horizonte_rotina_aberta_trigger();

CREATE OR REPLACE FUNCTION app_private.sincronizar_fila_rotina_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hoje date := (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_ator_user_id uuid := auth.uid();
  v_ator_tipo text := CASE WHEN auth.uid() IS NULL THEN 'sistema' ELSE 'usuario' END;
  v_ator_nome text;
  v_agenda_alterada boolean := TG_OP = 'INSERT';
  v_preservar_ocorrencias boolean := COALESCE(
    current_setting('app.obrigacao_preservar_ocorrencias', true), 'off'
  ) = 'on';
  v_tem_ocorrencia_ativa boolean := false;
  v_checklist jsonb;
BEGIN
  IF v_ator_user_id IS NULL THEN
    v_ator_nome := 'Sistema — sincronização de rotinas';
  ELSE
    SELECT COALESCE(NULLIF(btrim(usuario.nome), ''), v_ator_user_id::text)
    INTO v_ator_nome
    FROM public.configuracoes_usuarios usuario
    WHERE usuario.empresa_id = NEW.empresa_id
      AND usuario.auth_user_id = v_ator_user_id
      AND usuario.status = 'Ativo'
    ORDER BY (usuario.perfil_id IS NOT NULL) DESC, usuario.created_at DESC
    LIMIT 1;
    v_ator_nome := COALESCE(v_ator_nome, v_ator_user_id::text);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_agenda_alterada :=
      NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
      OR NEW.frequencia IS DISTINCT FROM OLD.frequencia
      OR NEW.intervalo_dias IS DISTINCT FROM OLD.intervalo_dias
      OR NEW.data_ancora IS DISTINCT FROM OLD.data_ancora
      OR NEW.dia_mes IS DISTINCT FROM OLD.dia_mes
      OR NEW.dia_semana_iso IS DISTINCT FROM OLD.dia_semana_iso
      OR NEW.incluir_finais_de_semana IS DISTINCT FROM OLD.incluir_finais_de_semana;

    SELECT EXISTS (
      SELECT 1
      FROM public.atividades_tarefas tarefa
      WHERE tarefa.empresa_id = NEW.empresa_id
        AND tarefa.rotina_id = NEW.id
        AND tarefa.ativo = true
        AND tarefa.status NOT IN ('Concluída', 'Cancelada')
    ) INTO v_tem_ocorrencia_ativa;

    v_preservar_ocorrencias := v_preservar_ocorrencias OR (
      NEW.protocolo_codigo IS NOT NULL AND v_tem_ocorrencia_ativa
    );
  END IF;

  IF NEW.ativa = false
     OR (v_agenda_alterada AND NOT v_preservar_ocorrencias) THEN
    WITH arquivadas AS (
      UPDATE public.atividades_tarefas tarefa
      SET ativo = false,
          status = 'Cancelada',
          atualizado_em = now()
      WHERE tarefa.empresa_id = NEW.empresa_id
        AND tarefa.rotina_id = NEW.id
        AND tarefa.ativo = true
        AND tarefa.vencimento >= v_hoje
        AND tarefa.status <> 'Concluída'
      RETURNING tarefa.id
    )
    INSERT INTO public.atividades_tarefa_eventos (
      empresa_id, tarefa_id, tipo, ator_user_id, ator_tipo,
      ator_nome, motivo, dados
    )
    SELECT
      NEW.empresa_id,
      arquivada.id,
      'arquivada',
      v_ator_user_id,
      v_ator_tipo,
      v_ator_nome,
      CASE WHEN NEW.ativa = false
        THEN 'Rotina desativada.'
        ELSE 'Rotina reprogramada; ocorrência futura substituída.'
      END,
      jsonb_build_object(
        'rotinaId', NEW.id,
        'origem', CASE WHEN NEW.ativa = false
          THEN 'desativacao_rotina'
          ELSE 'reprogramacao_rotina'
        END
      )
    FROM arquivadas arquivada;
  END IF;

  IF NEW.ativa = false
     OR NEW.responsavel_config_usuario_id IS NULL
     OR NEW.responsavel_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'titulo', CASE jsonb_typeof(item)
      WHEN 'string' THEN item #>> '{}'
      WHEN 'object' THEN item ->> 'titulo'
      ELSE NULL
    END,
    'concluida', false
  ) ORDER BY posicao), '[]'::jsonb)
  INTO v_checklist
  FROM jsonb_array_elements(COALESCE(NEW.checklist, '[]'::jsonb))
    WITH ORDINALITY AS etapa(item, posicao);

  UPDATE public.atividades_tarefas tarefa
  SET modelo_id = NEW.modelo_id,
      cliente_id = NEW.cliente_id,
      titulo = NEW.nome,
      categoria = NEW.categoria,
      frequencia = NEW.frequencia,
      responsavel_nome = NEW.responsavel_nome,
      responsavel_user_id = NEW.responsavel_user_id,
      responsavel_config_usuario_id = NEW.responsavel_config_usuario_id,
      cliente_nome = NEW.cliente_nome,
      prioridade = NEW.prioridade,
      notas = NEW.observacoes,
      checklist = CASE
        WHEN NOT v_preservar_ocorrencias
          AND tarefa.status = 'Pendente'
          AND NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(COALESCE(tarefa.checklist, '[]'::jsonb)) passo
            WHERE COALESCE((passo ->> 'concluida')::boolean, false)
          )
        THEN v_checklist
        ELSE tarefa.checklist
      END,
      revisor_user_id = CASE
        WHEN tarefa.revisor_user_id = NEW.responsavel_user_id THEN NULL
        ELSE tarefa.revisor_user_id
      END,
      revisor_nome = CASE
        WHEN tarefa.revisor_user_id = NEW.responsavel_user_id THEN NULL
        ELSE tarefa.revisor_nome
      END,
      revisao_status = CASE
        WHEN tarefa.revisor_user_id = NEW.responsavel_user_id
          THEN 'Não necessária'
        ELSE tarefa.revisao_status
      END,
      atualizado_em = now()
  WHERE tarefa.empresa_id = NEW.empresa_id
    AND tarefa.rotina_id = NEW.id
    AND tarefa.ativo = true
    AND tarefa.status NOT IN ('Concluída', 'Cancelada');

  IF v_preservar_ocorrencias
     AND TG_OP = 'UPDATE'
     AND v_tem_ocorrencia_ativa THEN
    RETURN NEW;
  END IF;

  IF v_ator_user_id IS NULL THEN
    PERFORM app_private.materializar_rotinas_empresa(
      NEW.empresa_id, v_hoje + 31, 'sistema', NULL, false, NEW.id
    );
  ELSE
    PERFORM app_private.materializar_rotinas_empresa(
      NEW.empresa_id, v_hoje + 31, 'usuario', v_ator_user_id, true, NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.sincronizar_fila_rotina_trigger()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION app_private.preservar_horizonte_rotina_aberta_trigger() IS
  'Mantém o horizonte já materializado enquanto há ocorrência protocolizada aberta.';
COMMENT ON FUNCTION app_private.sincronizar_fila_rotina_trigger() IS
  'Sincroniza metadados sem substituir ocorrência protocolizada em andamento.';
