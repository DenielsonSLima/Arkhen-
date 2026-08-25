-- Buckets públicos já servem objetos pela URL pública; a policy SELECT ampla
-- permitia enumerar todos os arquivos e não é necessária.
drop policy if exists app_assets_select_policy on storage.objects;
