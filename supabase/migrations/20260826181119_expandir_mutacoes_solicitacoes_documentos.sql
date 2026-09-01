-- EXPAND: escrita pelo novo contrato; os atores e horários vêm da sessão/servidor.
BEGIN;

CREATE OR REPLACE FUNCTION public.criar_solicitacao_documento_operacional(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_cliente_id uuid; v_responsavel_id uuid; v_revisor_id uuid; v_tarefa_id uuid;
  v_competencia date; v_data_limite date; v_titulo text; v_descricao text;
  v_id uuid; v_actor_name text; v_agora timestamptz := now();
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR octet_length(p_payload::text) > 8192 THEN
    RAISE EXCEPTION 'Solicitação inválida.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_payload) campo(chave)
    WHERE campo.chave <> ALL(ARRAY['cliente_id','competencia','titulo','descricao',
      'data_limite','responsavel_id','revisor_id','tarefa_id']::text[])) THEN
    RAISE EXCEPTION 'Campo não permitido na solicitação.' USING ERRCODE = '22023';
  END IF;
  IF NOT coalesce(public.current_user_has_permission(v_empresa_id, 'documentos:create')
    OR public.current_user_has_permission(v_empresa_id, 'documentos:manage'), false) THEN
    RAISE EXCEPTION 'Solicitação não encontrada.' USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_cliente_id := nullif(p_payload ->> 'cliente_id', '')::uuid;
    v_responsavel_id := nullif(p_payload ->> 'responsavel_id', '')::uuid;
    v_revisor_id := nullif(p_payload ->> 'revisor_id', '')::uuid;
    v_tarefa_id := nullif(p_payload ->> 'tarefa_id', '')::uuid;
    v_competencia := nullif(p_payload ->> 'competencia', '')::date;
    v_data_limite := nullif(p_payload ->> 'data_limite', '')::date;
  EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN
    RAISE EXCEPTION 'Identificadores ou datas inválidos.' USING ERRCODE = '22023';
  END;
  v_titulo := btrim(coalesce(p_payload ->> 'titulo', ''));
  v_descricao := nullif(btrim(p_payload ->> 'descricao'), '');
  IF v_cliente_id IS NULL OR v_responsavel_id IS NULL OR v_competencia IS NULL
     OR v_data_limite IS NULL OR v_competencia <> date_trunc('month', v_competencia)::date
     OR char_length(v_titulo) NOT BETWEEN 2 AND 160
     OR (v_descricao IS NOT NULL AND char_length(v_descricao) > 2000)
     OR v_responsavel_id IS NOT DISTINCT FROM v_revisor_id THEN
    RAISE EXCEPTION 'Dados obrigatórios da solicitação são inválidos.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clientes cliente
    WHERE cliente.id = v_cliente_id AND cliente.empresa_id = v_empresa_id
      AND public.current_user_can_access_client_row(cliente.empresa_id, cliente.id)) THEN
    RAISE EXCEPTION 'Solicitação não encontrada.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.configuracoes_usuarios usuario
    WHERE usuario.id = v_responsavel_id AND usuario.empresa_id = v_empresa_id
      AND usuario.status = 'Ativo' AND usuario.auth_user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Selecione um responsável ativo.' USING ERRCODE = '23514';
  END IF;
  IF v_revisor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.configuracoes_usuarios usuario
    WHERE usuario.id = v_revisor_id AND usuario.empresa_id = v_empresa_id
      AND usuario.status = 'Ativo' AND usuario.auth_user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Selecione um revisor ativo.' USING ERRCODE = '23514';
  END IF;
  IF v_tarefa_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.atividades_tarefas tarefa
    WHERE tarefa.id = v_tarefa_id AND tarefa.empresa_id = v_empresa_id
      AND tarefa.cliente_id = v_cliente_id AND tarefa.ativo = true
      AND public.current_user_can_access_client_row(tarefa.empresa_id, tarefa.cliente_id)
      AND CASE WHEN tarefa.competencia ~ '^[0-9]{2}/[0-9]{4}$'
        THEN right(tarefa.competencia, 4) || '-' || left(tarefa.competencia, 2)
        ELSE tarefa.competencia END = to_char(v_competencia, 'YYYY-MM')
      AND coalesce(
        public.current_user_has_permission(v_empresa_id, 'atividades:manage')
        OR ((public.current_user_has_permission(v_empresa_id, 'atividades:view')
          OR public.current_user_has_permission(v_empresa_id, 'atividades:update-own'))
          AND (tarefa.responsavel_user_id = auth.uid() OR tarefa.revisor_user_id = auth.uid()))
        OR (public.current_user_has_permission(v_empresa_id, 'atividades:view-own')
          AND tarefa.cliente_id IS NOT NULL
          AND public.current_user_has_client_access(v_empresa_id, tarefa.cliente_id)), false)) THEN
    RAISE EXCEPTION 'Atividade incompatível com cliente ou competência.' USING ERRCODE = '23514';
  END IF;

  SELECT nullif(btrim(usuario.nome), '') INTO v_actor_name
  FROM public.configuracoes_usuarios usuario
  WHERE usuario.empresa_id = v_empresa_id AND usuario.auth_user_id = auth.uid()
    AND usuario.status = 'Ativo' ORDER BY usuario.created_at DESC LIMIT 1;

  INSERT INTO public.documentos_solicitacoes (
    empresa_id, cliente_id, competencia, titulo, descricao, data_limite,
    responsavel_config_usuario_id, revisor_config_usuario_id, tarefa_id,
    status, criado_por, atualizado_por, auditoria_pendente, historico
  ) VALUES (
    v_empresa_id, v_cliente_id, v_competencia, v_titulo, v_descricao, v_data_limite,
    v_responsavel_id, v_revisor_id, v_tarefa_id, 'Pendente', auth.uid(), auth.uid(), false,
    jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'id', gen_random_uuid()::text, 'from', '', 'to', 'Pendente',
      'occurredAt', v_agora::text, 'actorUserId', auth.uid()::text,
      'actorName', v_actor_name, 'eventType', 'created'
    )))
  ) RETURNING id INTO v_id;
  RETURN public.documento_solicitacao_operacional_json(v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.criar_solicitacao_documento_operacional(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.criar_solicitacao_documento_operacional(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.transicionar_solicitacao_documento_operacional(
  p_id uuid, p_status text, p_justificativa text, p_documento_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_row public.documentos_solicitacoes%ROWTYPE;
  v_responsavel_auth uuid; v_revisor_auth uuid; v_actor_name text;
  v_justificativa text := btrim(coalesce(p_justificativa, ''));
  v_manage boolean; v_agora timestamptz := now();
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL OR p_id IS NULL
     OR p_status NOT IN ('Pendente','Recebido','Em conferência','Concluído','Cancelado')
     OR char_length(v_justificativa) NOT BETWEEN 8 AND 2000 THEN
    RAISE EXCEPTION 'Transição inválida; informe evidência ou justificativa.' USING ERRCODE = '22023';
  END IF;
  SELECT solicitacao.* INTO v_row FROM public.documentos_solicitacoes solicitacao
  WHERE solicitacao.id = p_id AND solicitacao.empresa_id = v_empresa_id
    AND public.current_user_can_access_client_row(solicitacao.empresa_id, solicitacao.cliente_id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.' USING ERRCODE = '42501'; END IF;

  SELECT usuario.auth_user_id INTO v_responsavel_auth FROM public.configuracoes_usuarios usuario
  WHERE usuario.id = v_row.responsavel_config_usuario_id AND usuario.empresa_id = v_empresa_id
    AND usuario.status = 'Ativo';
  SELECT usuario.auth_user_id INTO v_revisor_auth FROM public.configuracoes_usuarios usuario
  WHERE usuario.id = v_row.revisor_config_usuario_id AND usuario.empresa_id = v_empresa_id
    AND usuario.status = 'Ativo';
  v_manage := coalesce(
    public.current_user_has_permission(v_empresa_id, 'documentos:manage'), false);

  IF p_status = 'Recebido' AND NOT (v_row.status = 'Pendente' AND v_responsavel_auth = auth.uid()) THEN
    RAISE EXCEPTION 'Somente o responsável pode registrar o recebimento.' USING ERRCODE = '42501';
  ELSIF p_status = 'Em conferência' AND NOT (
    v_row.status = 'Recebido' AND coalesce(v_revisor_auth, v_responsavel_auth) = auth.uid()) THEN
    RAISE EXCEPTION 'Somente a pessoa designada pode iniciar a conferência.' USING ERRCODE = '42501';
  ELSIF p_status = 'Concluído' AND NOT (
    v_row.status = 'Em conferência' AND coalesce(v_revisor_auth, v_responsavel_auth) = auth.uid()) THEN
    RAISE EXCEPTION 'Somente a pessoa designada pode concluir a conferência.' USING ERRCODE = '42501';
  ELSIF p_status = 'Cancelado' AND NOT (v_manage AND v_row.status <> 'Cancelado') THEN
    RAISE EXCEPTION 'Somente gestores podem cancelar a solicitação.' USING ERRCODE = '42501';
  ELSIF p_status = 'Pendente' AND NOT (
    v_manage AND v_row.status IN ('Recebido','Em conferência','Concluído','Cancelado')) THEN
    RAISE EXCEPTION 'Somente gestores podem reabrir a solicitação.' USING ERRCODE = '42501';
  ELSIF p_status = v_row.status THEN
    RAISE EXCEPTION 'A solicitação já está neste status.' USING ERRCODE = '22023';
  END IF;

  IF p_documento_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.documentos documento
    WHERE documento.id = p_documento_id AND documento.empresa_id = v_empresa_id
      AND documento.scope = 'empresa' AND documento.cliente_id = v_row.cliente_id::text
      AND public.current_user_can_access_client_row(documento.empresa_id, documento.cliente_id)
      AND coalesce(
        public.current_user_has_permission(v_empresa_id, 'documentos:view')
        OR public.current_user_has_permission(v_empresa_id, 'documentos:manage')
        OR (public.current_user_has_permission(v_empresa_id, 'documentos:create')
          AND documento.owner_user_id = auth.uid())
        OR ((public.current_user_has_permission(v_empresa_id, 'documentos:view-own')
          OR public.current_user_has_permission(v_empresa_id, 'documentos:create-own'))
          AND public.current_user_has_client_access(v_empresa_id, v_row.cliente_id)), false)) THEN
    RAISE EXCEPTION 'Documento não pertence ao cliente da solicitação.' USING ERRCODE = '23514';
  END IF;
  SELECT nullif(btrim(usuario.nome), '') INTO v_actor_name
  FROM public.configuracoes_usuarios usuario
  WHERE usuario.empresa_id = v_empresa_id AND usuario.auth_user_id = auth.uid()
    AND usuario.status = 'Ativo' ORDER BY usuario.created_at DESC LIMIT 1;

  UPDATE public.documentos_solicitacoes SET
    status = p_status,
    evidencia_texto = CASE WHEN p_status = 'Pendente' THEN NULL ELSE v_justificativa END,
    documento_id = CASE WHEN p_status = 'Pendente' THEN NULL ELSE coalesce(p_documento_id, documento_id) END,
    auditoria_pendente = false,
    recebido_em = CASE WHEN p_status = 'Recebido' THEN v_agora WHEN p_status = 'Pendente' THEN NULL ELSE recebido_em END,
    recebido_por = CASE WHEN p_status = 'Recebido' THEN auth.uid() WHEN p_status = 'Pendente' THEN NULL ELSE recebido_por END,
    em_conferencia_em = CASE WHEN p_status = 'Em conferência' THEN v_agora WHEN p_status = 'Pendente' THEN NULL ELSE em_conferencia_em END,
    revisado_por = CASE WHEN p_status = 'Em conferência' THEN auth.uid() WHEN p_status = 'Pendente' THEN NULL ELSE revisado_por END,
    concluido_em = CASE WHEN p_status = 'Concluído' THEN v_agora WHEN p_status = 'Pendente' THEN NULL ELSE concluido_em END,
    concluido_por = CASE WHEN p_status = 'Concluído' THEN auth.uid() WHEN p_status = 'Pendente' THEN NULL ELSE concluido_por END,
    cancelado_em = CASE WHEN p_status = 'Cancelado' THEN v_agora WHEN p_status = 'Pendente' THEN NULL ELSE cancelado_em END,
    cancelado_por = CASE WHEN p_status = 'Cancelado' THEN auth.uid() WHEN p_status = 'Pendente' THEN NULL ELSE cancelado_por END,
    historico = historico || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'id', gen_random_uuid()::text, 'from', v_row.status, 'to', p_status,
      'occurredAt', v_agora::text, 'actorUserId', auth.uid()::text,
      'actorName', v_actor_name, 'justification', v_justificativa,
      'documentId', p_documento_id::text, 'eventType',
        CASE WHEN p_status = 'Pendente' THEN 'reopened' WHEN p_status = 'Cancelado' THEN 'cancelled' ELSE 'transition' END
    )))
  WHERE id = p_id AND empresa_id = v_empresa_id;
  RETURN public.documento_solicitacao_operacional_json(p_id);
END;
$$;

REVOKE ALL ON FUNCTION public.transicionar_solicitacao_documento_operacional(uuid, text, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transicionar_solicitacao_documento_operacional(uuid, text, text, uuid)
  TO authenticated;

COMMIT;
