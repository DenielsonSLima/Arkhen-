CREATE TABLE IF NOT EXISTS public.documentos_compartilhamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  documento_id uuid REFERENCES public.documentos(id) ON DELETE SET NULL,
  documento_nome text NOT NULL,
  empresa_nome text NOT NULL,
  gerado_por text NOT NULL DEFAULT 'Sistema',
  tempo_limite text NOT NULL,
  expires_at timestamptz NOT NULL,
  senha_hash text,
  senha_visualizacao text,
  arquivo_url text,
  status text NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Expirado')),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

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
