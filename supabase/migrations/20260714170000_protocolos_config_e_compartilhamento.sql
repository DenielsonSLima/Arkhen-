CREATE TABLE IF NOT EXISTS public.configuracoes_protocolos_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,
  configs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_configuracoes_protocolos_empresas_empresa_id
  ON public.configuracoes_protocolos_empresas (empresa_id);

DROP TRIGGER IF EXISTS set_configuracoes_protocolos_empresas_updated_at ON public.configuracoes_protocolos_empresas;
CREATE TRIGGER set_configuracoes_protocolos_empresas_updated_at
  BEFORE UPDATE ON public.configuracoes_protocolos_empresas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.configuracoes_protocolos_empresas
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS configuracoes_protocolos_empresas_policy ON public.configuracoes_protocolos_empresas;
CREATE POLICY configuracoes_protocolos_empresas_policy
  ON public.configuracoes_protocolos_empresas
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

ALTER TABLE public.configuracoes_compartilhamento
  ADD COLUMN IF NOT EXISTS tempo_padrao_minutos integer NOT NULL DEFAULT 180 CHECK (tempo_padrao_minutos >= 1),
  ADD COLUMN IF NOT EXISTS limitar_tipos text[] NOT NULL DEFAULT '{dre,balanco,social}'::text[],
  ADD COLUMN IF NOT EXISTS prazos_exigem_senha text[] NOT NULL DEFAULT '{12 horas,24 horas,3 dias}'::text[];
