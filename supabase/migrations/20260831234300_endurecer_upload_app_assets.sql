-- Remove o upload publico historico e vincula cada escrita ao tenant e ao RBAC.

CREATE OR REPLACE FUNCTION public.current_user_can_write_app_asset(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.current_empresa_id() IS NOT NULL
    AND (storage.foldername(p_name))[1] = public.current_empresa_id()::text
    AND CASE (storage.foldername(p_name))[2]
      WHEN 'watermarks-landscape' THEN
        NOT COALESCE(
          public.current_user_is_client_scoped(public.current_empresa_id()),
          true
        )
        AND public.current_user_has_permission(
          public.current_empresa_id(),
          'documentos:manage'
        )
      WHEN 'watermarks-portrait' THEN
        NOT COALESCE(
          public.current_user_is_client_scoped(public.current_empresa_id()),
          true
        )
        AND public.current_user_has_permission(
          public.current_empresa_id(),
          'documentos:manage'
        )
      WHEN 'empresa-logos' THEN
        NOT COALESCE(
          public.current_user_is_client_scoped(public.current_empresa_id()),
          true
        )
        AND public.current_user_has_permission(
          public.current_empresa_id(),
          'configuracoes:manage'
        )
      WHEN 'cliente-logos' THEN
        NOT COALESCE(
          public.current_user_is_client_scoped(public.current_empresa_id()),
          true
        )
        AND (
          public.current_user_has_permission(
            public.current_empresa_id(),
            'clientes:create'
          )
          OR public.current_user_has_permission(
            public.current_empresa_id(),
            'clientes:update'
          )
        )
      WHEN 'avatars' THEN
        (storage.foldername(p_name))[3] = auth.uid()::text
        OR public.current_user_has_permission(
          public.current_empresa_id(),
          'usuarios:manage'
        )
      ELSE false
    END;
$$;

REVOKE ALL ON FUNCTION public.current_user_can_write_app_asset(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_write_app_asset(text)
  TO authenticated;

DROP POLICY IF EXISTS app_assets_insert_policy ON storage.objects;
CREATE POLICY app_assets_insert_policy ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'app-assets'
    AND owner = auth.uid()
    AND public.current_user_can_write_app_asset(name)
  );

DROP POLICY IF EXISTS app_assets_update_policy ON storage.objects;
CREATE POLICY app_assets_update_policy ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'app-assets'
    AND owner = auth.uid()
    AND public.current_user_can_write_app_asset(name)
  )
  WITH CHECK (
    bucket_id = 'app-assets'
    AND owner = auth.uid()
    AND public.current_user_can_write_app_asset(name)
  );

DROP POLICY IF EXISTS app_assets_delete_policy ON storage.objects;
CREATE POLICY app_assets_delete_policy ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'app-assets'
    AND owner = auth.uid()
    AND public.current_user_can_write_app_asset(name)
  );
