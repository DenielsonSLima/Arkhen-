-- Modulo documentos: metadados, storage e realtime.

CREATE TABLE IF NOT EXISTS public.documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  scope varchar(20) NOT NULL CHECK (scope IN ('pessoal', 'empresa')),
  cliente_id text,
  storage_bucket text NOT NULL DEFAULT 'documentos',
  storage_path text NOT NULL UNIQUE,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'Outros',
  descricao text,
  pasta text,
  data_upload timestamptz NOT NULL DEFAULT now(),
  data_validade date,
  mime_type text,
  tamanho_bytes bigint NOT NULL DEFAULT 0 CHECK (tamanho_bytes >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documentos_cliente_scope_check CHECK (
    (scope = 'empresa' AND cliente_id IS NOT NULL)
    OR (scope = 'pessoal' AND cliente_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_documentos_empresa_scope ON public.documentos(empresa_id, scope);
CREATE INDEX IF NOT EXISTS idx_documentos_cliente ON public.documentos(empresa_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_documentos_pasta ON public.documentos(empresa_id, pasta);

DROP TRIGGER IF EXISTS set_documentos_updated_at ON public.documentos;
CREATE TRIGGER set_documentos_updated_at
  BEFORE UPDATE ON public.documentos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS documentos_tenant_policy ON public.documentos;
CREATE POLICY documentos_tenant_policy ON public.documentos
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos',
  'documentos',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS documentos_storage_insert_policy ON storage.objects;
CREATE POLICY documentos_storage_insert_policy ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos');

DROP POLICY IF EXISTS documentos_storage_select_policy ON storage.objects;
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

DROP POLICY IF EXISTS documentos_storage_update_policy ON storage.objects;
CREATE POLICY documentos_storage_update_policy ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documentos'
    AND EXISTS (
      SELECT 1
      FROM public.documentos d
      WHERE d.storage_bucket = storage.objects.bucket_id
        AND d.storage_path = storage.objects.name
        AND public.is_empresa_member(d.empresa_id)
    )
  )
  WITH CHECK (bucket_id = 'documentos');

DROP POLICY IF EXISTS documentos_storage_delete_policy ON storage.objects;
CREATE POLICY documentos_storage_delete_policy ON storage.objects
  FOR DELETE TO authenticated
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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'documentos'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.documentos;
    END IF;
  END IF;
END;
$$;
