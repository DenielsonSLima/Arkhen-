CREATE TABLE IF NOT EXISTS public.documentos_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  sistema boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 100,
  scope_key text GENERATED ALWAYS AS (COALESCE(cliente_id::text, 'global')) STORED,
  nome_key text GENERATED ALWAYS AS (lower(btrim(nome))) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documentos_categorias_nome_check CHECK (btrim(nome) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_documentos_categorias_scope_nome
  ON public.documentos_categorias (empresa_id, scope_key, nome_key);

CREATE INDEX IF NOT EXISTS idx_documentos_categorias_empresa_cliente
  ON public.documentos_categorias (empresa_id, cliente_id, ativo, ordem);

ALTER TABLE public.documentos_categorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS documentos_categorias_tenant_policy ON public.documentos_categorias;
CREATE POLICY documentos_categorias_tenant_policy ON public.documentos_categorias
  FOR ALL
  TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (
    public.is_empresa_member(empresa_id)
    AND (
      cliente_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.clientes c
        WHERE c.id = documentos_categorias.cliente_id
          AND c.empresa_id = documentos_categorias.empresa_id
      )
    )
  );

DROP TRIGGER IF EXISTS trg_documentos_categorias_updated_at ON public.documentos_categorias;
CREATE TRIGGER trg_documentos_categorias_updated_at
  BEFORE UPDATE ON public.documentos_categorias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.documentos_categorias (empresa_id, cliente_id, nome, ativo, sistema, ordem)
SELECT e.id, NULL, seed.nome, true, true, seed.ordem
FROM public.empresas e
CROSS JOIN (VALUES
  ('Contratos', 10),
  ('Procurações', 20),
  ('Certidões', 30),
  ('Impostos', 40),
  ('Trabalhista', 50),
  ('Outros', 60)
) AS seed(nome, ordem)
ON CONFLICT (empresa_id, scope_key, nome_key) DO UPDATE
  SET ativo = true,
      sistema = true,
      ordem = excluded.ordem,
      updated_at = now();

INSERT INTO public.documentos_categorias (empresa_id, cliente_id, nome, ativo, sistema, ordem)
SELECT c.empresa_id, c.id, category.nome, true, false, 100
FROM public.clientes c
CROSS JOIN LATERAL unnest(c.categorias_documentos) AS category(nome)
WHERE btrim(category.nome) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.documentos_categorias dc
    WHERE dc.empresa_id = c.empresa_id
      AND dc.scope_key = c.id::text
      AND dc.nome_key = lower(btrim(category.nome))
  )
ON CONFLICT (empresa_id, scope_key, nome_key) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'documentos_categorias'
    )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.documentos_categorias;
  END IF;
END $$;
