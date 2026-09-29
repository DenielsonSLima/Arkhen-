-- Reatribuições preservam autoria histórica e movem somente o trabalho aberto.
-- A exclusão de uma obrigação remove o catálogo/configuração, mas mantém
-- tarefas e eventos já produzidos como registros auditáveis.

ALTER TABLE public.atividades_tarefa_eventos
  DROP CONSTRAINT IF EXISTS atividades_tarefa_eventos_tipo_check;

ALTER TABLE public.atividades_tarefa_eventos
  ADD CONSTRAINT atividades_tarefa_eventos_tipo_check CHECK (tipo IN (
    'criada', 'checklist', 'conclusao_solicitada', 'concluida', 'revisao_aprovada',
    'revisao_rejeitada', 'reaberta', 'arquivada', 'dados_atualizados',
    'responsavel_alterado'
  ));

CREATE OR REPLACE FUNCTION public.atribuir_responsavel_rotina(
  p_rotina_id uuid,
  p_responsavel_config_usuario_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_hoje date := (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_rotina public.atividades_rotinas%rowtype;
  v_responsavel_user_id uuid;
  v_responsavel_nome text;
  v_responsavel_anterior_config_id uuid;
  v_responsavel_anterior_user_id uuid;
  v_responsavel_anterior_nome text;
  v_ator_nome text;
  v_tarefas_abertas uuid[] := ARRAY[]::uuid[];
  v_base date;
  v_execucao date;
BEGIN
  IF auth.uid() IS NULL
     OR v_empresa_id IS NULL
     OR p_rotina_id IS NULL
     OR p_responsavel_config_usuario_id IS NULL
     OR COALESCE(public.current_user_is_client_scoped(v_empresa_id), true)
     OR NOT COALESCE(
       public.current_user_has_permission(v_empresa_id, 'atividades:manage'),
       false
     ) THEN
    RAISE EXCEPTION 'Rotina não encontrada.' USING ERRCODE = '42501';
  END IF;

  SELECT usuario.auth_user_id, usuario.nome
  INTO v_responsavel_user_id, v_responsavel_nome
  FROM public.configuracoes_usuarios usuario
  WHERE usuario.id = p_responsavel_config_usuario_id
    AND usuario.empresa_id = v_empresa_id
    AND usuario.status = 'Ativo'
    AND usuario.auth_user_id IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Responsável ativo ainda não possui acesso ao sistema.'
      USING ERRCODE = '23503';
  END IF;

  SELECT rotina.*
  INTO v_rotina
  FROM public.atividades_rotinas rotina
  WHERE rotina.id = p_rotina_id
    AND rotina.empresa_id = v_empresa_id
    AND rotina.ativa = true
    AND COALESCE(
      public.current_user_can_access_client_row(v_empresa_id, rotina.cliente_id),
      false
    )
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
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rotina não encontrada.' USING ERRCODE = '42501';
  END IF;

  IF v_rotina.responsavel_config_usuario_id = p_responsavel_config_usuario_id THEN
    RETURN jsonb_build_object(
      'id', v_rotina.id,
      'responsavelConfigUsuarioId', v_rotina.responsavel_config_usuario_id,
      'responsavelUserId', v_rotina.responsavel_user_id,
      'responsavelNome', v_rotina.responsavel_nome,
      'tarefasEmAbertoAtualizadas', 0
    );
  END IF;

  v_responsavel_anterior_config_id := v_rotina.responsavel_config_usuario_id;
  v_responsavel_anterior_user_id := v_rotina.responsavel_user_id;
  v_responsavel_anterior_nome := v_rotina.responsavel_nome;

  SELECT COALESCE(array_agg(tarefa.id ORDER BY tarefa.id), ARRAY[]::uuid[])
  INTO v_tarefas_abertas
  FROM (
    SELECT aberta.id
    FROM public.atividades_tarefas aberta
    WHERE aberta.empresa_id = v_empresa_id
      AND aberta.rotina_id = p_rotina_id
      AND aberta.ativo = true
      AND aberta.status NOT IN ('Concluída', 'Cancelada')
    ORDER BY aberta.id
    FOR UPDATE
  ) tarefa;

  v_base := v_rotina.proxima_execucao_base;
  v_execucao := v_rotina.proxima_execucao;
  IF v_execucao < v_hoje THEN
    v_base := app_private.primeira_data_base_rotina(
      v_hoje,
      v_rotina.frequencia,
      v_rotina.intervalo_dias,
      v_rotina.data_ancora,
      v_rotina.dia_mes,
      v_rotina.dia_semana_iso,
      v_rotina.incluir_finais_de_semana
    );
    v_execucao := app_private.ajustar_data_rotina(
      v_base,
      v_rotina.incluir_finais_de_semana
    );
  END IF;

  UPDATE public.atividades_rotinas
  SET responsavel_config_usuario_id = p_responsavel_config_usuario_id,
      responsavel_user_id = v_responsavel_user_id,
      responsavel_nome = v_responsavel_nome,
      proxima_execucao_base = v_base,
      proxima_execucao = v_execucao,
      atualizado_em = now()
  WHERE id = p_rotina_id AND empresa_id = v_empresa_id
  RETURNING * INTO v_rotina;

  SELECT COALESCE(NULLIF(btrim(usuario.nome), ''), auth.uid()::text)
  INTO v_ator_nome
  FROM public.configuracoes_usuarios usuario
  WHERE usuario.empresa_id = v_empresa_id
    AND usuario.auth_user_id = auth.uid()
    AND usuario.status = 'Ativo'
  ORDER BY (usuario.perfil_id IS NOT NULL) DESC, usuario.created_at DESC
  LIMIT 1;
  v_ator_nome := COALESCE(v_ator_nome, auth.uid()::text);

  INSERT INTO public.atividades_tarefa_eventos (
    empresa_id, tarefa_id, tipo, ator_user_id, ator_tipo,
    ator_nome, motivo, dados
  )
  SELECT
    v_empresa_id,
    tarefa.id,
    'responsavel_alterado',
    auth.uid(),
    'usuario',
    v_ator_nome,
    'Responsável da rotina alterado; ocorrência em aberto transferida.',
    jsonb_build_object(
      'rotinaId', p_rotina_id,
      'responsavelAnteriorConfigUsuarioId', v_responsavel_anterior_config_id,
      'responsavelAnteriorUserId', v_responsavel_anterior_user_id,
      'responsavelAnteriorNome', v_responsavel_anterior_nome,
      'responsavelNovoConfigUsuarioId', p_responsavel_config_usuario_id,
      'responsavelNovoUserId', v_responsavel_user_id,
      'responsavelNovoNome', v_responsavel_nome
    )
  FROM public.atividades_tarefas tarefa
  WHERE tarefa.empresa_id = v_empresa_id
    AND tarefa.id = ANY(v_tarefas_abertas);

  -- O trigger sincronizar_fila_rotina já materializa a rotina uma única vez.
  RETURN jsonb_build_object(
    'id', v_rotina.id,
    'responsavelConfigUsuarioId', p_responsavel_config_usuario_id,
    'responsavelUserId', v_responsavel_user_id,
    'responsavelNome', v_responsavel_nome,
    'tarefasEmAbertoAtualizadas', cardinality(v_tarefas_abertas)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.atribuir_responsavel_rotina(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atribuir_responsavel_rotina(uuid, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.excluir_obrigacao_unificada(p_obrigacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_codigo text;
  v_nome text;
  v_modelo_id uuid;
  v_rotina_ids uuid[] := ARRAY[]::uuid[];
  v_removida uuid;
BEGIN
  IF auth.uid() IS NULL
     OR v_empresa_id IS NULL
     OR p_obrigacao_id IS NULL
     OR COALESCE(public.current_user_is_client_scoped(v_empresa_id), true)
     OR NOT COALESCE(
       public.current_user_has_permission(v_empresa_id, 'parametrizacao:manage'),
       false
     ) THEN
    RAISE EXCEPTION 'Obrigação não encontrada.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_empresa_id::text, 913331)
  );

  SELECT tipo.codigo, tipo.nome, tipo.modelo_atividade_id
  INTO v_codigo, v_nome, v_modelo_id
  FROM public.parametrizacao_protocolos_tipos tipo
  WHERE tipo.id = p_obrigacao_id
    AND tipo.empresa_id = v_empresa_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Obrigação não encontrada.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.configuracoes_protocolos_empresas configuracao
  SET configs = COALESCE((
    SELECT jsonb_agg(item.valor ORDER BY item.ordem)
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(configuracao.configs) = 'array'
        THEN configuracao.configs ELSE '[]'::jsonb END
    ) WITH ORDINALITY item(valor, ordem)
    WHERE item.valor ->> 'entregaId' IS DISTINCT FROM v_codigo
  ), '[]'::jsonb)
  WHERE configuracao.empresa_id = v_empresa_id
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(configuracao.configs) = 'array'
          THEN configuracao.configs ELSE '[]'::jsonb END
      ) item(valor)
      WHERE item.valor ->> 'entregaId' = v_codigo
    );

  SELECT COALESCE(array_agg(rotina.id ORDER BY rotina.id), ARRAY[]::uuid[])
  INTO v_rotina_ids
  FROM public.atividades_rotinas rotina
  WHERE rotina.empresa_id = v_empresa_id
    AND rotina.protocolo_codigo = v_codigo;

  UPDATE public.atividades_rotinas rotina
  SET ativa = false,
      atualizado_em = now()
  WHERE rotina.empresa_id = v_empresa_id
    AND rotina.id = ANY(v_rotina_ids)
    AND rotina.ativa = true;

  -- O trigger acima arquiva ocorrências futuras. Este complemento encerra
  -- também atrasadas ainda abertas, sem tocar em concluídas ou em seus eventos.
  WITH arquivadas AS (
    UPDATE public.atividades_tarefas tarefa
    SET ativo = false,
        status = 'Cancelada',
        atualizado_em = now()
    WHERE tarefa.empresa_id = v_empresa_id
      AND tarefa.rotina_id = ANY(v_rotina_ids)
      AND tarefa.ativo = true
      AND tarefa.status NOT IN ('Concluída', 'Cancelada')
    RETURNING tarefa.id, tarefa.rotina_id
  )
  INSERT INTO public.atividades_tarefa_eventos (
    empresa_id, tarefa_id, tipo, ator_user_id, ator_tipo,
    ator_nome, motivo, dados
  )
  SELECT
    v_empresa_id,
    arquivada.id,
    'arquivada',
    auth.uid(),
    'usuario',
    COALESCE(NULLIF(btrim(usuario.nome), ''), auth.uid()::text),
    'Obrigação excluída do catálogo.',
    jsonb_build_object(
      'rotinaId', arquivada.rotina_id,
      'obrigacaoId', p_obrigacao_id,
      'obrigacaoCodigo', v_codigo,
      'origem', 'exclusao_obrigacao'
    )
  FROM arquivadas
  LEFT JOIN LATERAL (
    SELECT config.nome
    FROM public.configuracoes_usuarios config
    WHERE config.empresa_id = v_empresa_id
      AND config.auth_user_id = auth.uid()
      AND config.status = 'Ativo'
    ORDER BY (config.perfil_id IS NOT NULL) DESC, config.created_at DESC
    LIMIT 1
  ) usuario ON true;

  DELETE FROM public.parametrizacao_prazos_entrega prazo
  WHERE prazo.empresa_id = v_empresa_id
    AND prazo.entrega_id = v_codigo;

  DELETE FROM public.parametrizacao_protocolos_tipos tipo
  WHERE tipo.id = p_obrigacao_id
    AND tipo.empresa_id = v_empresa_id
  RETURNING tipo.id INTO v_removida;

  IF v_removida IS NULL THEN
    RAISE EXCEPTION 'Obrigação não encontrada.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.atividades_modelos modelo
  SET ativo = false,
      atualizado_em = now()
  WHERE modelo.id = v_modelo_id
    AND modelo.empresa_id = v_empresa_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.parametrizacao_protocolos_tipos outro
      WHERE outro.empresa_id = modelo.empresa_id
        AND outro.modelo_atividade_id = modelo.id
    );

  RETURN jsonb_build_object(
    'id', v_removida,
    'codigo', v_codigo,
    'nome', v_nome,
    'historicoPreservado', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.excluir_obrigacao_unificada(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_obrigacao_unificada(uuid)
  TO authenticated;

COMMENT ON FUNCTION public.excluir_obrigacao_unificada(uuid) IS
  'Exclui a obrigação do catálogo no tenant atual e preserva o histórico operacional.';
