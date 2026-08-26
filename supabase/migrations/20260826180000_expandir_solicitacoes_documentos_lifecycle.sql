-- EXPAND: adiciona o fluxo auditável sem remover ainda o contrato legado.
BEGIN;

ALTER TABLE public.documentos_solicitacoes
  ADD COLUMN IF NOT EXISTS tarefa_id uuid,
  ADD COLUMN IF NOT EXISTS responsavel_config_usuario_id uuid,
  ADD COLUMN IF NOT EXISTS revisor_config_usuario_id uuid,
  ADD COLUMN IF NOT EXISTS documento_id uuid,
  ADD COLUMN IF NOT EXISTS evidencia_texto text,
  ADD COLUMN IF NOT EXISTS recebido_em timestamptz,
  ADD COLUMN IF NOT EXISTS recebido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS em_conferencia_em timestamptz,
  ADD COLUMN IF NOT EXISTS revisado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS concluido_em timestamptz,
  ADD COLUMN IF NOT EXISTS concluido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS historico jsonb NOT NULL DEFAULT '[]'::jsonb;

-- O backfill só acompanha a criação da coluna. Assim, uma reaplicação desta
-- migration não desfaz uma auditoria concluída depois do primeiro deploy.
DO $backfill_documentos_solicitacoes$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documentos_solicitacoes'
      AND column_name = 'auditoria_pendente'
  ) THEN
    ALTER TABLE public.documentos_solicitacoes
      ADD COLUMN auditoria_pendente boolean NOT NULL DEFAULT false;

    UPDATE public.documentos_solicitacoes
    SET auditoria_pendente = true
    WHERE status = 'Pendente'
      AND (
        responsavel_config_usuario_id IS NULL
        OR data_limite IS NULL
        OR historico = '[]'::jsonb
      );
  END IF;
END;
$backfill_documentos_solicitacoes$;

CREATE UNIQUE INDEX IF NOT EXISTS documentos_id_empresa_uidx
  ON public.documentos (id, empresa_id);

ALTER TABLE public.documentos_solicitacoes
  DROP CONSTRAINT IF EXISTS documentos_solicitacoes_responsavel_tenant_fkey,
  DROP CONSTRAINT IF EXISTS documentos_solicitacoes_revisor_tenant_fkey,
  DROP CONSTRAINT IF EXISTS documentos_solicitacoes_tarefa_tenant_fkey,
  DROP CONSTRAINT IF EXISTS documentos_solicitacoes_documento_tenant_fkey;

ALTER TABLE public.documentos_solicitacoes
  ADD CONSTRAINT documentos_solicitacoes_responsavel_tenant_fkey
    FOREIGN KEY (responsavel_config_usuario_id, empresa_id)
    REFERENCES public.configuracoes_usuarios (id, empresa_id) ON DELETE RESTRICT,
  ADD CONSTRAINT documentos_solicitacoes_revisor_tenant_fkey
    FOREIGN KEY (revisor_config_usuario_id, empresa_id)
    REFERENCES public.configuracoes_usuarios (id, empresa_id) ON DELETE RESTRICT,
  ADD CONSTRAINT documentos_solicitacoes_tarefa_tenant_fkey
    FOREIGN KEY (tarefa_id, empresa_id)
    REFERENCES public.atividades_tarefas (id, empresa_id) ON DELETE RESTRICT,
  ADD CONSTRAINT documentos_solicitacoes_documento_tenant_fkey
    FOREIGN KEY (documento_id, empresa_id)
    REFERENCES public.documentos (id, empresa_id) ON DELETE RESTRICT;

ALTER TABLE public.documentos_solicitacoes
  DROP CONSTRAINT IF EXISTS documentos_solicitacoes_status_check,
  DROP CONSTRAINT IF EXISTS documentos_solicitacoes_evidencia_check,
  DROP CONSTRAINT IF EXISTS documentos_solicitacoes_historico_check,
  DROP CONSTRAINT IF EXISTS documentos_solicitacoes_revisor_distinto_check;
ALTER TABLE public.documentos_solicitacoes
  ADD CONSTRAINT documentos_solicitacoes_status_check
    CHECK (status IN ('Pendente', 'Recebido', 'Em conferência', 'Concluído', 'Cancelado')),
  ADD CONSTRAINT documentos_solicitacoes_evidencia_check
    CHECK (evidencia_texto IS NULL OR char_length(evidencia_texto) <= 2000),
  ADD CONSTRAINT documentos_solicitacoes_historico_check
    CHECK (jsonb_typeof(historico) = 'array'),
  ADD CONSTRAINT documentos_solicitacoes_revisor_distinto_check
    CHECK (revisor_config_usuario_id IS NULL
      OR revisor_config_usuario_id <> responsavel_config_usuario_id);

CREATE INDEX IF NOT EXISTS documentos_solicitacoes_responsavel_idx
  ON public.documentos_solicitacoes (empresa_id, responsavel_config_usuario_id, status);
CREATE INDEX IF NOT EXISTS documentos_solicitacoes_revisor_idx
  ON public.documentos_solicitacoes (empresa_id, revisor_config_usuario_id, status);
CREATE INDEX IF NOT EXISTS documentos_solicitacoes_tarefa_idx
  ON public.documentos_solicitacoes (empresa_id, tarefa_id) WHERE tarefa_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.proteger_auditoria_documento_solicitacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.empresa_id := (SELECT public.current_empresa_id());
    NEW.status := 'Pendente';
    NEW.criado_por := (SELECT auth.uid());
    NEW.atualizado_por := (SELECT auth.uid());
    NEW.created_at := now();
    NEW.updated_at := now();
    NEW.auditoria_pendente := NEW.responsavel_config_usuario_id IS NULL
      OR NEW.data_limite IS NULL OR NEW.historico = '[]'::jsonb;
  ELSE
    IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
       OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
       OR NEW.criado_por IS DISTINCT FROM OLD.criado_por
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.responsavel_config_usuario_id IS DISTINCT FROM OLD.responsavel_config_usuario_id
       OR NEW.revisor_config_usuario_id IS DISTINCT FROM OLD.revisor_config_usuario_id
       OR NEW.tarefa_id IS DISTINCT FROM OLD.tarefa_id THEN
      RAISE EXCEPTION 'Vínculos e autoria da solicitação não podem ser alterados.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF jsonb_array_length(NEW.historico) <> jsonb_array_length(OLD.historico) + 1
         OR NEW.historico -> -1 ->> 'from' IS DISTINCT FROM OLD.status
         OR NEW.historico -> -1 ->> 'to' IS DISTINCT FROM NEW.status
         OR NEW.historico -> -1 ->> 'actorUserId' IS DISTINCT FROM auth.uid()::text
         OR coalesce((NEW.historico -> -1 ->> 'occurredAt')::timestamptz, '-infinity')
           NOT BETWEEN now() - interval '5 seconds' AND now() + interval '5 seconds' THEN
        RAISE EXCEPTION 'Use a transição auditável para alterar o andamento.'
          USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.historico IS DISTINCT FROM OLD.historico THEN
      RAISE EXCEPTION 'O histórico é append-only e acompanha uma transição.'
        USING ERRCODE = '42501';
    END IF;
    NEW.atualizado_por := (SELECT auth.uid());
    NEW.updated_at := now();
  END IF;

  IF NEW.responsavel_config_usuario_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.configuracoes_usuarios usuario
    WHERE usuario.id = NEW.responsavel_config_usuario_id
      AND usuario.empresa_id = NEW.empresa_id
      AND usuario.status = 'Ativo' AND usuario.auth_user_id IS NOT NULL
  ) THEN RAISE EXCEPTION 'Responsável inativo ou fora do escritório.' USING ERRCODE = '23514'; END IF;
  IF NEW.revisor_config_usuario_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.configuracoes_usuarios usuario
    WHERE usuario.id = NEW.revisor_config_usuario_id
      AND usuario.empresa_id = NEW.empresa_id
      AND usuario.status = 'Ativo' AND usuario.auth_user_id IS NOT NULL
  ) THEN RAISE EXCEPTION 'Revisor inativo ou fora do escritório.' USING ERRCODE = '23514'; END IF;
  IF NEW.tarefa_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.atividades_tarefas tarefa
    WHERE tarefa.id = NEW.tarefa_id AND tarefa.empresa_id = NEW.empresa_id
      AND tarefa.cliente_id = NEW.cliente_id AND tarefa.ativo = true
      AND public.current_user_can_access_client_row(tarefa.empresa_id, tarefa.cliente_id)
      AND CASE WHEN tarefa.competencia ~ '^[0-9]{2}/[0-9]{4}$'
        THEN right(tarefa.competencia, 4) || '-' || left(tarefa.competencia, 2)
        ELSE tarefa.competencia END = to_char(NEW.competencia, 'YYYY-MM')
      AND coalesce(
        public.current_user_has_permission(tarefa.empresa_id, 'atividades:manage')
        OR ((public.current_user_has_permission(tarefa.empresa_id, 'atividades:view')
          OR public.current_user_has_permission(tarefa.empresa_id, 'atividades:update-own'))
          AND (tarefa.responsavel_user_id = auth.uid() OR tarefa.revisor_user_id = auth.uid()))
        OR (public.current_user_has_permission(tarefa.empresa_id, 'atividades:view-own')
          AND tarefa.cliente_id IS NOT NULL
          AND public.current_user_has_client_access(tarefa.empresa_id, tarefa.cliente_id)), false)
  ) THEN RAISE EXCEPTION 'Atividade incompatível com cliente ou competência.' USING ERRCODE = '23514'; END IF;
  IF NEW.documento_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.documentos documento
    WHERE documento.id = NEW.documento_id AND documento.empresa_id = NEW.empresa_id
      AND documento.scope = 'empresa' AND documento.cliente_id = NEW.cliente_id::text
      AND public.current_user_can_access_client_row(documento.empresa_id, documento.cliente_id)
      AND coalesce(
        public.current_user_has_permission(documento.empresa_id, 'documentos:view')
        OR public.current_user_has_permission(documento.empresa_id, 'documentos:manage')
        OR (public.current_user_has_permission(documento.empresa_id, 'documentos:create')
          AND documento.owner_user_id = auth.uid())
        OR ((public.current_user_has_permission(documento.empresa_id, 'documentos:view-own')
          OR public.current_user_has_permission(documento.empresa_id, 'documentos:create-own'))
          AND public.current_user_has_client_access(
            documento.empresa_id, NEW.cliente_id)), false)
  ) THEN RAISE EXCEPTION 'Documento não pertence ao cliente da solicitação.' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.proteger_auditoria_documento_solicitacao()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS proteger_auditoria_documento_solicitacao
  ON public.documentos_solicitacoes;
CREATE TRIGGER proteger_auditoria_documento_solicitacao
  BEFORE INSERT OR UPDATE ON public.documentos_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.proteger_auditoria_documento_solicitacao();

CREATE OR REPLACE FUNCTION public.documento_solicitacao_operacional_json(p_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'id', solicitacao.id::text, 'clienteId', solicitacao.cliente_id::text,
    'competencia', to_char(solicitacao.competencia, 'YYYY-MM'),
    'titulo', solicitacao.titulo, 'descricao', coalesce(solicitacao.descricao, ''),
    'dataLimite', coalesce(solicitacao.data_limite::text, ''), 'status', solicitacao.status,
    'responsavelId', coalesce(solicitacao.responsavel_config_usuario_id::text, ''),
    'responsavelNome', coalesce(responsavel.nome, ''),
    'revisorId', coalesce(solicitacao.revisor_config_usuario_id::text, ''),
    'revisorNome', coalesce(revisor.nome, ''),
    'tarefaId', coalesce(solicitacao.tarefa_id::text, ''),
    'tarefaTitulo', coalesce(tarefa.titulo, ''),
    'documentoId', coalesce(solicitacao.documento_id::text, ''),
    'documentoNome', coalesce(documento.nome, ''),
    'evidenciaTexto', coalesce(solicitacao.evidencia_texto, ''),
    'auditoriaPendente', solicitacao.auditoria_pendente,
    'history', solicitacao.historico,
    'allowedActions', coalesce((SELECT jsonb_agg(acao) FROM (VALUES
      (CASE WHEN solicitacao.status = 'Pendente' AND responsavel.auth_user_id = auth.uid() THEN 'Recebido' END),
      (CASE WHEN solicitacao.status = 'Recebido' AND coalesce(revisor.auth_user_id, responsavel.auth_user_id) = auth.uid() THEN 'Em conferência' END),
      (CASE WHEN solicitacao.status = 'Em conferência' AND coalesce(revisor.auth_user_id, responsavel.auth_user_id) = auth.uid() THEN 'Concluído' END),
      (CASE WHEN solicitacao.status <> 'Cancelado' AND public.current_user_has_permission(solicitacao.empresa_id, 'documentos:manage') THEN 'Cancelado' END),
      (CASE WHEN solicitacao.status IN ('Recebido', 'Em conferência', 'Concluído', 'Cancelado')
        AND public.current_user_has_permission(solicitacao.empresa_id, 'documentos:manage') THEN 'Pendente' END)
    ) permitida(acao) WHERE acao IS NOT NULL), '[]'::jsonb),
    'createdAt', solicitacao.created_at::text, 'updatedAt', solicitacao.updated_at::text
  )
  FROM public.documentos_solicitacoes solicitacao
  LEFT JOIN public.configuracoes_usuarios responsavel
    ON responsavel.id = solicitacao.responsavel_config_usuario_id AND responsavel.empresa_id = solicitacao.empresa_id
   AND responsavel.status = 'Ativo'
  LEFT JOIN public.configuracoes_usuarios revisor
    ON revisor.id = solicitacao.revisor_config_usuario_id AND revisor.empresa_id = solicitacao.empresa_id
   AND revisor.status = 'Ativo'
  LEFT JOIN public.atividades_tarefas tarefa
    ON tarefa.id = solicitacao.tarefa_id AND tarefa.empresa_id = solicitacao.empresa_id
  LEFT JOIN public.documentos documento
    ON documento.id = solicitacao.documento_id AND documento.empresa_id = solicitacao.empresa_id
  WHERE solicitacao.id = p_id AND solicitacao.empresa_id = public.current_empresa_id()
    AND public.current_user_can_access_client_row(solicitacao.empresa_id, solicitacao.cliente_id)
    AND (public.current_user_has_permission(solicitacao.empresa_id, 'documentos:view')
      OR public.current_user_has_permission(solicitacao.empresa_id, 'documentos:manage')
      OR (solicitacao.criado_por = auth.uid() AND public.current_user_has_permission(solicitacao.empresa_id, 'documentos:create'))
      OR responsavel.auth_user_id = auth.uid() OR revisor.auth_user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.documento_solicitacao_operacional_json(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.listar_solicitacoes_documentos_operacionais()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(public.documento_solicitacao_operacional_json(s.id)
    ORDER BY s.competencia DESC, s.data_limite NULLS LAST, s.created_at DESC), '[]'::jsonb)
  FROM public.documentos_solicitacoes s
  LEFT JOIN public.configuracoes_usuarios r
    ON r.id = s.responsavel_config_usuario_id AND r.empresa_id = s.empresa_id AND r.status = 'Ativo'
  LEFT JOIN public.configuracoes_usuarios v
    ON v.id = s.revisor_config_usuario_id AND v.empresa_id = s.empresa_id AND v.status = 'Ativo'
  WHERE auth.uid() IS NOT NULL AND s.empresa_id = public.current_empresa_id()
    AND public.current_user_can_access_client_row(s.empresa_id, s.cliente_id)
    AND (public.current_user_has_permission(s.empresa_id, 'documentos:view')
      OR public.current_user_has_permission(s.empresa_id, 'documentos:manage')
      OR (s.criado_por = auth.uid() AND public.current_user_has_permission(s.empresa_id, 'documentos:create'))
      OR r.auth_user_id = auth.uid() OR v.auth_user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.listar_solicitacoes_documentos_operacionais()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.listar_solicitacoes_documentos_operacionais() TO authenticated;

CREATE OR REPLACE FUNCTION public.listar_opcoes_solicitacoes_documentos(
  p_cliente_id uuid DEFAULT NULL, p_competencia date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id(); v_result jsonb;
  v_documentos_view boolean; v_documentos_create boolean; v_documentos_manage boolean;
  v_atividades_manage boolean; v_atividades_own boolean; v_atividades_client boolean;
BEGIN
  v_documentos_view := coalesce(public.current_user_has_permission(
    v_empresa_id, 'documentos:view'), false);
  v_documentos_create := coalesce(public.current_user_has_permission(
    v_empresa_id, 'documentos:create'), false);
  v_documentos_manage := coalesce(public.current_user_has_permission(
    v_empresa_id, 'documentos:manage'), false);
  v_atividades_manage := coalesce(public.current_user_has_permission(
    v_empresa_id, 'atividades:manage'), false);
  v_atividades_own := coalesce(
    public.current_user_has_permission(v_empresa_id, 'atividades:view')
    OR public.current_user_has_permission(v_empresa_id, 'atividades:update-own'), false);
  v_atividades_client := coalesce(public.current_user_has_permission(
    v_empresa_id, 'atividades:view-own'), false);
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR NOT (v_documentos_view OR v_documentos_create OR v_documentos_manage) THEN
    RAISE EXCEPTION 'Opções não encontradas.' USING ERRCODE = '42501';
  END IF;
  IF p_cliente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clientes c WHERE c.id = p_cliente_id AND c.empresa_id = v_empresa_id
      AND public.current_user_can_access_client_row(c.empresa_id, c.id)
  ) THEN RAISE EXCEPTION 'Opções não encontradas.' USING ERRCODE = '42501'; END IF;
  SELECT jsonb_build_object(
    'users', coalesce((SELECT jsonb_agg(jsonb_build_object('id', u.id::text, 'nome', u.nome) ORDER BY u.nome)
      FROM public.configuracoes_usuarios u WHERE u.empresa_id = v_empresa_id
        AND u.status = 'Ativo' AND u.auth_user_id IS NOT NULL), '[]'::jsonb),
    'tasks', coalesce((SELECT jsonb_agg(jsonb_build_object('id', t.id::text, 'titulo', t.titulo,
      'clienteId', t.cliente_id::text, 'competencia', CASE WHEN t.competencia ~ '^[0-9]{2}/[0-9]{4}$'
        THEN right(t.competencia, 4) || '-' || left(t.competencia, 2) ELSE t.competencia END) ORDER BY t.vencimento, t.titulo)
      FROM public.atividades_tarefas t WHERE p_cliente_id IS NOT NULL AND t.empresa_id = v_empresa_id
        AND t.cliente_id = p_cliente_id AND t.ativo = true
        AND public.current_user_can_access_client_row(t.empresa_id, t.cliente_id)
        AND (v_atividades_manage
          OR (v_atividades_own
            AND (t.responsavel_user_id = auth.uid() OR t.revisor_user_id = auth.uid()))
          OR (v_atividades_client AND t.cliente_id IS NOT NULL
            AND public.current_user_has_client_access(t.empresa_id, t.cliente_id)))
        AND (p_competencia IS NULL OR CASE WHEN t.competencia ~ '^[0-9]{2}/[0-9]{4}$'
          THEN right(t.competencia, 4) || '-' || left(t.competencia, 2) ELSE t.competencia END = to_char(p_competencia, 'YYYY-MM'))), '[]'::jsonb),
    'documents', coalesce((SELECT jsonb_agg(jsonb_build_object('id', d.id::text, 'nome', d.nome) ORDER BY d.data_upload DESC)
      FROM public.documentos d WHERE p_cliente_id IS NOT NULL AND d.empresa_id = v_empresa_id
        AND d.scope = 'empresa' AND d.cliente_id = p_cliente_id::text
        AND public.current_user_can_access_client_row(d.empresa_id, d.cliente_id)
        AND (v_documentos_view OR v_documentos_manage
          OR (v_documentos_create AND d.owner_user_id = auth.uid()))), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.listar_opcoes_solicitacoes_documentos(uuid, date)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.listar_opcoes_solicitacoes_documentos(uuid, date) TO authenticated;

COMMIT;
