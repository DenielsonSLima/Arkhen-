-- Protocolo: estado operacional das obrigações por competência/empresa.

CREATE TABLE IF NOT EXISTS public.protocolos_entregas (
  id text PRIMARY KEY,
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  entrega_id text NOT NULL,
  competencia varchar(7) NOT NULL,
  periodo_referencia varchar(16) NOT NULL DEFAULT 'Mensal',
  status varchar(12) NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Concluído')),
  recebido_em timestamptz,
  concluido_por varchar(180),
  anotacoes_list jsonb NOT NULL DEFAULT '[]'::jsonb,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_protocolos_entregas_empresa_id
  ON public.protocolos_entregas (empresa_id, status, competencia, periodo_referencia);
CREATE INDEX IF NOT EXISTS idx_protocolos_entregas_entrega_id
  ON public.protocolos_entregas (entrega_id);

ALTER TABLE public.protocolos_entregas
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS protocolos_entregas_policy ON public.protocolos_entregas;
CREATE POLICY protocolos_entregas_policy
  ON public.protocolos_entregas
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

DROP TRIGGER IF EXISTS set_protocolos_entregas_updated_at ON public.protocolos_entregas;
CREATE TRIGGER set_protocolos_entregas_updated_at
  BEFORE UPDATE ON public.protocolos_entregas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DO $$
DECLARE
  t text := 'protocolos_entregas';
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
