CREATE TABLE IF NOT EXISTS public.documentos_compartilhamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  documento_id uuid NOT NULL REFERENCES public.documentos(id) ON DELETE CASCADE,
  documento_nome text NOT NULL,
  empresa_nome text NOT NULL,
  gerado_por text NOT NULL DEFAULT 'Sistema',
  tempo_limite text NOT NULL,
  expires_at timestamptz NOT NULL,
  senha_hash text,
  status text NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Expirado')),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documentos_compartilhamentos
  DROP COLUMN IF EXISTS senha_visualizacao,
  DROP COLUMN IF EXISTS arquivo_url;

ALTER TABLE public.documentos_compartilhamentos
  ALTER COLUMN documento_id SET NOT NULL,
  DROP CONSTRAINT IF EXISTS documentos_compartilhamentos_documento_id_fkey,
  ADD CONSTRAINT documentos_compartilhamentos_documento_id_fkey
    FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_documentos_compartilhamentos_empresa
  ON public.documentos_compartilhamentos (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documentos_compartilhamentos_expires
  ON public.documentos_compartilhamentos (expires_at)
  WHERE status = 'Ativo';

DROP TRIGGER IF EXISTS set_documentos_compartilhamentos_updated_at ON public.documentos_compartilhamentos;
CREATE TRIGGER set_documentos_compartilhamentos_updated_at
  BEFORE UPDATE ON public.documentos_compartilhamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.documentos_compartilhamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS documentos_compartilhamentos_tenant_policy ON public.documentos_compartilhamentos;
CREATE POLICY documentos_compartilhamentos_tenant_policy ON public.documentos_compartilhamentos
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

CREATE INDEX IF NOT EXISTS idx_documentos_compartilhamentos_documento
  ON public.documentos_compartilhamentos (documento_id);

CREATE INDEX IF NOT EXISTS idx_documentos_empresa_scope_created
  ON public.documentos (empresa_id, scope, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documentos_empresa_cliente_created
  ON public.documentos (empresa_id, cliente_id, created_at DESC);

DROP POLICY IF EXISTS documentos_select_policy ON public.documentos;
DROP POLICY IF EXISTS documentos_insert_policy ON public.documentos;
DROP POLICY IF EXISTS documentos_update_policy ON public.documentos;
DROP POLICY IF EXISTS documentos_delete_policy ON public.documentos;
DROP POLICY IF EXISTS documentos_tenant_policy ON public.documentos;

CREATE POLICY documentos_select_policy ON public.documentos
  FOR SELECT TO authenticated
  USING (
    public.is_empresa_member(empresa_id)
    AND (
      scope = 'empresa'
      OR (scope = 'pessoal' AND owner_user_id = auth.uid())
    )
  );

CREATE POLICY documentos_insert_policy ON public.documentos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_empresa_member(empresa_id)
    AND owner_user_id = auth.uid()
    AND (
      (scope = 'pessoal' AND cliente_id IS NULL)
      OR (
        scope = 'empresa'
        AND cliente_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.clientes c
          WHERE c.id::text = cliente_id
            AND c.empresa_id = documentos.empresa_id
        )
      )
    )
  );

CREATE POLICY documentos_update_policy ON public.documentos
  FOR UPDATE TO authenticated
  USING (
    public.is_empresa_member(empresa_id)
    AND (
      scope = 'empresa'
      OR (scope = 'pessoal' AND owner_user_id = auth.uid())
    )
  )
  WITH CHECK (
    public.is_empresa_member(empresa_id)
    AND (
      scope = 'empresa'
      OR (scope = 'pessoal' AND owner_user_id = auth.uid())
    )
  );

CREATE POLICY documentos_delete_policy ON public.documentos
  FOR DELETE TO authenticated
  USING (
    public.is_empresa_member(empresa_id)
    AND (
      scope = 'empresa'
      OR (scope = 'pessoal' AND owner_user_id = auth.uid())
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
        )
      )
    )
  );

DROP POLICY IF EXISTS documentos_storage_select_shared_policy ON storage.objects;
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

CREATE OR REPLACE FUNCTION public.get_public_document_share(
  p_share_id uuid,
  p_password_hash text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  documento text,
  empresa text,
  tempo_limite text,
  data_geracao timestamptz,
  data_expiracao timestamptz,
  senha_obrigatoria boolean,
  storage_bucket text,
  storage_path text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.documento_nome,
    dc.empresa_nome,
    dc.tempo_limite,
    dc.created_at,
    dc.expires_at,
    (dc.senha_hash IS NOT NULL),
    CASE
      WHEN dc.senha_hash IS NULL OR dc.senha_hash = p_password_hash THEN d.storage_bucket
      ELSE NULL
    END,
    CASE
      WHEN dc.senha_hash IS NULL OR dc.senha_hash = p_password_hash THEN d.storage_path
      ELSE NULL
    END
  FROM public.documentos_compartilhamentos dc
  JOIN public.documentos d ON d.id = dc.documento_id
  WHERE dc.id = p_share_id
    AND dc.status = 'Ativo'
    AND dc.expires_at > now()
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_document_share(uuid, text) TO anon, authenticated;
