-- Fecha avisos introduzidos pelo lote operacional: privilegios de funcoes de
-- trigger, indices de FKs e avaliacao unica da identidade nas policies.
BEGIN;

REVOKE ALL ON FUNCTION public.enforce_document_share_integrity()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_membership_privilege_integrity()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_user_configuration_privilege_integrity()
  FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS configuracoes_usuarios_membership_tenant_idx
  ON public.configuracoes_usuarios (perfil_id, empresa_id, auth_user_id);
CREATE INDEX IF NOT EXISTS documentos_compartilhamentos_documento_empresa_idx
  ON public.documentos_compartilhamentos (documento_id, empresa_id);
CREATE INDEX IF NOT EXISTS documentos_solicitacoes_criado_por_idx
  ON public.documentos_solicitacoes (criado_por);
CREATE INDEX IF NOT EXISTS documentos_solicitacoes_atualizado_por_idx
  ON public.documentos_solicitacoes (atualizado_por);
CREATE INDEX IF NOT EXISTS protocolos_entregas_concluido_por_user_idx
  ON public.protocolos_entregas (concluido_por_user_id);

DROP POLICY IF EXISTS document_share_access_attempts_deny_client
  ON public.document_share_access_attempts;
CREATE POLICY document_share_access_attempts_deny_client
  ON public.document_share_access_attempts
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS documentos_compartilhamentos_select_scope
  ON public.documentos_compartilhamentos;
CREATE POLICY documentos_compartilhamentos_select_scope
  ON public.documentos_compartilhamentos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.documentos d
      WHERE d.id = documentos_compartilhamentos.documento_id
        AND d.empresa_id = documentos_compartilhamentos.empresa_id
        AND (
          public.current_user_has_permission(d.empresa_id, 'documentos:view')
          OR public.current_user_has_permission(d.empresa_id, 'documentos:view-own')
          OR public.current_user_has_permission(d.empresa_id, 'documentos:manage')
        )
        AND (
          (d.scope = 'pessoal' AND d.owner_user_id = (SELECT auth.uid()))
          OR (
            d.scope = 'empresa'
            AND public.current_user_can_access_client_row(d.empresa_id, d.cliente_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS documentos_compartilhamentos_insert_manager
  ON public.documentos_compartilhamentos;
CREATE POLICY documentos_compartilhamentos_insert_manager
  ON public.documentos_compartilhamentos
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND public.current_user_has_permission(empresa_id, 'documentos:manage')
    AND EXISTS (
      SELECT 1
      FROM public.documentos d
      WHERE d.id = documentos_compartilhamentos.documento_id
        AND d.empresa_id = documentos_compartilhamentos.empresa_id
        AND (
          (d.scope = 'pessoal' AND d.owner_user_id = (SELECT auth.uid()))
          OR (
            d.scope = 'empresa'
            AND public.current_user_can_access_client_row(d.empresa_id, d.cliente_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS documentos_compartilhamentos_update_manager
  ON public.documentos_compartilhamentos;
CREATE POLICY documentos_compartilhamentos_update_manager
  ON public.documentos_compartilhamentos
  FOR UPDATE TO authenticated
  USING (
    public.current_user_has_permission(empresa_id, 'documentos:manage')
    AND EXISTS (
      SELECT 1
      FROM public.documentos d
      WHERE d.id = documentos_compartilhamentos.documento_id
        AND d.empresa_id = documentos_compartilhamentos.empresa_id
        AND (
          (d.scope = 'pessoal' AND d.owner_user_id = (SELECT auth.uid()))
          OR (
            d.scope = 'empresa'
            AND public.current_user_can_access_client_row(d.empresa_id, d.cliente_id)
          )
        )
    )
  )
  WITH CHECK (
    public.current_user_has_permission(empresa_id, 'documentos:manage')
    AND EXISTS (
      SELECT 1
      FROM public.documentos d
      WHERE d.id = documentos_compartilhamentos.documento_id
        AND d.empresa_id = documentos_compartilhamentos.empresa_id
        AND (
          (d.scope = 'pessoal' AND d.owner_user_id = (SELECT auth.uid()))
          OR (
            d.scope = 'empresa'
            AND public.current_user_can_access_client_row(d.empresa_id, d.cliente_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS documentos_compartilhamentos_delete_manager
  ON public.documentos_compartilhamentos;
CREATE POLICY documentos_compartilhamentos_delete_manager
  ON public.documentos_compartilhamentos
  FOR DELETE TO authenticated
  USING (
    public.current_user_has_permission(empresa_id, 'documentos:manage')
    AND EXISTS (
      SELECT 1
      FROM public.documentos d
      WHERE d.id = documentos_compartilhamentos.documento_id
        AND d.empresa_id = documentos_compartilhamentos.empresa_id
        AND (
          (d.scope = 'pessoal' AND d.owner_user_id = (SELECT auth.uid()))
          OR (
            d.scope = 'empresa'
            AND public.current_user_can_access_client_row(d.empresa_id, d.cliente_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS documentos_storage_select_policy ON storage.objects;
CREATE POLICY documentos_storage_select_policy ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos'
    AND EXISTS (
      SELECT 1
      FROM public.documentos d
      WHERE d.storage_bucket = storage.objects.bucket_id
        AND d.storage_path = storage.objects.name
        AND (
          public.current_user_has_permission(d.empresa_id, 'documentos:view')
          OR public.current_user_has_permission(d.empresa_id, 'documentos:view-own')
          OR public.current_user_has_permission(d.empresa_id, 'documentos:manage')
        )
        AND (
          (d.scope = 'pessoal' AND d.owner_user_id = (SELECT auth.uid()))
          OR (
            d.scope = 'empresa'
            AND public.current_user_can_access_client_row(d.empresa_id, d.cliente_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS documentos_storage_insert_policy ON storage.objects;
CREATE POLICY documentos_storage_insert_policy ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos'
    AND owner = (SELECT auth.uid())
    AND (storage.foldername(name))[1] = public.current_empresa_id()::text
    AND (
      public.current_user_has_permission(public.current_empresa_id(), 'documentos:create')
      OR public.current_user_has_permission(public.current_empresa_id(), 'documentos:manage')
    )
    AND (
      (
        (storage.foldername(name))[2] = 'pessoal'
        AND (storage.foldername(name))[3] = (SELECT auth.uid())::text
      )
      OR (
        (storage.foldername(name))[2] = 'clientes'
        AND EXISTS (
          SELECT 1
          FROM public.clientes c
          WHERE c.id::text = (storage.foldername(name))[3]
            AND c.empresa_id = public.current_empresa_id()
            AND public.current_user_can_access_client_row(c.empresa_id, c.id)
        )
      )
    )
  );

DROP POLICY IF EXISTS documentos_storage_delete_policy ON storage.objects;
CREATE POLICY documentos_storage_delete_policy ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documentos'
    AND EXISTS (
      SELECT 1
      FROM public.documentos d
      WHERE d.storage_bucket = storage.objects.bucket_id
        AND d.storage_path = storage.objects.name
        AND (
          (d.scope = 'pessoal' AND d.owner_user_id = (SELECT auth.uid()))
          OR (
            d.scope = 'empresa'
            AND public.current_user_has_permission(d.empresa_id, 'documentos:manage')
            AND public.current_user_can_access_client_row(d.empresa_id, d.cliente_id)
          )
        )
    )
  );

COMMIT;
