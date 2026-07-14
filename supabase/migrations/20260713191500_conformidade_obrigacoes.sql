-- Conformidade: progresso operacional por obrigação.

CREATE TABLE IF NOT EXISTS public.conformidade_obrigacoes (
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  obrigacao_id text NOT NULL,
  cliente_id uuid,
  status varchar(12) NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Em andamento', 'Concluído')),
  responsavel varchar(180),
  etapas jsonb NOT NULL DEFAULT '[]'::jsonb,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, obrigacao_id)
);

CREATE INDEX IF NOT EXISTS idx_conformidade_obrigacoes_empresa_id
  ON public.conformidade_obrigacoes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_conformidade_obrigacoes_obrigacao_id
  ON public.conformidade_obrigacoes (obrigacao_id);
CREATE INDEX IF NOT EXISTS idx_conformidade_obrigacoes_cliente_id
  ON public.conformidade_obrigacoes (cliente_id);

ALTER TABLE public.conformidade_obrigacoes
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conformidade_obrigacoes_policy ON public.conformidade_obrigacoes;
CREATE POLICY conformidade_obrigacoes_policy
  ON public.conformidade_obrigacoes
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

DROP TRIGGER IF EXISTS set_conformidade_obrigacoes_updated_at ON public.conformidade_obrigacoes;
CREATE TRIGGER set_conformidade_obrigacoes_updated_at
  BEFORE UPDATE ON public.conformidade_obrigacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DO $$
DECLARE
  t text := 'conformidade_obrigacoes';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
    END IF;
  END IF;
END $$;
