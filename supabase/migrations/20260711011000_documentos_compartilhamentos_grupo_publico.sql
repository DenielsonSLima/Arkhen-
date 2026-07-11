-- Compartilhamentos de documentos: suporte a lote via grupo único de acesso e metadados no retorno público.

ALTER TABLE public.documentos_compartilhamentos
  ADD COLUMN IF NOT EXISTS share_group_id uuid;

UPDATE public.documentos_compartilhamentos
  SET share_group_id = COALESCE(share_group_id, id)
  WHERE share_group_id IS NULL;

ALTER TABLE public.documentos_compartilhamentos
  ALTER COLUMN share_group_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documentos_compartilhamentos_share_group
  ON public.documentos_compartilhamentos (share_group_id);

CREATE OR REPLACE FUNCTION public.get_public_document_share(
  p_share_id uuid,
  p_password_hash text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  share_group_id uuid,
  documento text,
  documento_id uuid,
  empresa text,
  empresa_cnpj text,
  tempo_limite text,
  data_geracao timestamptz,
  data_expiracao timestamptz,
  senha_obrigatoria boolean,
  storage_bucket text,
  storage_path text,
  gerado_por text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    COALESCE(dc.share_group_id, dc.id),
    dc.documento_nome,
    dc.documento_id,
    dc.empresa_nome,
    e.cnpj,
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
    END,
    dc.gerado_por
  FROM public.documentos_compartilhamentos dc
  JOIN public.documentos d ON d.id = dc.documento_id
  JOIN public.empresas e ON e.id = dc.empresa_id
  WHERE COALESCE(dc.share_group_id, dc.id) = p_share_id
    AND dc.status = 'Ativo'
    AND dc.expires_at > now()
  ORDER BY dc.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_document_share(uuid, text) TO anon, authenticated;
