-- EXPAND: mutações mínimas de progresso, conclusão e revisão, sempre com ator
-- e horário derivados pelo servidor. Nenhum campo de auditoria é aceito do cliente.
BEGIN;

CREATE OR REPLACE FUNCTION public.atualizar_progresso_tarefa_operacional(
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
  v_manage boolean;
  v_update_own boolean;
  v_notas text;
  v_observacao text;
  v_evidencia text;
  v_justificativa text;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR p_payload = '{}'::jsonb
     OR octet_length(p_payload::text) > 32768
     OR EXISTS (
       SELECT 1 FROM jsonb_object_keys(p_payload) campo(chave)
       WHERE campo.chave NOT IN (
         'notas', 'observacao_falta', 'evidencia', 'justificativa_conclusao'
       )
     ) THEN
    RAISE EXCEPTION 'Progresso inválido' USING ERRCODE = '22023';
  END IF;

  SELECT tarefa.* INTO v_tarefa
  FROM public.atividades_tarefas tarefa
  WHERE tarefa.id = p_tarefa_id
    AND tarefa.empresa_id = v_empresa_id
    AND tarefa.ativo = true
    AND public.current_user_can_access_client_row(tarefa.empresa_id, tarefa.cliente_id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tarefa não encontrada'; END IF;

  v_manage := coalesce(
    public.current_user_has_permission(v_empresa_id, 'atividades:manage'), false
  );
  v_update_own := coalesce(
    public.current_user_has_permission(v_empresa_id, 'atividades:update-own'), false
  ) AND v_tarefa.responsavel_user_id = auth.uid();
  IF NOT v_manage AND NOT v_update_own THEN RAISE EXCEPTION 'Tarefa não encontrada'; END IF;
  IF v_tarefa.status IN ('Aguardando revisão', 'Concluída', 'Cancelada') THEN
    RAISE EXCEPTION 'Reabra a tarefa antes de alterar o progresso'
      USING ERRCODE = '22023';
  END IF;

  v_notas := CASE WHEN p_payload ? 'notas'
    THEN coalesce(p_payload ->> 'notas', '') ELSE coalesce(v_tarefa.notas, '') END;
  v_observacao := CASE WHEN p_payload ? 'observacao_falta'
    THEN NULLIF(btrim(p_payload ->> 'observacao_falta'), '')
    ELSE v_tarefa.observacao_falta END;
  v_evidencia := CASE WHEN p_payload ? 'evidencia'
    THEN NULLIF(btrim(p_payload ->> 'evidencia'), '') ELSE v_tarefa.evidencia END;
  v_justificativa := CASE WHEN p_payload ? 'justificativa_conclusao'
    THEN NULLIF(btrim(p_payload ->> 'justificativa_conclusao'), '')
    ELSE v_tarefa.justificativa_conclusao END;

  IF octet_length(v_notas) > 10000
     OR octet_length(coalesce(v_observacao, '')) > 2000
     OR octet_length(coalesce(v_evidencia, '')) > 10000
     OR octet_length(coalesce(v_justificativa, '')) > 4000 THEN
    RAISE EXCEPTION 'Texto de progresso excede o limite' USING ERRCODE = '22023';
  END IF;

  UPDATE public.atividades_tarefas
  SET notas = v_notas,
      observacao_falta = v_observacao,
      evidencia = v_evidencia,
      justificativa_conclusao = v_justificativa,
      atualizado_em = now()
  WHERE id = p_tarefa_id AND empresa_id = v_empresa_id
  RETURNING * INTO v_resultado;

  PERFORM public.registrar_evento_tarefa_operacional(
    v_empresa_id, p_tarefa_id, 'dados_atualizados', NULL,
    jsonb_build_object('campos', ARRAY(SELECT jsonb_object_keys(p_payload)))
  );
  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.atualizar_progresso_tarefa_operacional(uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atualizar_progresso_tarefa_operacional(uuid, jsonb)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.atualizar_tarefa_operacional_checklist(
  p_tarefa_id uuid,
  p_indice integer,
  p_concluida boolean,
  p_evidencia text DEFAULT NULL,
  p_justificativa text DEFAULT NULL
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
  v_manage boolean;
  v_update_own boolean;
  v_checklist jsonb;
  v_item jsonb;
  v_todas boolean;
  v_alguma boolean;
  v_status text;
  v_evidencia text;
  v_justificativa text;
  v_agora timestamptz := now();
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL OR p_tarefa_id IS NULL
     OR p_indice IS NULL OR p_indice < 0 OR p_concluida IS NULL THEN
    RAISE EXCEPTION 'Atualização de checklist inválida' USING ERRCODE = '22023';
  END IF;
  SELECT tarefa.* INTO v_tarefa
  FROM public.atividades_tarefas tarefa
  WHERE tarefa.id = p_tarefa_id
    AND tarefa.empresa_id = v_empresa_id
    AND tarefa.ativo = true
    AND public.current_user_can_access_client_row(tarefa.empresa_id, tarefa.cliente_id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tarefa não encontrada'; END IF;

  v_manage := coalesce(
    public.current_user_has_permission(v_empresa_id, 'atividades:manage'), false
  );
  v_update_own := coalesce(
    public.current_user_has_permission(v_empresa_id, 'atividades:update-own'), false
  ) AND v_tarefa.responsavel_user_id = auth.uid();
  IF NOT v_manage AND NOT v_update_own THEN RAISE EXCEPTION 'Tarefa não encontrada'; END IF;
  IF v_tarefa.status IN ('Aguardando revisão', 'Concluída') THEN
    RAISE EXCEPTION 'Rejeite ou reabra a tarefa antes de alterar o checklist'
      USING ERRCODE = '22023';
  END IF;
  IF v_tarefa.status = 'Cancelada' OR NOT public.atividade_checklist_valido(v_tarefa.checklist)
     OR p_indice >= jsonb_array_length(v_tarefa.checklist) THEN
    RAISE EXCEPTION 'Etapa de checklist inválida' USING ERRCODE = '22023';
  END IF;

  v_item := v_tarefa.checklist -> p_indice;
  IF (v_item ->> 'concluida')::boolean = p_concluida THEN RETURN v_tarefa; END IF;

  v_justificativa := coalesce(
    NULLIF(btrim(p_justificativa), ''), v_tarefa.justificativa_conclusao
  );
  v_evidencia := coalesce(NULLIF(btrim(p_evidencia), ''), v_tarefa.evidencia);
  IF octet_length(coalesce(v_evidencia, '')) > 10000
     OR octet_length(coalesce(v_justificativa, '')) > 4000 THEN
    RAISE EXCEPTION 'Evidência ou justificativa excede o limite'
      USING ERRCODE = '22023';
  END IF;

  v_checklist := jsonb_set(
    v_tarefa.checklist,
    ARRAY[p_indice::text, 'concluida'],
    to_jsonb(p_concluida),
    false
  );
  SELECT bool_and((item ->> 'concluida')::boolean),
         bool_or((item ->> 'concluida')::boolean)
  INTO v_todas, v_alguma
  FROM jsonb_array_elements(v_checklist) item;

  IF v_todas AND NULLIF(v_evidencia, '') IS NULL
     AND NULLIF(v_justificativa, '') IS NULL THEN
    RAISE EXCEPTION 'Informe evidência ou justificativa antes de concluir'
      USING ERRCODE = '22023';
  END IF;
  v_status := CASE
    WHEN v_todas AND v_tarefa.revisor_user_id IS NOT NULL THEN 'Aguardando revisão'
    WHEN v_todas THEN 'Concluída'
    WHEN v_alguma THEN 'Em andamento'
    ELSE 'Pendente'
  END;

  UPDATE public.atividades_tarefas
  SET checklist = v_checklist,
      status = v_status,
      evidencia = v_evidencia,
      justificativa_conclusao = v_justificativa,
      conclusao_solicitada_por_user_id = CASE
        WHEN v_todas THEN auth.uid()
        WHEN status = 'Aguardando revisão' THEN NULL
        ELSE conclusao_solicitada_por_user_id END,
      conclusao_solicitada_em = CASE
        WHEN v_todas THEN v_agora
        WHEN status = 'Aguardando revisão' THEN NULL
        ELSE conclusao_solicitada_em END,
      revisao_status = CASE
        WHEN revisor_user_id IS NULL THEN 'Não necessária'
        WHEN v_todas THEN 'Pendente'
        ELSE 'Pendente' END,
      revisado_por_user_id = CASE WHEN v_todas THEN NULL ELSE revisado_por_user_id END,
      revisado_em = CASE WHEN v_todas THEN NULL ELSE revisado_em END,
      concluido_por_user_id = CASE
        WHEN v_todas AND revisor_user_id IS NULL
             AND status IS DISTINCT FROM 'Concluída' THEN auth.uid()
        ELSE concluido_por_user_id END,
      concluido_em = CASE
        WHEN v_todas AND revisor_user_id IS NULL
             AND status IS DISTINCT FROM 'Concluída' THEN v_agora
        ELSE concluido_em END,
      data_hora_conclusao = CASE
        WHEN v_todas AND revisor_user_id IS NULL
             AND status IS DISTINCT FROM 'Concluída' THEN v_agora
        ELSE data_hora_conclusao END,
      atualizado_em = v_agora
  WHERE id = p_tarefa_id AND empresa_id = v_empresa_id
  RETURNING * INTO v_resultado;

  PERFORM public.registrar_evento_tarefa_operacional(
    v_empresa_id, p_tarefa_id, 'checklist', NULL,
    jsonb_build_object(
      'indice', p_indice, 'titulo', v_item ->> 'titulo',
      'concluida', p_concluida, 'status', v_status
    )
  );
  IF v_todas THEN
    PERFORM public.registrar_evento_tarefa_operacional(
      v_empresa_id, p_tarefa_id,
      CASE WHEN v_tarefa.revisor_user_id IS NULL
        THEN 'concluida' ELSE 'conclusao_solicitada' END,
      v_justificativa,
      jsonb_build_object('evidenciaInformada', NULLIF(v_evidencia, '') IS NOT NULL)
    );
  END IF;
  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.atualizar_tarefa_operacional_checklist(
  uuid, integer, boolean, text, text
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atualizar_tarefa_operacional_checklist(
  uuid, integer, boolean, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.revisar_tarefa_operacional(
  p_tarefa_id uuid,
  p_aprovar boolean,
  p_justificativa text DEFAULT NULL
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
  v_agora timestamptz := now();
  v_motivo text := NULLIF(btrim(p_justificativa), '');
  v_indice_reaberto integer;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL OR p_aprovar IS NULL
     OR octet_length(coalesce(v_motivo, '')) > 4000 THEN
    RAISE EXCEPTION 'Revisão inválida' USING ERRCODE = '22023';
  END IF;
  SELECT tarefa.* INTO v_tarefa
  FROM public.atividades_tarefas tarefa
  WHERE tarefa.id = p_tarefa_id
    AND tarefa.empresa_id = v_empresa_id
    AND tarefa.ativo = true
    AND tarefa.status = 'Aguardando revisão'
    AND tarefa.revisor_user_id = auth.uid()
    AND public.current_user_can_access_client_row(tarefa.empresa_id, tarefa.cliente_id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tarefa não encontrada para revisão'; END IF;
  IF NOT coalesce(
    public.current_user_has_permission(v_empresa_id, 'atividades:manage')
    OR public.current_user_has_permission(v_empresa_id, 'atividades:update-own'), false
  ) OR NOT EXISTS (
    SELECT 1 FROM public.configuracoes_usuarios usuario
    WHERE usuario.empresa_id = v_empresa_id
      AND usuario.auth_user_id = auth.uid() AND usuario.status = 'Ativo'
  ) THEN
    RAISE EXCEPTION 'Tarefa não encontrada para revisão';
  END IF;
  IF NOT p_aprovar AND (v_motivo IS NULL OR char_length(v_motivo) < 8) THEN
    RAISE EXCEPTION 'Informe um motivo da rejeição com pelo menos 8 caracteres'
      USING ERRCODE = '22023';
  END IF;

  IF NOT p_aprovar THEN
    IF NOT public.atividade_checklist_valido(v_tarefa.checklist) THEN
      RAISE EXCEPTION 'Checklist inválido para devolução'
        USING ERRCODE = '22023';
    END IF;
    v_indice_reaberto := jsonb_array_length(v_tarefa.checklist) - 1;
    PERFORM public.registrar_evento_tarefa_operacional(
      v_empresa_id, p_tarefa_id, 'revisao_rejeitada', v_motivo,
      jsonb_build_object(
        'evidenciaAnterior', v_tarefa.evidencia,
        'justificativaAnterior', v_tarefa.justificativa_conclusao,
        'solicitadaEm', v_tarefa.conclusao_solicitada_em,
        'indiceReaberto', v_indice_reaberto
      )
    );
  END IF;

  UPDATE public.atividades_tarefas
  SET checklist = CASE WHEN p_aprovar THEN checklist ELSE jsonb_set(
        checklist,
        ARRAY[v_indice_reaberto::text, 'concluida'],
        'false'::jsonb,
        false
      ) END,
      status = CASE WHEN p_aprovar THEN 'Concluída' ELSE 'Em andamento' END,
      revisao_status = CASE WHEN p_aprovar THEN 'Aprovada' ELSE 'Rejeitada' END,
      revisado_por_user_id = auth.uid(), revisado_em = v_agora,
      evidencia = CASE WHEN p_aprovar THEN evidencia ELSE NULL END,
      justificativa_conclusao = CASE
        WHEN p_aprovar THEN justificativa_conclusao ELSE NULL END,
      conclusao_solicitada_por_user_id = CASE
        WHEN p_aprovar THEN conclusao_solicitada_por_user_id ELSE NULL END,
      conclusao_solicitada_em = CASE
        WHEN p_aprovar THEN conclusao_solicitada_em ELSE NULL END,
      concluido_por_user_id = CASE WHEN p_aprovar THEN
        coalesce(conclusao_solicitada_por_user_id, responsavel_user_id)
        ELSE NULL END,
      concluido_em = CASE WHEN p_aprovar THEN v_agora ELSE NULL END,
      data_hora_conclusao = CASE WHEN p_aprovar THEN v_agora ELSE NULL END,
      atualizado_em = v_agora
  WHERE id = p_tarefa_id AND empresa_id = v_empresa_id
  RETURNING * INTO v_resultado;

  IF p_aprovar THEN
    PERFORM public.registrar_evento_tarefa_operacional(
      v_empresa_id, p_tarefa_id, 'revisao_aprovada', v_motivo,
      jsonb_build_object('concluidaEm', v_agora)
    );
  END IF;
  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.revisar_tarefa_operacional(uuid, boolean, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revisar_tarefa_operacional(uuid, boolean, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.reabrir_tarefa_operacional(
  p_tarefa_id uuid,
  p_justificativa text
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
  v_motivo text := NULLIF(btrim(p_justificativa), '');
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL OR v_motivo IS NULL
     OR char_length(v_motivo) < 8
     OR octet_length(v_motivo) > 4000
     OR NOT coalesce(
       public.current_user_has_permission(v_empresa_id, 'atividades:manage'), false
     ) THEN
    RAISE EXCEPTION 'Sem permissão para reabrir tarefa' USING ERRCODE = '42501';
  END IF;
  SELECT tarefa.* INTO v_tarefa
  FROM public.atividades_tarefas tarefa
  WHERE tarefa.id = p_tarefa_id AND tarefa.empresa_id = v_empresa_id
    AND tarefa.ativo = true
    AND tarefa.status IN ('Aguardando revisão', 'Concluída')
    AND public.current_user_can_access_client_row(tarefa.empresa_id, tarefa.cliente_id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tarefa não encontrada'; END IF;

  PERFORM public.registrar_evento_tarefa_operacional(
    v_empresa_id, p_tarefa_id, 'reaberta', v_motivo,
    jsonb_build_object(
      'statusAnterior', v_tarefa.status,
      'evidenciaAnterior', v_tarefa.evidencia,
      'justificativaAnterior', v_tarefa.justificativa_conclusao,
      'concluidaEm', v_tarefa.concluido_em,
      'solicitadaEm', v_tarefa.conclusao_solicitada_em
    )
  );

  UPDATE public.atividades_tarefas
  SET status = 'Em andamento',
      revisao_status = CASE WHEN revisor_user_id IS NULL
        THEN 'Não necessária' ELSE 'Rejeitada' END,
      evidencia = NULL,
      justificativa_conclusao = NULL,
      conclusao_solicitada_por_user_id = NULL,
      conclusao_solicitada_em = NULL,
      revisado_por_user_id = NULL,
      revisado_em = NULL,
      concluido_por_user_id = NULL,
      concluido_em = NULL,
      data_hora_conclusao = NULL,
      atualizado_em = now()
  WHERE id = p_tarefa_id AND empresa_id = v_empresa_id
  RETURNING * INTO v_resultado;
  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.reabrir_tarefa_operacional(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reabrir_tarefa_operacional(uuid, text)
  TO authenticated;

COMMIT;
