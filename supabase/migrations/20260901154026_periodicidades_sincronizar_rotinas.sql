-- Sincronizações internas do catálogo podem ajustar a agenda canônica da
-- rotina, mas nunca devem substituir uma ocorrência operacional já iniciada.
-- Edições explícitas de agenda continuam usando o comportamento de
-- reprogramação; a guarda abaixo é privada e só é ligada dentro das RPCs.
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
    -- modelo_id é metadado do fluxo, não parte de sua agenda. Alterá-lo não
    -- pode cancelar uma ocorrência que já recebeu progresso.
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

    -- A proteção também vale para edição direta da rotina protocolizada. A
    -- guarda privada identifica o backfill, mas não é a única barreira contra
    -- perda de progresso.
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

  -- A ocorrência em andamento é a unidade de trabalho auditável. Durante uma
  -- reconciliação canônica, não materialize outra até ela ser resolvida.
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

CREATE OR REPLACE FUNCTION public.sincronizar_rotinas_protocolos_cliente(
  p_empresa_id uuid,
  p_cliente_id uuid,
  p_configs jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_regime text;
  v_cliente_nome text;
  v_hoje date := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;
  v_item record;
  v_periodicidade text;
  v_frequencia text;
  v_intervalo integer;
  v_ancora date;
  v_dia_mes integer;
  v_dia_semana integer;
  v_finais boolean;
  v_base date;
  v_execucao date;
  v_configs_reconciliadas jsonb;
  v_guard_anterior text := COALESCE(
    current_setting('app.obrigacao_config_internal_write', true), 'off'
  );
  v_ocorrencias_guard_anterior text := COALESCE(
    current_setting('app.obrigacao_preservar_ocorrencias', true), 'off'
  );
BEGIN
  SELECT cliente.tipo, cliente.nome INTO v_regime, v_cliente_nome
  FROM public.clientes cliente
  WHERE cliente.empresa_id = p_empresa_id
    AND cliente.id = p_cliente_id
    AND cliente.status = 'Ativa'
    AND EXISTS (
      SELECT 1
      FROM public.parametrizacao_catalogos tipo_parceiro
      WHERE tipo_parceiro.id = cliente.tipo_parceiro_id
        AND tipo_parceiro.empresa_id = cliente.empresa_id
        AND tipo_parceiro.tipo = 'tipos_parceiros'
        AND tipo_parceiro.codigo IN ('cliente_contabil', 'tp-1')
        AND tipo_parceiro.ativo = true
    )
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado para sincronizar obrigações.'
      USING ERRCODE = '42501';
  END IF;

  PERFORM public.validar_configs_protocolos_operacionais(
    p_empresa_id, p_cliente_id, p_configs
  );

  PERFORM set_config('app.obrigacao_preservar_ocorrencias', 'on', true);

  FOR v_item IN
    SELECT
      item.valor AS config,
      tipo.codigo,
      tipo.nome,
      tipo.categoria,
      tipo.descricao,
      tipo.etapas,
      tipo.modelo_atividade_id
    FROM jsonb_array_elements(p_configs) item(valor)
    JOIN public.parametrizacao_protocolos_tipos tipo
      ON tipo.empresa_id = p_empresa_id
     AND tipo.codigo = btrim(item.valor ->> 'entregaId')
     AND tipo.ativo = true
     AND v_regime = ANY(tipo.regimes)
    WHERE item.valor ->> 'ativo' = 'true'
  LOOP
    v_periodicidade := v_item.config ->> 'periodicidade';
    v_frequencia := CASE v_periodicidade
      WHEN 'diaria' THEN 'Diária'
      WHEN 'unica' THEN 'Única'
      WHEN 'semanal' THEN 'Semanal'
      WHEN 'quinzenal' THEN 'Quinzenal'
      WHEN 'mensal' THEN 'Mensal'
      WHEN 'trimestral' THEN 'Trimestral'
      WHEN 'semestral' THEN 'Semestral'
      ELSE 'Personalizada'
    END;
    v_intervalo := CASE v_periodicidade
      WHEN 'diaria' THEN 1
      WHEN 'unica' THEN 1
      WHEN 'semanal' THEN 7
      WHEN 'quinzenal' THEN 15
      WHEN 'mensal' THEN 30
      WHEN 'trimestral' THEN 90
      WHEN 'semestral' THEN 180
      WHEN 'anual' THEN 365
      ELSE (v_item.config ->> 'intervaloDias')::integer
    END;
    v_ancora := (v_item.config ->> 'dataInicial')::date;
    v_dia_mes := CASE WHEN v_periodicidade IN (
      'mensal', 'trimestral', 'semestral', 'anual'
    ) THEN (v_item.config ->> 'diaMes')::integer ELSE NULL END;
    v_dia_semana := CASE WHEN v_periodicidade = 'semanal'
      THEN (v_item.config ->> 'diaSemana')::integer ELSE NULL END;
    v_finais := COALESCE(
      (v_item.config ->> 'incluirFinaisDeSemana')::boolean, false
    );
    v_base := app_private.primeira_data_base_rotina(
      v_hoje, v_frequencia, v_intervalo, v_ancora,
      v_dia_mes, v_dia_semana, v_finais
    );
    v_execucao := app_private.ajustar_data_rotina(v_base, v_finais);

    INSERT INTO public.atividades_rotinas AS rotina (
      empresa_id, modelo_id, cliente_id, protocolo_codigo, nome, categoria,
      frequencia, intervalo_dias, responsavel_nome, cliente_nome,
      proxima_execucao, data_ancora, dia_mes, dia_semana_iso,
      proxima_execucao_base, prioridade, checklist, observacoes,
      incluir_finais_de_semana, ativa
    ) VALUES (
      p_empresa_id, v_item.modelo_atividade_id, p_cliente_id, v_item.codigo,
      v_item.nome,
      CASE v_item.categoria
        WHEN 'Fiscal' THEN 'Fiscal'
        WHEN 'Trabalhista' THEN 'Folha'
        WHEN 'Financeiro' THEN 'Contábil'
        WHEN 'Contábil' THEN 'Contábil'
        ELSE 'Cliente'
      END,
      v_frequencia, v_intervalo, '', v_cliente_nome, v_execucao,
      v_ancora, v_dia_mes, v_dia_semana, v_base,
      'Média', CASE
        WHEN jsonb_typeof(v_item.etapas) = 'array'
             AND jsonb_array_length(v_item.etapas) > 0 THEN v_item.etapas
        ELSE jsonb_build_array(v_item.nome)
      END,
      COALESCE(
        nullif(btrim(v_item.descricao), ''),
        'Rotina gerada pela configuração de obrigações.'
      ),
      v_finais, true
    )
    ON CONFLICT (empresa_id, cliente_id, protocolo_codigo)
      WHERE protocolo_codigo IS NOT NULL
    DO UPDATE SET
      modelo_id = EXCLUDED.modelo_id,
      nome = EXCLUDED.nome,
      categoria = EXCLUDED.categoria,
      frequencia = EXCLUDED.frequencia,
      intervalo_dias = EXCLUDED.intervalo_dias,
      cliente_nome = EXCLUDED.cliente_nome,
      checklist = EXCLUDED.checklist,
      observacoes = EXCLUDED.observacoes,
      incluir_finais_de_semana = EXCLUDED.incluir_finais_de_semana,
      ativa = true,
      data_ancora = EXCLUDED.data_ancora,
      dia_mes = EXCLUDED.dia_mes,
      dia_semana_iso = EXCLUDED.dia_semana_iso,
      proxima_execucao_base = CASE WHEN
        EXISTS (
          SELECT 1
          FROM public.atividades_tarefas tarefa_ativa
          WHERE tarefa_ativa.empresa_id = rotina.empresa_id
            AND tarefa_ativa.rotina_id = rotina.id
            AND tarefa_ativa.ativo = true
            AND tarefa_ativa.status NOT IN ('Concluída', 'Cancelada')
        ) THEN rotina.proxima_execucao_base
        WHEN rotina.ativa IS DISTINCT FROM true
        OR rotina.frequencia IS DISTINCT FROM EXCLUDED.frequencia
        OR rotina.intervalo_dias IS DISTINCT FROM EXCLUDED.intervalo_dias
        OR rotina.data_ancora IS DISTINCT FROM EXCLUDED.data_ancora
        OR rotina.dia_mes IS DISTINCT FROM EXCLUDED.dia_mes
        OR rotina.dia_semana_iso IS DISTINCT FROM EXCLUDED.dia_semana_iso
        OR rotina.incluir_finais_de_semana
          IS DISTINCT FROM EXCLUDED.incluir_finais_de_semana
        THEN EXCLUDED.proxima_execucao_base ELSE rotina.proxima_execucao_base END,
      proxima_execucao = CASE WHEN
        EXISTS (
          SELECT 1
          FROM public.atividades_tarefas tarefa_ativa
          WHERE tarefa_ativa.empresa_id = rotina.empresa_id
            AND tarefa_ativa.rotina_id = rotina.id
            AND tarefa_ativa.ativo = true
            AND tarefa_ativa.status NOT IN ('Concluída', 'Cancelada')
        ) THEN rotina.proxima_execucao
        WHEN rotina.ativa IS DISTINCT FROM true
        OR rotina.frequencia IS DISTINCT FROM EXCLUDED.frequencia
        OR rotina.intervalo_dias IS DISTINCT FROM EXCLUDED.intervalo_dias
        OR rotina.data_ancora IS DISTINCT FROM EXCLUDED.data_ancora
        OR rotina.dia_mes IS DISTINCT FROM EXCLUDED.dia_mes
        OR rotina.dia_semana_iso IS DISTINCT FROM EXCLUDED.dia_semana_iso
        OR rotina.incluir_finais_de_semana
          IS DISTINCT FROM EXCLUDED.incluir_finais_de_semana
        THEN EXCLUDED.proxima_execucao ELSE rotina.proxima_execucao END,
      atualizado_em = now()
    -- Uma rotina Única já materializada é histórico: atualizá-la como inativa
    -- dispararia o trigger da fila e cancelaria a ocorrência já criada.
    WHERE NOT (
      EXCLUDED.frequencia = 'Única'
      AND rotina.frequencia = 'Única'
      AND rotina.ativa = false
      AND EXISTS (
        SELECT 1
        FROM public.atividades_tarefas tarefa
        WHERE tarefa.empresa_id = rotina.empresa_id
          AND tarefa.rotina_id = rotina.id
          AND tarefa.origem = 'Rotina'
      )
    );
  END LOOP;

  UPDATE public.atividades_rotinas rotina
  SET ativa = false, atualizado_em = now()
  WHERE rotina.empresa_id = p_empresa_id
    AND rotina.cliente_id = p_cliente_id
    AND rotina.protocolo_codigo IS NOT NULL
    AND rotina.ativa = true
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_configs) item(valor)
      WHERE btrim(item.valor ->> 'entregaId') = rotina.protocolo_codigo
        AND item.valor ->> 'ativo' = 'true'
    );

  UPDATE public.clientes cliente
  SET modelos_ativos = ARRAY(
    SELECT DISTINCT modelo_id
    FROM (
      SELECT existente AS modelo_id
      FROM unnest(cliente.modelos_ativos) existente
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.parametrizacao_protocolos_tipos tipo_legado
        WHERE tipo_legado.empresa_id = p_empresa_id
          AND (
            tipo_legado.modelo_atividade_id::text = existente
            OR tipo_legado.codigo = existente
          )
      )
      UNION ALL
      SELECT tipo_ativo.modelo_atividade_id::text
      FROM jsonb_array_elements(p_configs) item(valor)
      JOIN public.parametrizacao_protocolos_tipos tipo_ativo
        ON tipo_ativo.empresa_id = p_empresa_id
       AND tipo_ativo.codigo = btrim(item.valor ->> 'entregaId')
      WHERE item.valor ->> 'ativo' = 'true'
        AND tipo_ativo.modelo_atividade_id IS NOT NULL
    ) modelos
    WHERE modelo_id IS NOT NULL
  ), updated_at = now()
  WHERE cliente.empresa_id = p_empresa_id AND cliente.id = p_cliente_id;

  -- Se uma rotina Única já tiver ocorrência, ela não volta a ficar ativa nem
  -- quando a sincronização veio de uma edição global. Apenas ativa/updated_at
  -- são tocados, portanto o trigger de reprogramação não cancela a tarefa.
  UPDATE public.atividades_rotinas rotina
  SET ativa = false, atualizado_em = now()
  WHERE rotina.empresa_id = p_empresa_id
    AND rotina.cliente_id = p_cliente_id
    AND rotina.protocolo_codigo IS NOT NULL
    AND rotina.frequencia = 'Única'
    AND rotina.ativa = true
    AND EXISTS (
      SELECT 1
      FROM public.atividades_tarefas tarefa
      WHERE tarefa.empresa_id = rotina.empresa_id
        AND tarefa.rotina_id = rotina.id
        AND tarefa.origem = 'Rotina'
    );

  -- A materialização pode avançar proxima_execucao dentro do trigger da
  -- rotina. Releia a rotina após o upsert e grave esse avanço no JSON; assim
  -- normalizar novamente é um ponto fixo sem trocar data_ancora.
  v_configs_reconciliadas := app_private.normalizar_configs_protocolos_cliente(
    p_empresa_id, p_cliente_id, p_configs, v_hoje
  );
  PERFORM public.validar_configs_protocolos_operacionais(
    p_empresa_id, p_cliente_id, v_configs_reconciliadas
  );

  PERFORM set_config('app.obrigacao_config_internal_write', 'on', true);
  UPDATE public.configuracoes_protocolos_empresas cfg
  SET configs = v_configs_reconciliadas
  WHERE cfg.empresa_id = p_empresa_id
    AND cfg.cliente_id = p_cliente_id
    AND cfg.configs IS DISTINCT FROM v_configs_reconciliadas;
  PERFORM set_config(
    'app.obrigacao_config_internal_write', v_guard_anterior, true
  );
  PERFORM set_config(
    'app.obrigacao_preservar_ocorrencias',
    v_ocorrencias_guard_anterior,
    true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sincronizar_rotinas_protocolos_cliente(
  uuid, uuid, jsonb
) FROM PUBLIC, anon, authenticated;
