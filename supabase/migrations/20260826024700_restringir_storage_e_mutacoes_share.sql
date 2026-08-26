-- Defesa em profundidade para escopo de cliente em mutacoes de share e objetos do Storage.
BEGIN;

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
          (d.scope = 'pessoal' AND d.owner_user_id = auth.uid())
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
          (d.scope = 'pessoal' AND d.owner_user_id = auth.uid())
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
          (d.scope = 'pessoal' AND d.owner_user_id = auth.uid())
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
    AND owner = auth.uid()
    AND (storage.foldername(name))[1] = public.current_empresa_id()::text
    AND (
      public.current_user_has_permission(public.current_empresa_id(), 'documentos:create')
      OR public.current_user_has_permission(public.current_empresa_id(), 'documentos:manage')
    )
    AND (
      (
        (storage.foldername(name))[2] = 'pessoal'
        AND (storage.foldername(name))[3] = auth.uid()::text
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

-- O aplicativo nunca altera o objeto em si: metadados mudam na tabela documentos.
-- Remover UPDATE evita renomear/mover um objeto autorizado para um caminho fora do escopo.
DROP POLICY IF EXISTS documentos_storage_update_policy ON storage.objects;

COMMIT;
