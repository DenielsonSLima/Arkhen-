DROP POLICY IF EXISTS documentos_update_owner_or_manager ON public.documentos;
CREATE POLICY documentos_update_owner_or_manager ON public.documentos
  FOR UPDATE TO authenticated
  USING (
    public.current_user_has_permission(empresa_id, 'documentos:manage')
    OR (owner_user_id = auth.uid() AND public.is_empresa_member(empresa_id))
  )
  WITH CHECK (
    public.current_user_has_permission(empresa_id, 'documentos:manage')
    OR (owner_user_id = auth.uid() AND public.is_empresa_member(empresa_id))
  );

DROP POLICY IF EXISTS documentos_delete_owner_or_manager ON public.documentos;
CREATE POLICY documentos_delete_owner_or_manager ON public.documentos
  FOR DELETE TO authenticated
  USING (
    public.current_user_has_permission(empresa_id, 'documentos:manage')
    OR (owner_user_id = auth.uid() AND public.is_empresa_member(empresa_id))
  );
