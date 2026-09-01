-- LOCKDOWN: aplicar somente depois de todos os EXPAND, publicação do frontend novo e
-- validação. Remove os caminhos legados que permitiam fontes e auditorias duplas.
BEGIN;

REVOKE ALL ON FUNCTION public.salvar_atividade_tarefa(uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.atualizar_atividade_checklist(
  uuid, text, boolean, timestamptz
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.salvar_atividade_fechamento(uuid, varchar, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ensure_atividades_instancias(varchar)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_resumo_conformidade(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

DROP POLICY IF EXISTS isolamento_cliente_select ON public.atividades_tarefas;
DROP POLICY IF EXISTS atividades_tarefas_select_scope ON public.atividades_tarefas;
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

DROP POLICY IF EXISTS isolamento_cliente_select ON public.atividades_rotinas;
DROP POLICY IF EXISTS atividades_rotinas_select_scope ON public.atividades_rotinas;
CREATE POLICY atividades_rotinas_select_scope
ON public.atividades_rotinas FOR SELECT TO authenticated
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
      AND responsavel_user_id = (SELECT auth.uid())
    )
    OR (
      cliente_id IS NOT NULL
      AND public.current_user_has_permission(empresa_id, 'atividades:view-own')
      AND public.current_user_has_client_access(empresa_id, cliente_id)
    )
  )
);

DROP POLICY IF EXISTS isolamento_cliente_select ON public.atividades_fechamentos;
DROP POLICY IF EXISTS atividades_fechamentos_select_scope ON public.atividades_fechamentos;
CREATE POLICY atividades_fechamentos_select_scope
ON public.atividades_fechamentos FOR SELECT TO authenticated
USING (
  empresa_id = public.current_empresa_id()
  AND public.current_user_can_access_client_row(empresa_id, cliente_id)
  AND (
    public.current_user_has_permission(empresa_id, 'atividades:manage')
    OR (
      public.current_user_has_permission(empresa_id, 'atividades:view-own')
      AND public.current_user_has_client_access(empresa_id, cliente_id)
    )
  )
);

DROP POLICY IF EXISTS isolamento_cliente_select ON public.atividades_instancias;

REVOKE ALL ON TABLE public.atividades_tarefas
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.atividades_tarefas TO authenticated;

REVOKE ALL ON TABLE public.atividades_instancias
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.atividades_fechamentos
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.atividades_fechamentos TO authenticated;

REVOKE ALL ON TABLE public.atividades_tarefa_eventos
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.atividades_tarefa_eventos TO authenticated;

REVOKE ALL ON TABLE public.atividades_fechamento_eventos
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.atividades_fechamento_eventos TO authenticated;

COMMIT;
