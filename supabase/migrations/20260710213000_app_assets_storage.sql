-- Bucket público para assets visuais persistentes do app: avatars e logos.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-assets',
  'app-assets',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS app_assets_select_policy ON storage.objects;
CREATE POLICY app_assets_select_policy ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'app-assets');

DROP POLICY IF EXISTS app_assets_insert_policy ON storage.objects;
CREATE POLICY app_assets_insert_policy ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'app-assets');

DROP POLICY IF EXISTS app_assets_update_policy ON storage.objects;
CREATE POLICY app_assets_update_policy ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'app-assets' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'app-assets' AND owner = auth.uid());

DROP POLICY IF EXISTS app_assets_delete_policy ON storage.objects;
CREATE POLICY app_assets_delete_policy ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'app-assets' AND owner = auth.uid());
