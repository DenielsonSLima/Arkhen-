-- LOCKDOWN: elimina policies de escrita que ficaram inertes após a revogação
-- dos grants e mantém somente os caminhos canônicos auditáveis por RPC.
BEGIN;

DROP POLICY IF EXISTS atividades_tarefas_insert_scope
  ON public.atividades_tarefas;
DROP POLICY IF EXISTS atividades_tarefas_update_scope
  ON public.atividades_tarefas;
DROP POLICY IF EXISTS atividades_tarefas_delete_manager
  ON public.atividades_tarefas;

-- A projeção legada não é mais acessível ao frontend autenticado.
DROP POLICY IF EXISTS atividades_instancias_select_scope
  ON public.atividades_instancias;
DROP POLICY IF EXISTS atividades_instancias_insert_manager
  ON public.atividades_instancias;
DROP POLICY IF EXISTS atividades_instancias_update_scope
  ON public.atividades_instancias;
DROP POLICY IF EXISTS atividades_instancias_delete_manager
  ON public.atividades_instancias;

-- Mantém a mesma ACL documental, avaliando a identidade apenas uma vez por
-- statement para evitar initplans repetidos em listas maiores.
DROP POLICY IF EXISTS documentos_solicitacoes_select
  ON public.documentos_solicitacoes;
CREATE POLICY documentos_solicitacoes_select
  ON public.documentos_solicitacoes
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND public.current_user_can_access_client_row(empresa_id, cliente_id)
    AND (
      public.current_user_has_permission(empresa_id, 'documentos:view')
      OR public.current_user_has_permission(empresa_id, 'documentos:manage')
      OR (
        criado_por = (SELECT auth.uid())
        AND public.current_user_has_permission(empresa_id, 'documentos:create')
      )
      OR EXISTS (
        SELECT 1
        FROM public.configuracoes_usuarios usuario
        WHERE usuario.id = responsavel_config_usuario_id
          AND usuario.empresa_id = documentos_solicitacoes.empresa_id
          AND usuario.status = 'Ativo'
          AND usuario.auth_user_id = (SELECT auth.uid())
      )
      OR EXISTS (
        SELECT 1
        FROM public.configuracoes_usuarios usuario
        WHERE usuario.id = revisor_config_usuario_id
          AND usuario.empresa_id = documentos_solicitacoes.empresa_id
          AND usuario.status = 'Ativo'
          AND usuario.auth_user_id = (SELECT auth.uid())
      )
    )
  );

COMMIT;
