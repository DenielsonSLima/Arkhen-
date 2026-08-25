-- Centraliza criacao/edicao de tarefas, limita update-own a progresso e deriva
-- tenant, responsavel proprio e horario de conclusao no servidor.

CREATE OR REPLACE FUNCTION public.salvar_atividade_tarefa(
  p_tarefa_id uuid,
  p_payload jsonb
)
RETURNS public.atividades_tarefas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_tarefa public.atividades_tarefas%rowtype;
  v_resultado public.atividades_tarefas%rowtype;
  v_manage boolean;
  v_update_own boolean;
  v_nova boolean := p_tarefa_id IS NULL;
  v_agora timestamptz := now();
  v_rotina_id uuid;
  v_cliente_id uuid;
  v_responsavel_user_id uuid;
  v_responsavel_config_id uuid;
  v_titulo text;
  v_categoria text;
  v_frequencia text;
  v_responsavel_nome text;
  v_cliente_nome text;
  v_competencia text;
  v_vencimento date;
  v_prioridade text;
  v_status text;
  v_origem text;
  v_checklist jsonb;
  v_notas text;
  v_observacao_falta text;
  v_ativo boolean;
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
      'rotina_id','cliente_id','titulo','categoria','frequencia','responsavel_nome',
      'responsavel_user_id','responsavel_config_usuario_id','cliente_nome',
      'vencimento','prioridade','status','origem','checklist','notas',
      'observacao_falta','ativo'
    ]::text[])
  ) THEN
    RAISE EXCEPTION 'Campo de tarefa não permitido' USING ERRCODE = '22023';
  END IF;

  v_manage := coalesce(
    public.current_user_has_permission(v_empresa_id, 'atividades:manage'), false
  );
  IF NOT v_nova THEN
    SELECT t.* INTO v_tarefa
    FROM public.atividades_tarefas t
    WHERE t.id = p_tarefa_id
      AND t.empresa_id = v_empresa_id
      AND t.ativo = true
      AND public.current_user_can_access_client_row(t.empresa_id, t.cliente_id)
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Tarefa não encontrada'; END IF;
    v_update_own := coalesce(
      public.current_user_has_permission(v_empresa_id, 'atividades:update-own'), false
    ) AND coalesce(v_tarefa.responsavel_user_id = auth.uid(), false);
    IF NOT v_manage AND NOT v_update_own THEN RAISE EXCEPTION 'Tarefa não encontrada'; END IF;
  ELSE
    v_update_own := coalesce(
      public.current_user_has_permission(v_empresa_id, 'atividades:update-own'), false
    );
    IF NOT v_manage AND NOT v_update_own THEN
      RAISE EXCEPTION 'Sem permissão para criar tarefa' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Um gestor sempre pode arquivar uma tarefa, inclusive dado legado malformado.
  IF NOT v_nova AND v_manage AND p_payload = '{"ativo":false}'::jsonb THEN
    UPDATE public.atividades_tarefas
    SET ativo = false, atualizado_em = v_agora
    WHERE id = p_tarefa_id AND empresa_id = v_empresa_id
    RETURNING * INTO v_resultado;
    RETURN v_resultado;
  END IF;

  v_rotina_id := CASE WHEN v_nova THEN NULL ELSE v_tarefa.rotina_id END;
  v_cliente_id := CASE WHEN v_nova THEN NULL ELSE v_tarefa.cliente_id END;
  v_responsavel_user_id := CASE WHEN v_nova THEN NULL ELSE v_tarefa.responsavel_user_id END;
  v_responsavel_config_id := CASE WHEN v_nova THEN NULL ELSE v_tarefa.responsavel_config_usuario_id END;
  v_titulo := CASE WHEN v_nova THEN NULL ELSE v_tarefa.titulo END;
  v_categoria := CASE WHEN v_nova THEN 'Controle' ELSE v_tarefa.categoria END;
  v_frequencia := CASE WHEN v_nova THEN 'Única' ELSE v_tarefa.frequencia END;
  v_responsavel_nome := CASE WHEN v_nova THEN '' ELSE v_tarefa.responsavel_nome END;
  v_cliente_nome := CASE WHEN v_nova THEN 'Escritório' ELSE v_tarefa.cliente_nome END;
  v_competencia := CASE WHEN v_nova THEN NULL ELSE v_tarefa.competencia END;
  v_vencimento := CASE WHEN v_nova THEN current_date ELSE v_tarefa.vencimento END;
  v_prioridade := CASE WHEN v_nova THEN 'Média' ELSE v_tarefa.prioridade END;
  v_status := CASE WHEN v_nova THEN 'Pendente' ELSE v_tarefa.status END;
  v_origem := CASE WHEN v_nova THEN 'Usuario' ELSE v_tarefa.origem END;
  v_checklist := CASE
    WHEN v_nova THEN '[]'::jsonb ELSE coalesce(v_tarefa.checklist, '[]'::jsonb)
  END;
  v_notas := CASE WHEN v_nova THEN '' ELSE coalesce(v_tarefa.notas, '') END;
  v_observacao_falta := CASE WHEN v_nova THEN NULL ELSE v_tarefa.observacao_falta END;
  v_ativo := CASE WHEN v_nova THEN true ELSE v_tarefa.ativo END;

  -- Campos estruturais so sao aplicados para gestor ou durante criacao propria.
  IF v_manage OR v_nova THEN
    BEGIN
      IF p_payload ? 'rotina_id' THEN
        v_rotina_id := NULLIF(p_payload ->> 'rotina_id', '')::uuid;
      END IF;
      IF p_payload ? 'cliente_id' THEN
        v_cliente_id := NULLIF(p_payload ->> 'cliente_id', '')::uuid;
      END IF;
      IF p_payload ? 'responsavel_user_id' THEN
        v_responsavel_user_id := NULLIF(p_payload ->> 'responsavel_user_id', '')::uuid;
      END IF;
      IF p_payload ? 'responsavel_config_usuario_id' THEN
        v_responsavel_config_id := NULLIF(
          p_payload ->> 'responsavel_config_usuario_id', ''
        )::uuid;
      END IF;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Identificador de tarefa inválido' USING ERRCODE = '22023';
    END;
    IF p_payload ? 'titulo' THEN v_titulo := btrim(p_payload ->> 'titulo'); END IF;
    IF p_payload ? 'categoria' THEN v_categoria := p_payload ->> 'categoria'; END IF;
    IF p_payload ? 'frequencia' THEN v_frequencia := p_payload ->> 'frequencia'; END IF;
    IF p_payload ? 'responsavel_nome' THEN
      v_responsavel_nome := btrim(p_payload ->> 'responsavel_nome');
    END IF;
    IF p_payload ? 'cliente_nome' THEN
      v_cliente_nome := btrim(p_payload ->> 'cliente_nome');
    END IF;
    IF p_payload ? 'prioridade' THEN v_prioridade := p_payload ->> 'prioridade'; END IF;
    IF p_payload ? 'origem' THEN v_origem := p_payload ->> 'origem'; END IF;
    IF p_payload ? 'ativo' THEN
      IF jsonb_typeof(p_payload -> 'ativo') IS DISTINCT FROM 'boolean' THEN
        RAISE EXCEPTION 'Indicador ativo inválido' USING ERRCODE = '22023';
      END IF;
      v_ativo := (p_payload ->> 'ativo')::boolean;
    END IF;
    IF p_payload ? 'vencimento' THEN
      IF (p_payload ->> 'vencimento') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
        RAISE EXCEPTION 'Vencimento inválido' USING ERRCODE = '22023';
      END IF;
      BEGIN
        v_vencimento := (p_payload ->> 'vencimento')::date;
      EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
        RAISE EXCEPTION 'Vencimento inválido' USING ERRCODE = '22023';
      END;
    END IF;
  END IF;

  -- Progresso proprio: somente estes quatro campos chegam ao UPDATE.
  IF p_payload ? 'status' THEN v_status := p_payload ->> 'status'; END IF;
  IF p_payload ? 'checklist' THEN v_checklist := p_payload -> 'checklist'; END IF;
  IF p_payload ? 'notas' THEN v_notas := coalesce(p_payload ->> 'notas', ''); END IF;
  IF p_payload ? 'observacao_falta' THEN
    v_observacao_falta := NULLIF(btrim(p_payload ->> 'observacao_falta'), '');
  END IF;
  IF NOT v_manage AND NOT v_nova
     AND NOT (
       p_payload ? 'status' OR p_payload ? 'checklist'
       OR p_payload ? 'notas' OR p_payload ? 'observacao_falta'
     ) THEN
    RAISE EXCEPTION 'Nenhum campo de progresso permitido foi informado'
      USING ERRCODE = '42501';
  END IF;

  IF NULLIF(v_titulo, '') IS NULL OR octet_length(v_titulo) > 240
     OR v_categoria NOT IN ('Interna','Cliente','Fiscal','Folha','Contábil','Controle')
     OR v_frequencia NOT IN ('Diária','Semanal','Quinzenal','Mensal','Personalizada','Única')
     OR v_prioridade NOT IN ('Baixa','Média','Alta')
     OR v_status NOT IN ('Pendente','Em andamento','Concluída')
     OR v_origem NOT IN ('Rotina','Manual','Usuario','Gestor')
     OR octet_length(coalesce(v_responsavel_nome, '')) > 240
     OR octet_length(coalesce(v_cliente_nome, '')) > 240
     OR octet_length(coalesce(v_notas, '')) > 10000
     OR octet_length(coalesce(v_observacao_falta, '')) > 2000 THEN
    RAISE EXCEPTION 'Dados de tarefa inválidos' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_checklist) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Checklist inválido' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(v_checklist) > 100 OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_checklist) item
    WHERE jsonb_typeof(item) IS DISTINCT FROM 'object'
  ) THEN
    RAISE EXCEPTION 'Checklist inválido' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_checklist) item
    WHERE NULLIF(btrim(item ->> 'titulo'), '') IS NULL
       OR octet_length(item ->> 'titulo') > 500
       OR jsonb_typeof(item -> 'concluida') IS DISTINCT FROM 'boolean'
       OR EXISTS (
         SELECT 1 FROM jsonb_object_keys(item) chave
         WHERE chave NOT IN ('titulo', 'concluida')
       )
  ) THEN
    RAISE EXCEPTION 'Checklist inválido' USING ERRCODE = '22023';
  END IF;

  IF v_manage THEN
    IF v_rotina_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.atividades_rotinas r
      WHERE r.id = v_rotina_id AND r.empresa_id = v_empresa_id
        AND public.current_user_can_access_client_row(r.empresa_id, r.cliente_id)
    ) THEN
      RAISE EXCEPTION 'Rotina não encontrada';
    END IF;
    IF v_responsavel_config_id IS NOT NULL OR v_responsavel_user_id IS NOT NULL THEN
      SELECT u.id, u.auth_user_id, u.nome
      INTO v_responsavel_config_id, v_responsavel_user_id, v_responsavel_nome
      FROM public.configuracoes_usuarios u
      WHERE u.empresa_id = v_empresa_id AND u.status = 'Ativo'
        AND (u.id = v_responsavel_config_id OR u.auth_user_id = v_responsavel_user_id)
      ORDER BY (u.id = v_responsavel_config_id) DESC,
        (u.perfil_id IS NOT NULL) DESC, u.created_at DESC
      LIMIT 1;
      IF NOT FOUND THEN RAISE EXCEPTION 'Responsável não encontrado'; END IF;
    END IF;
  ELSE
    SELECT u.id, u.nome INTO v_responsavel_config_id, v_responsavel_nome
    FROM public.configuracoes_usuarios u
    WHERE u.empresa_id = v_empresa_id AND u.auth_user_id = auth.uid()
      AND u.status = 'Ativo'
    ORDER BY (u.perfil_id IS NOT NULL) DESC, u.created_at DESC LIMIT 1;
    v_responsavel_user_id := auth.uid();
    v_responsavel_nome := coalesce(NULLIF(v_responsavel_nome, ''), auth.uid()::text);
    v_rotina_id := NULL;
    v_origem := 'Usuario';
    v_ativo := true;
  END IF;

  IF v_cliente_id IS NOT NULL AND (v_manage OR v_nova) THEN
    SELECT c.nome INTO v_cliente_nome
    FROM public.clientes c
    WHERE c.id = v_cliente_id
      AND c.empresa_id = v_empresa_id
      AND public.current_user_can_access_client_row(c.empresa_id, c.id);
    IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
  ELSIF lower(coalesce(v_cliente_nome, '')) IN ('', 'escritório', 'escritorio') THEN
    v_cliente_id := NULL;
    v_cliente_nome := 'Escritório';
  ELSIF v_manage OR v_nova THEN
    SELECT (array_agg(c.id ORDER BY c.id))[1],
      (array_agg(c.nome ORDER BY c.id))[1], count(*)
    INTO v_cliente_id, v_cliente_nome, v_matches
    FROM public.clientes c
    WHERE c.empresa_id = v_empresa_id
      AND public.current_user_can_access_client_row(c.empresa_id, c.id)
      AND lower(btrim(c.nome)) = lower(btrim(v_cliente_nome));
    IF v_matches <> 1 THEN
      RAISE EXCEPTION 'Cliente não encontrado ou ambíguo';
    END IF;
  END IF;
  IF NOT coalesce(
    public.current_user_can_access_client_row(v_empresa_id, v_cliente_id), false
  ) THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;
  IF v_rotina_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.atividades_rotinas r
    WHERE r.id = v_rotina_id
      AND r.empresa_id = v_empresa_id
      AND r.cliente_id IS NOT DISTINCT FROM v_cliente_id
  ) THEN
    RAISE EXCEPTION 'Rotina incompatível com o cliente informado'
      USING ERRCODE = '22023';
  END IF;

  v_competencia := coalesce(v_competencia, to_char(v_vencimento, 'MM/YYYY'));
  IF v_nova THEN
    INSERT INTO public.atividades_tarefas (
      empresa_id, rotina_id, cliente_id, titulo, categoria, frequencia,
      responsavel_nome, responsavel_user_id, responsavel_config_usuario_id,
      cliente_nome, competencia, vencimento, prioridade, status, origem,
      checklist, notas, data_hora_conclusao, observacao_falta, ativo
    ) VALUES (
      v_empresa_id, v_rotina_id, v_cliente_id, v_titulo, v_categoria, v_frequencia,
      v_responsavel_nome, v_responsavel_user_id, v_responsavel_config_id,
      v_cliente_nome, v_competencia, v_vencimento, v_prioridade, v_status, v_origem,
      v_checklist, v_notas,
      CASE WHEN v_status = 'Concluída' THEN v_agora ELSE NULL END,
      v_observacao_falta, true
    ) RETURNING * INTO v_resultado;
  ELSIF NOT v_manage THEN
    UPDATE public.atividades_tarefas
    SET status = v_status, checklist = v_checklist, notas = v_notas,
        data_hora_conclusao = CASE
          WHEN v_status <> 'Concluída' THEN NULL
          WHEN v_tarefa.status IS DISTINCT FROM 'Concluída'
            OR v_tarefa.data_hora_conclusao IS NULL THEN v_agora
          ELSE v_tarefa.data_hora_conclusao
        END,
        observacao_falta = v_observacao_falta,
        atualizado_em = v_agora
    WHERE id = p_tarefa_id AND empresa_id = v_empresa_id
    RETURNING * INTO v_resultado;
  ELSE
    UPDATE public.atividades_tarefas
    SET rotina_id = v_rotina_id, cliente_id = v_cliente_id, titulo = v_titulo,
        categoria = v_categoria, frequencia = v_frequencia,
        responsavel_nome = v_responsavel_nome,
        responsavel_user_id = v_responsavel_user_id,
        responsavel_config_usuario_id = v_responsavel_config_id,
        cliente_nome = v_cliente_nome, vencimento = v_vencimento,
        prioridade = v_prioridade, status = v_status, origem = v_origem,
        checklist = v_checklist, notas = v_notas,
        data_hora_conclusao = CASE
          WHEN v_status <> 'Concluída' THEN NULL
          WHEN v_tarefa.status IS DISTINCT FROM 'Concluída'
            OR v_tarefa.data_hora_conclusao IS NULL THEN v_agora
          ELSE v_tarefa.data_hora_conclusao
        END,
        observacao_falta = v_observacao_falta, ativo = v_ativo,
        atualizado_em = v_agora
    WHERE id = p_tarefa_id AND empresa_id = v_empresa_id
    RETURNING * INTO v_resultado;
  END IF;
  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_atividade_tarefa(uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.salvar_atividade_tarefa(uuid, jsonb)
  TO authenticated, service_role;

REVOKE ALL ON TABLE public.atividades_tarefas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.atividades_tarefas TO authenticated;
REVOKE ALL ON TABLE public.atividades_instancias FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.atividades_instancias TO authenticated;
