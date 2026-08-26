-- EXPAND: nova escrita estrutural de tarefas. A RPC anterior permanece ativa
-- até o passo LOCKDOWN, permitindo publicação em fases sem indisponibilidade.
BEGIN;

CREATE OR REPLACE FUNCTION public.salvar_tarefa_operacional(
  p_tarefa_id uuid,
  p_payload jsonb
)
RETURNS public.atividades_tarefas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_tarefa public.atividades_tarefas%rowtype;
  v_resultado public.atividades_tarefas%rowtype;
  v_rotina public.atividades_rotinas%rowtype;
  v_nova boolean := p_tarefa_id IS NULL;
  v_manage boolean;
  v_update_own boolean;
  v_agora timestamptz := now();
  v_hoje date := (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_rotina_id uuid;
  v_modelo_id uuid;
  v_cliente_id uuid;
  v_responsavel_config_id uuid;
  v_responsavel_user_id uuid;
  v_revisor_user_id uuid;
  v_titulo text;
  v_categoria text;
  v_frequencia text;
  v_responsavel_nome text;
  v_revisor_nome text;
  v_cliente_nome text;
  v_vencimento date;
  v_prazo_legal date;
  v_prazo_interno date;
  v_prioridade text;
  v_origem text;
  v_checklist jsonb;
  v_notas text;
  v_observacao_falta text;
  v_matches integer;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR p_payload = '{}'::jsonb
     OR octet_length(p_payload::text) > 65536 THEN
    RAISE EXCEPTION 'Solicitação de tarefa inválida' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_payload) campo(chave)
    WHERE campo.chave <> ALL(ARRAY[
      'rotina_id', 'cliente_id', 'titulo', 'categoria', 'frequencia',
      'responsavel_config_usuario_id', 'cliente_nome', 'vencimento',
      'prazo_legal', 'prazo_interno', 'prioridade', 'origem', 'checklist',
      'notas', 'observacao_falta', 'revisor_user_id', 'ativo'
    ]::text[])
  ) THEN
    RAISE EXCEPTION 'Campo de tarefa não permitido' USING ERRCODE = '22023';
  END IF;

  v_manage := coalesce(
    public.current_user_has_permission(v_empresa_id, 'atividades:manage'), false
  );
  IF NOT v_nova THEN
    SELECT tarefa.* INTO v_tarefa
    FROM public.atividades_tarefas tarefa
    WHERE tarefa.id = p_tarefa_id
      AND tarefa.empresa_id = v_empresa_id
      AND tarefa.ativo = true
      AND public.current_user_can_access_client_row(tarefa.empresa_id, tarefa.cliente_id)
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Tarefa não encontrada'; END IF;

    v_update_own := coalesce(
      public.current_user_has_permission(v_empresa_id, 'atividades:update-own'), false
    ) AND v_tarefa.responsavel_user_id = auth.uid();
    IF NOT v_manage AND NOT v_update_own THEN
      RAISE EXCEPTION 'Tarefa não encontrada';
    END IF;
    IF v_tarefa.status IN ('Aguardando revisão', 'Concluída') THEN
      RAISE EXCEPTION 'Reabra a tarefa com justificativa antes de alterá-la'
        USING ERRCODE = '22023';
    ELSIF NOT v_manage THEN
      RAISE EXCEPTION
        'Use o acompanhamento da tarefa para registrar seu progresso.'
        USING ERRCODE = '42501';
    END IF;
    IF p_payload ? 'checklist' THEN
      RAISE EXCEPTION 'Use o checklist operacional para alterar etapas'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    v_update_own := coalesce(
      public.current_user_has_permission(v_empresa_id, 'atividades:update-own'), false
    );
    IF NOT v_manage AND NOT v_update_own THEN
      RAISE EXCEPTION 'Sem permissão para criar tarefa' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NOT v_nova AND v_manage AND p_payload = '{"ativo":false}'::jsonb THEN
    UPDATE public.atividades_tarefas
    SET ativo = false, atualizado_em = v_agora
    WHERE id = p_tarefa_id AND empresa_id = v_empresa_id
    RETURNING * INTO v_resultado;
    PERFORM public.registrar_evento_tarefa_operacional(
      v_empresa_id, p_tarefa_id, 'arquivada', NULL, '{}'::jsonb
    );
    RETURN v_resultado;
  END IF;

  v_rotina_id := CASE WHEN v_nova THEN NULL ELSE v_tarefa.rotina_id END;
  v_modelo_id := CASE WHEN v_nova THEN NULL ELSE v_tarefa.modelo_id END;
  v_cliente_id := CASE WHEN v_nova THEN NULL ELSE v_tarefa.cliente_id END;
  v_responsavel_config_id := CASE
    WHEN v_nova THEN NULL ELSE v_tarefa.responsavel_config_usuario_id END;
  v_responsavel_user_id := CASE
    WHEN v_nova THEN NULL ELSE v_tarefa.responsavel_user_id END;
  v_revisor_user_id := CASE WHEN v_nova THEN NULL ELSE v_tarefa.revisor_user_id END;
  v_titulo := CASE WHEN v_nova THEN NULL ELSE v_tarefa.titulo END;
  v_categoria := CASE WHEN v_nova THEN 'Controle' ELSE v_tarefa.categoria END;
  v_frequencia := CASE WHEN v_nova THEN 'Única' ELSE v_tarefa.frequencia END;
  v_responsavel_nome := CASE WHEN v_nova THEN '' ELSE v_tarefa.responsavel_nome END;
  v_revisor_nome := CASE WHEN v_nova THEN NULL ELSE v_tarefa.revisor_nome END;
  v_cliente_nome := CASE WHEN v_nova THEN 'Escritório' ELSE v_tarefa.cliente_nome END;
  v_vencimento := CASE WHEN v_nova THEN v_hoje ELSE v_tarefa.vencimento END;
  v_prazo_legal := CASE WHEN v_nova THEN v_hoje
    ELSE coalesce(v_tarefa.prazo_legal, v_tarefa.vencimento) END;
  v_prazo_interno := CASE WHEN v_nova THEN v_hoje
    ELSE coalesce(v_tarefa.prazo_interno, v_tarefa.vencimento) END;
  v_prioridade := CASE WHEN v_nova THEN 'Média' ELSE v_tarefa.prioridade END;
  v_origem := CASE WHEN v_nova THEN 'Usuario' ELSE v_tarefa.origem END;
  v_checklist := CASE WHEN v_nova THEN NULL ELSE v_tarefa.checklist END;
  v_notas := CASE WHEN v_nova THEN '' ELSE coalesce(v_tarefa.notas, '') END;
  v_observacao_falta := CASE WHEN v_nova THEN NULL ELSE v_tarefa.observacao_falta END;

  BEGIN
    IF p_payload ? 'rotina_id' THEN
      v_rotina_id := NULLIF(p_payload ->> 'rotina_id', '')::uuid;
    END IF;
    IF p_payload ? 'cliente_id' THEN
      v_cliente_id := NULLIF(p_payload ->> 'cliente_id', '')::uuid;
    END IF;
    IF p_payload ? 'responsavel_config_usuario_id' THEN
      v_responsavel_config_id := NULLIF(
        p_payload ->> 'responsavel_config_usuario_id', ''
      )::uuid;
    END IF;
    IF p_payload ? 'revisor_user_id' THEN
      v_revisor_user_id := NULLIF(p_payload ->> 'revisor_user_id', '')::uuid;
    END IF;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Identificador de tarefa inválido' USING ERRCODE = '22023';
  END;

  IF p_payload ? 'titulo' THEN v_titulo := btrim(p_payload ->> 'titulo'); END IF;
  IF p_payload ? 'categoria' THEN v_categoria := p_payload ->> 'categoria'; END IF;
  IF p_payload ? 'frequencia' THEN v_frequencia := p_payload ->> 'frequencia'; END IF;
  IF p_payload ? 'cliente_nome' THEN
    v_cliente_nome := btrim(p_payload ->> 'cliente_nome');
  END IF;
  IF p_payload ? 'prioridade' THEN v_prioridade := p_payload ->> 'prioridade'; END IF;
  IF p_payload ? 'origem' THEN v_origem := p_payload ->> 'origem'; END IF;
  IF p_payload ? 'checklist' THEN v_checklist := p_payload -> 'checklist'; END IF;
  IF p_payload ? 'notas' THEN v_notas := coalesce(p_payload ->> 'notas', ''); END IF;
  IF p_payload ? 'observacao_falta' THEN
    v_observacao_falta := NULLIF(btrim(p_payload ->> 'observacao_falta'), '');
  END IF;

  BEGIN
    IF p_payload ? 'vencimento' THEN
      IF (p_payload ->> 'vencimento') !~ '^\d{4}-\d{2}-\d{2}$' THEN
        RAISE EXCEPTION 'Vencimento inválido' USING ERRCODE = '22023';
      END IF;
      v_vencimento := (p_payload ->> 'vencimento')::date;
    END IF;
    IF p_payload ? 'prazo_legal' THEN
      IF NULLIF(p_payload ->> 'prazo_legal', '') IS NOT NULL
         AND (p_payload ->> 'prazo_legal') !~ '^\d{4}-\d{2}-\d{2}$' THEN
        RAISE EXCEPTION 'Prazo legal inválido' USING ERRCODE = '22023';
      END IF;
      v_prazo_legal := NULLIF(p_payload ->> 'prazo_legal', '')::date;
    END IF;
    IF p_payload ? 'prazo_interno' THEN
      IF NULLIF(p_payload ->> 'prazo_interno', '') IS NOT NULL
         AND (p_payload ->> 'prazo_interno') !~ '^\d{4}-\d{2}-\d{2}$' THEN
        RAISE EXCEPTION 'Prazo interno inválido' USING ERRCODE = '22023';
      END IF;
      v_prazo_interno := NULLIF(p_payload ->> 'prazo_interno', '')::date;
    END IF;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'Prazo da tarefa inválido' USING ERRCODE = '22023';
  END;
  v_prazo_legal := coalesce(v_prazo_legal, v_vencimento);
  v_prazo_interno := coalesce(v_prazo_interno, v_vencimento);

  IF NULLIF(v_titulo, '') IS NULL OR octet_length(v_titulo) > 240
     OR v_categoria NOT IN ('Interna','Cliente','Fiscal','Folha','Contábil','Controle')
     OR v_frequencia NOT IN (
       'Diária','Semanal','Quinzenal','Mensal','Personalizada','Única'
     )
     OR v_prioridade NOT IN ('Baixa','Média','Alta')
     OR v_origem NOT IN ('Rotina','Manual','Usuario','Gestor')
     OR octet_length(coalesce(v_cliente_nome, '')) > 240
     OR octet_length(v_notas) > 10000
     OR octet_length(coalesce(v_observacao_falta, '')) > 2000
     OR v_prazo_interno > v_prazo_legal
     OR NOT public.atividade_checklist_valido(v_checklist) THEN
    RAISE EXCEPTION 'Dados de tarefa inválidos' USING ERRCODE = '22023';
  END IF;

  IF v_manage THEN
    IF v_responsavel_config_id IS NOT NULL THEN
      SELECT usuario.id, usuario.auth_user_id, usuario.nome
      INTO v_responsavel_config_id, v_responsavel_user_id, v_responsavel_nome
      FROM public.configuracoes_usuarios usuario
      WHERE usuario.id = v_responsavel_config_id
        AND usuario.empresa_id = v_empresa_id
        AND usuario.status = 'Ativo'
        AND usuario.auth_user_id IS NOT NULL;
      IF NOT FOUND THEN RAISE EXCEPTION 'Responsável não encontrado'; END IF;
    ELSIF v_nova THEN
      RAISE EXCEPTION 'Selecione um responsável ativo para a tarefa';
    END IF;
  ELSE
    SELECT usuario.id, usuario.auth_user_id, usuario.nome
    INTO v_responsavel_config_id, v_responsavel_user_id, v_responsavel_nome
    FROM public.configuracoes_usuarios usuario
    WHERE usuario.empresa_id = v_empresa_id
      AND usuario.auth_user_id = auth.uid()
      AND usuario.status = 'Ativo'
    ORDER BY (usuario.perfil_id IS NOT NULL) DESC, usuario.created_at DESC
    LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'Usuário operacional não encontrado'; END IF;
    v_rotina_id := NULL;
    v_modelo_id := NULL;
    v_origem := 'Usuario';
  END IF;

  IF v_revisor_user_id IS NOT NULL THEN
    SELECT usuario.nome INTO v_revisor_nome
    FROM public.configuracoes_usuarios usuario
    WHERE usuario.empresa_id = v_empresa_id
      AND usuario.auth_user_id = v_revisor_user_id
      AND usuario.status = 'Ativo'
      AND public.usuario_pode_revisar_atividade(
        usuario.empresa_id, usuario.auth_user_id
      )
    ORDER BY (usuario.perfil_id IS NOT NULL) DESC, usuario.created_at DESC
    LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'Revisor não encontrado'; END IF;
    IF v_revisor_user_id = v_responsavel_user_id THEN
      RAISE EXCEPTION 'Responsável e revisor devem ser pessoas diferentes'
        USING ERRCODE = '22023';
    END IF;
  ELSE
    v_revisor_nome := NULL;
  END IF;

  IF v_cliente_id IS NOT NULL THEN
    SELECT cliente.nome INTO v_cliente_nome
    FROM public.clientes cliente
    WHERE cliente.id = v_cliente_id
      AND cliente.empresa_id = v_empresa_id
      AND cliente.status = 'Ativa'
      AND public.current_user_can_access_client_row(cliente.empresa_id, cliente.id);
    IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
  ELSIF lower(coalesce(v_cliente_nome, '')) IN ('', 'escritório', 'escritorio') THEN
    v_cliente_id := NULL;
    v_cliente_nome := 'Escritório';
  ELSE
    SELECT (array_agg(cliente.id ORDER BY cliente.id))[1],
      (array_agg(cliente.nome ORDER BY cliente.id))[1], count(*)
    INTO v_cliente_id, v_cliente_nome, v_matches
    FROM public.clientes cliente
    WHERE cliente.empresa_id = v_empresa_id
      AND cliente.status = 'Ativa'
      AND public.current_user_can_access_client_row(cliente.empresa_id, cliente.id)
      AND lower(btrim(cliente.nome)) = lower(btrim(v_cliente_nome));
    IF v_matches <> 1 THEN RAISE EXCEPTION 'Cliente não encontrado ou ambíguo'; END IF;
  END IF;
  IF NOT coalesce(
    public.current_user_can_access_client_row(v_empresa_id, v_cliente_id), false
  ) THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;

  IF v_rotina_id IS NOT NULL THEN
    SELECT rotina.* INTO v_rotina
    FROM public.atividades_rotinas rotina
    WHERE rotina.id = v_rotina_id
      AND rotina.empresa_id = v_empresa_id
      AND rotina.ativa = true
      AND rotina.cliente_id IS NOT DISTINCT FROM v_cliente_id
      AND public.current_user_can_access_client_row(rotina.empresa_id, rotina.cliente_id);
    IF NOT FOUND THEN RAISE EXCEPTION 'Rotina incompatível com a tarefa'; END IF;
    v_modelo_id := v_rotina.modelo_id;
  END IF;

  IF v_nova THEN
    INSERT INTO public.atividades_tarefas (
      empresa_id, rotina_id, modelo_id, cliente_id, titulo, categoria,
      frequencia, responsavel_nome, responsavel_user_id,
      responsavel_config_usuario_id, cliente_nome, competencia, vencimento,
      prazo_legal, prazo_interno, prioridade, status, origem, checklist, notas,
      observacao_falta, revisor_user_id, revisor_nome, revisao_status, ativo
    ) VALUES (
      v_empresa_id, v_rotina_id, v_modelo_id, v_cliente_id, v_titulo, v_categoria,
      v_frequencia, v_responsavel_nome, v_responsavel_user_id,
      v_responsavel_config_id, v_cliente_nome, to_char(v_vencimento, 'MM/YYYY'),
      v_vencimento, v_prazo_legal, v_prazo_interno, v_prioridade, 'Pendente',
      v_origem, v_checklist, v_notas, v_observacao_falta, v_revisor_user_id,
      v_revisor_nome,
      CASE WHEN v_revisor_user_id IS NULL THEN 'Não necessária' ELSE 'Pendente' END,
      true
    ) RETURNING * INTO v_resultado;
    PERFORM public.registrar_evento_tarefa_operacional(
      v_empresa_id, v_resultado.id, 'criada', NULL,
      jsonb_build_object('competencia', to_char(v_vencimento, 'MM/YYYY'))
    );
  ELSE
    UPDATE public.atividades_tarefas
    SET rotina_id = v_rotina_id, modelo_id = v_modelo_id,
        cliente_id = v_cliente_id, titulo = v_titulo, categoria = v_categoria,
        frequencia = v_frequencia, responsavel_nome = v_responsavel_nome,
        responsavel_user_id = v_responsavel_user_id,
        responsavel_config_usuario_id = v_responsavel_config_id,
        cliente_nome = v_cliente_nome,
        competencia = to_char(v_vencimento, 'MM/YYYY'),
        vencimento = v_vencimento, prazo_legal = v_prazo_legal,
        prazo_interno = v_prazo_interno, prioridade = v_prioridade,
        origem = v_origem, notas = v_notas,
        observacao_falta = v_observacao_falta,
        revisor_user_id = v_revisor_user_id, revisor_nome = v_revisor_nome,
        revisao_status = CASE
          WHEN v_revisor_user_id IS NULL THEN 'Não necessária'
          WHEN v_revisor_user_id IS DISTINCT FROM v_tarefa.revisor_user_id THEN 'Pendente'
          ELSE v_tarefa.revisao_status
        END,
        revisado_por_user_id = CASE
          WHEN v_revisor_user_id IS DISTINCT FROM v_tarefa.revisor_user_id THEN NULL
          ELSE v_tarefa.revisado_por_user_id END,
        revisado_em = CASE
          WHEN v_revisor_user_id IS DISTINCT FROM v_tarefa.revisor_user_id THEN NULL
          ELSE v_tarefa.revisado_em END,
        atualizado_em = v_agora
    WHERE id = p_tarefa_id AND empresa_id = v_empresa_id
    RETURNING * INTO v_resultado;
    PERFORM public.registrar_evento_tarefa_operacional(
      v_empresa_id, p_tarefa_id, 'dados_atualizados', NULL,
      jsonb_build_object('competencia', to_char(v_vencimento, 'MM/YYYY'))
    );
  END IF;
  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_tarefa_operacional(uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.salvar_tarefa_operacional(uuid, jsonb)
  TO authenticated;

COMMIT;
