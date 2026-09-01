-- Mantém Minha Fila, Equipe e Painel abastecidos com uma janela móvel de 31 dias.
-- A rotina continua sendo a definição; atividades_tarefas contém as ocorrências operacionais.

CREATE OR REPLACE FUNCTION app_private.materializar_rotinas_todas_empresas(
  p_ate date DEFAULT (
    (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date + 31
  )
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid;
  v_hoje date := (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_criadas integer := 0;
BEGIN
  IF p_ate IS NULL OR p_ate > v_hoje + 31 THEN
    RAISE EXCEPTION 'Data limite inválida' USING ERRCODE = '22023';
  END IF;

  DELETE FROM app_private.materializacao_rotinas_falhas
  WHERE criado_em < now() - interval '90 days';

  FOR v_empresa_id IN
    SELECT DISTINCT rotina.empresa_id
    FROM public.atividades_rotinas rotina
    JOIN public.empresas empresa
      ON empresa.id = rotina.empresa_id
     AND empresa.status = 'ativo'
    WHERE rotina.ativa = true
      AND rotina.proxima_execucao <= p_ate
      AND (
        rotina.cliente_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.clientes cliente
          WHERE cliente.id = rotina.cliente_id
            AND cliente.empresa_id = rotina.empresa_id
            AND cliente.status = 'Ativa'
        )
      )
  LOOP
    BEGIN
      v_criadas := v_criadas + app_private.materializar_rotinas_empresa(
        v_empresa_id, p_ate, 'sistema', NULL, false, NULL
      );
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO app_private.materializacao_rotinas_falhas (
        empresa_id, data_limite, erro
      ) VALUES (
        v_empresa_id, p_ate, left(SQLERRM, 2000)
      );
      RAISE WARNING 'Materialização automática ignorou a empresa %: %',
        v_empresa_id, SQLERRM;
    END;
  END LOOP;

  RETURN v_criadas;
END;
$$;

REVOKE ALL ON FUNCTION app_private.materializar_rotinas_todas_empresas(date)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.listar_responsaveis_atividades()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_pode_gerenciar boolean;
  v_pode_ver_proprio boolean;
  v_resultado jsonb;
BEGIN
  v_pode_gerenciar := COALESCE(
    public.current_user_has_permission(v_empresa_id, 'atividades:manage'), false
  );
  v_pode_ver_proprio := COALESCE(
    public.current_user_has_permission(v_empresa_id, 'atividades:view'), false
  ) OR COALESCE(
    public.current_user_has_permission(v_empresa_id, 'atividades:update-own'), false
  );

  IF auth.uid() IS NULL
     OR v_empresa_id IS NULL
     OR COALESCE(public.current_user_is_client_scoped(v_empresa_id), true)
     OR NOT (v_pode_gerenciar OR v_pode_ver_proprio) THEN
    RAISE EXCEPTION 'Sem permissão para listar responsáveis.' USING ERRCODE = '42501';
  END IF;

  WITH responsaveis AS (
    SELECT DISTINCT ON (usuario.auth_user_id)
      usuario.id AS config_usuario_id,
      usuario.auth_user_id,
      usuario.nome
    FROM public.configuracoes_usuarios usuario
    WHERE usuario.empresa_id = v_empresa_id
      AND usuario.status = 'Ativo'
      AND usuario.auth_user_id IS NOT NULL
      AND (v_pode_gerenciar OR usuario.auth_user_id = auth.uid())
    ORDER BY
      usuario.auth_user_id,
      (usuario.perfil_id IS NOT NULL) DESC,
      usuario.created_at DESC,
      usuario.id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'configUsuarioId', responsavel.config_usuario_id,
    'userId', responsavel.auth_user_id,
    'nome', responsavel.nome
  ) ORDER BY responsavel.nome), '[]'::jsonb)
  INTO v_resultado
  FROM responsaveis responsavel;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_responsaveis_atividades()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_responsaveis_atividades()
  TO authenticated;

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
      NEW.modelo_id IS DISTINCT FROM OLD.modelo_id
      OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
      OR NEW.frequencia IS DISTINCT FROM OLD.frequencia
      OR NEW.intervalo_dias IS DISTINCT FROM OLD.intervalo_dias
      OR NEW.data_ancora IS DISTINCT FROM OLD.data_ancora
      OR NEW.dia_mes IS DISTINCT FROM OLD.dia_mes
      OR NEW.dia_semana_iso IS DISTINCT FROM OLD.dia_semana_iso
      OR NEW.incluir_finais_de_semana IS DISTINCT FROM OLD.incluir_finais_de_semana;
  END IF;

  IF NEW.ativa = false OR v_agenda_alterada THEN
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

  -- Reatribuição e edição simples alcançam também pendências vencidas ainda abertas.
  -- Checklist em execução não é reiniciado; apenas tarefas ainda pendentes o recebem.
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
        WHEN tarefa.status = 'Pendente'
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

DROP TRIGGER IF EXISTS sincronizar_fila_rotina ON public.atividades_rotinas;
CREATE TRIGGER sincronizar_fila_rotina
  AFTER INSERT OR UPDATE OF
    modelo_id,
    cliente_id,
    nome,
    categoria,
    frequencia,
    intervalo_dias,
    responsavel_nome,
    responsavel_user_id,
    responsavel_config_usuario_id,
    cliente_nome,
    data_ancora,
    dia_mes,
    dia_semana_iso,
    prioridade,
    checklist,
    observacoes,
    incluir_finais_de_semana
  ON public.atividades_rotinas
  FOR EACH ROW
  EXECUTE FUNCTION app_private.sincronizar_fila_rotina_trigger();

CREATE OR REPLACE FUNCTION public.desativar_rotina_programada(p_rotina_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_hoje date := (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_id uuid;
  v_ator_nome text;
BEGIN
  IF auth.uid() IS NULL
     OR v_empresa_id IS NULL
     OR p_rotina_id IS NULL
     OR COALESCE(public.current_user_is_client_scoped(v_empresa_id), true)
     OR NOT COALESCE(
       public.current_user_has_permission(v_empresa_id, 'atividades:manage'), false
     ) THEN
    RAISE EXCEPTION 'Rotina programada não encontrada.' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(NULLIF(btrim(usuario.nome), ''), auth.uid()::text)
  INTO v_ator_nome
  FROM public.configuracoes_usuarios usuario
  WHERE usuario.empresa_id = v_empresa_id
    AND usuario.auth_user_id = auth.uid()
    AND usuario.status = 'Ativo'
  ORDER BY (usuario.perfil_id IS NOT NULL) DESC, usuario.created_at DESC
  LIMIT 1;
  v_ator_nome := COALESCE(v_ator_nome, auth.uid()::text);

  UPDATE public.atividades_rotinas rotina
  SET ativa = false,
      atualizado_em = now()
  WHERE rotina.id = p_rotina_id
    AND rotina.empresa_id = v_empresa_id
    AND rotina.ativa = true
    AND rotina.protocolo_codigo IS NULL
    AND COALESCE(
      public.current_user_can_access_client_row(v_empresa_id, rotina.cliente_id), false
    )
  RETURNING rotina.id INTO v_id;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Rotina programada não encontrada.' USING ERRCODE = '42501';
  END IF;

  WITH arquivadas AS (
    UPDATE public.atividades_tarefas tarefa
    SET ativo = false,
        status = 'Cancelada',
        atualizado_em = now()
    WHERE tarefa.empresa_id = v_empresa_id
      AND tarefa.rotina_id = v_id
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
    v_empresa_id, arquivada.id, 'arquivada', auth.uid(), 'usuario',
    v_ator_nome, 'Rotina desativada.',
    jsonb_build_object('rotinaId', v_id, 'origem', 'desativacao_rotina')
  FROM arquivadas arquivada;

  RETURN jsonb_build_object('id', v_id, 'ativa', false);
END;
$$;

REVOKE ALL ON FUNCTION public.desativar_rotina_programada(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desativar_rotina_programada(uuid)
  TO authenticated;

-- O mesmo nome faz upsert do job existente, sem criar agendamento duplicado.
SELECT cron.schedule(
  'materializar-atividades-operacionais-15min',
  '*/15 * * * *',
  $cron$SELECT app_private.materializar_rotinas_todas_empresas();$cron$
);

-- Backfill genérico e idempotente: o índice parcial
-- (empresa_id, rotina_id, vencimento) impede duplicidades ativas.
SELECT app_private.materializar_rotinas_todas_empresas();
