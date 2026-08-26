-- LOCKDOWN: aplicar somente depois do frontend que usa os RPCs EXPAND.
BEGIN;

REVOKE ALL ON TABLE public.documentos_solicitacoes FROM anon, authenticated;
GRANT SELECT ON TABLE public.documentos_solicitacoes TO authenticated;

DROP POLICY IF EXISTS documentos_solicitacoes_insert ON public.documentos_solicitacoes;
DROP POLICY IF EXISTS documentos_solicitacoes_update ON public.documentos_solicitacoes;
DROP POLICY IF EXISTS documentos_solicitacoes_select ON public.documentos_solicitacoes;
CREATE POLICY documentos_solicitacoes_select
  ON public.documentos_solicitacoes
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND public.current_user_can_access_client_row(empresa_id, cliente_id)
    AND (
      public.current_user_has_permission(empresa_id, 'documentos:view')
      OR public.current_user_has_permission(empresa_id, 'documentos:manage')
      OR (criado_por = auth.uid()
        AND public.current_user_has_permission(empresa_id, 'documentos:create'))
      OR EXISTS (SELECT 1 FROM public.configuracoes_usuarios usuario
        WHERE usuario.id = responsavel_config_usuario_id
          AND usuario.empresa_id = documentos_solicitacoes.empresa_id
          AND usuario.status = 'Ativo' AND usuario.auth_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.configuracoes_usuarios usuario
        WHERE usuario.id = revisor_config_usuario_id
          AND usuario.empresa_id = documentos_solicitacoes.empresa_id
          AND usuario.status = 'Ativo' AND usuario.auth_user_id = auth.uid())
    )
  );

REVOKE ALL ON TABLE public.protocolos_entregas FROM anon, authenticated;
GRANT SELECT ON TABLE public.protocolos_entregas TO authenticated;

DROP POLICY IF EXISTS protocolos_entregas_policy ON public.protocolos_entregas;
DROP POLICY IF EXISTS protocolos_entregas_select ON public.protocolos_entregas;
DROP POLICY IF EXISTS isolamento_cliente_insert ON public.protocolos_entregas;
DROP POLICY IF EXISTS isolamento_cliente_update ON public.protocolos_entregas;
DROP POLICY IF EXISTS isolamento_cliente_delete ON public.protocolos_entregas;
DROP POLICY IF EXISTS isolamento_cliente_select ON public.protocolos_entregas;
CREATE POLICY protocolos_entregas_select
  ON public.protocolos_entregas
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND public.current_user_can_access_client_row(empresa_id, cliente_id)
    AND (
      public.current_user_has_permission(empresa_id, 'protocolos:view')
      OR public.current_user_has_permission(empresa_id, 'protocolos:create')
      OR public.current_user_has_permission(empresa_id, 'protocolos:manage')
      OR (
        public.current_user_has_permission(empresa_id, 'protocolos:view-own')
        AND cliente_id IS NOT NULL
        AND public.current_user_has_client_access(empresa_id, cliente_id)
      )
    )
  );

REVOKE ALL ON FUNCTION public.atualizar_protocolo_entrega(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_protocolos_operacionais()
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE public.documentos_solicitacoes IS
  'Solicitações operacionais; mutações somente pelos RPCs auditáveis.';
COMMENT ON TABLE public.protocolos_entregas IS
  'Protocolos operacionais; mutações somente pelo RPC seguro.';

COMMIT;
