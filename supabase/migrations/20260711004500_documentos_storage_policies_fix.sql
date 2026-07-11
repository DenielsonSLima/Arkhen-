-- Ajuste de segurança: manter acesso normal aos documentos da empresa e manter compartilhamentos.

-- Recria as políticas de leitura de storage.documentos com comportamento explícito.
DROP POLICY IF EXISTS documentos_storage_select_shared_policy ON storage.objects;
DROP POLICY IF EXISTS documentos_storage_select_policy ON storage.objects;

CREATE POLICY documentos_storage_select_shared_policy ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'documentos'
    AND EXISTS (
      SELECT 1
      FROM public.documentos_compartilhamentos dc
      JOIN public.documentos d ON d.id = dc.documento_id
      WHERE dc.status = 'Ativo'
        AND dc.expires_at > now()
        AND d.storage_bucket = storage.objects.bucket_id
        AND d.storage_path = storage.objects.name
    )
  );

CREATE POLICY documentos_storage_select_policy ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.documentos d
        WHERE d.storage_bucket = storage.objects.bucket_id
          AND d.storage_path = storage.objects.name
          AND public.is_empresa_member(d.empresa_id)
      )
    )
  );
