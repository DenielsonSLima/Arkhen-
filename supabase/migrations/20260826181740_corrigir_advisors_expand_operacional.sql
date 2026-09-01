-- EXPAND: corrige apenas os avisos introduzidos pelas novas FKs e policies do
-- fluxo operacional. Nenhum contrato ou caminho legado é removido neste passo.
BEGIN;

-- atividades_tarefas: quatro atores e o vínculo composto com o modelo.
CREATE INDEX IF NOT EXISTS atividades_tarefas_revisor_user_fk_idx
  ON public.atividades_tarefas (revisor_user_id);
CREATE INDEX IF NOT EXISTS atividades_tarefas_conclusao_solicitada_user_fk_idx
  ON public.atividades_tarefas (conclusao_solicitada_por_user_id);
CREATE INDEX IF NOT EXISTS atividades_tarefas_revisado_user_fk_idx
  ON public.atividades_tarefas (revisado_por_user_id);
CREATE INDEX IF NOT EXISTS atividades_tarefas_concluido_user_fk_idx
  ON public.atividades_tarefas (concluido_por_user_id);
CREATE INDEX IF NOT EXISTS atividades_tarefas_modelo_tenant_fk_idx
  ON public.atividades_tarefas (modelo_id, empresa_id);

-- Auditoria de tarefas.
CREATE INDEX IF NOT EXISTS atividades_tarefa_eventos_ator_user_fk_idx
  ON public.atividades_tarefa_eventos (ator_user_id);
CREATE INDEX IF NOT EXISTS atividades_tarefa_eventos_tarefa_tenant_fk_idx
  ON public.atividades_tarefa_eventos (tarefa_id, empresa_id);

-- Fechamentos e seus eventos auditáveis.
CREATE INDEX IF NOT EXISTS atividades_fechamentos_finalizado_user_fk_idx
  ON public.atividades_fechamentos (finalizado_por_user_id);
CREATE INDEX IF NOT EXISTS atividades_fechamentos_reaberto_user_fk_idx
  ON public.atividades_fechamentos (reaberto_por_user_id);
CREATE INDEX IF NOT EXISTS atividades_fechamento_eventos_ator_user_fk_idx
  ON public.atividades_fechamento_eventos (ator_user_id);
CREATE INDEX IF NOT EXISTS atividades_fechamento_eventos_fechamento_tenant_fk_idx
  ON public.atividades_fechamento_eventos (fechamento_id, empresa_id);
CREATE INDEX IF NOT EXISTS atividades_fechamento_eventos_cliente_tenant_fk_idx
  ON public.atividades_fechamento_eventos (cliente_id, empresa_id);

-- Solicitações documentais: atores e vínculos tenant-scoped.
CREATE INDEX IF NOT EXISTS documentos_solicitacoes_recebido_user_fk_idx
  ON public.documentos_solicitacoes (recebido_por);
CREATE INDEX IF NOT EXISTS documentos_solicitacoes_revisado_user_fk_idx
  ON public.documentos_solicitacoes (revisado_por);
CREATE INDEX IF NOT EXISTS documentos_solicitacoes_concluido_user_fk_idx
  ON public.documentos_solicitacoes (concluido_por);
CREATE INDEX IF NOT EXISTS documentos_solicitacoes_cancelado_user_fk_idx
  ON public.documentos_solicitacoes (cancelado_por);
CREATE INDEX IF NOT EXISTS documentos_solicitacoes_responsavel_tenant_fk_idx
  ON public.documentos_solicitacoes (responsavel_config_usuario_id, empresa_id);
CREATE INDEX IF NOT EXISTS documentos_solicitacoes_revisor_tenant_fk_idx
  ON public.documentos_solicitacoes (revisor_config_usuario_id, empresa_id);
CREATE INDEX IF NOT EXISTS documentos_solicitacoes_tarefa_tenant_fk_idx
  ON public.documentos_solicitacoes (tarefa_id, empresa_id);
CREATE INDEX IF NOT EXISTS documentos_solicitacoes_documento_tenant_fk_idx
  ON public.documentos_solicitacoes (documento_id, empresa_id);

-- O índice documentos_id_empresa_unique já sustenta a unicidade. A FK criada
-- depois do índice duplicado é reconstruída para não depender do índice removido.
ALTER TABLE public.documentos_solicitacoes
  DROP CONSTRAINT IF EXISTS documentos_solicitacoes_documento_tenant_fkey;
DROP INDEX IF EXISTS public.documentos_id_empresa_uidx;
ALTER TABLE public.documentos_solicitacoes
  ADD CONSTRAINT documentos_solicitacoes_documento_tenant_fkey
  FOREIGN KEY (documento_id, empresa_id)
  REFERENCES public.documentos (id, empresa_id)
  ON DELETE RESTRICT;

-- Avalia a identidade uma vez por statement, preservando a ACL canônica.
DROP POLICY IF EXISTS atividades_tarefas_select_scope
  ON public.atividades_tarefas;
CREATE POLICY atividades_tarefas_select_scope
ON public.atividades_tarefas FOR SELECT TO authenticated
USING (
  empresa_id = public.current_empresa_id()
  AND public.current_user_can_access_client_row(empresa_id, cliente_id)
  AND (
    public.current_user_has_permission(empresa_id, 'atividades:manage')
    OR (
      (
        public.current_user_has_permission(empresa_id, 'atividades:view')
        OR public.current_user_has_permission(empresa_id, 'atividades:update-own')
      )
      AND (
        responsavel_user_id = (SELECT auth.uid())
        OR revisor_user_id = (SELECT auth.uid())
      )
    )
    OR (
      cliente_id IS NOT NULL
      AND public.current_user_has_permission(empresa_id, 'atividades:view-own')
      AND public.current_user_has_client_access(empresa_id, cliente_id)
    )
  )
);

DROP POLICY IF EXISTS atividades_tarefa_eventos_select_scope
  ON public.atividades_tarefa_eventos;
CREATE POLICY atividades_tarefa_eventos_select_scope
ON public.atividades_tarefa_eventos FOR SELECT TO authenticated
USING (
  empresa_id = public.current_empresa_id()
  AND (
    public.current_user_has_permission(empresa_id, 'atividades:manage')
    OR EXISTS (
      SELECT 1
      FROM public.atividades_tarefas tarefa
      WHERE tarefa.id = atividades_tarefa_eventos.tarefa_id
        AND tarefa.empresa_id = atividades_tarefa_eventos.empresa_id
        AND public.current_user_can_access_client_row(
          tarefa.empresa_id, tarefa.cliente_id
        )
        AND (
          (
            (
              public.current_user_has_permission(tarefa.empresa_id, 'atividades:view')
              OR public.current_user_has_permission(
                tarefa.empresa_id, 'atividades:update-own'
              )
            )
            AND (
              tarefa.responsavel_user_id = (SELECT auth.uid())
              OR tarefa.revisor_user_id = (SELECT auth.uid())
            )
          )
          OR (
            tarefa.cliente_id IS NOT NULL
            AND public.current_user_has_permission(
              tarefa.empresa_id, 'atividades:view-own'
            )
            AND public.current_user_has_client_access(
              tarefa.empresa_id, tarefa.cliente_id
            )
          )
        )
    )
  )
);

COMMIT;
