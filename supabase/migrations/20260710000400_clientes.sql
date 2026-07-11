CREATE TABLE IF NOT EXISTS public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  razao_social text NOT NULL DEFAULT '',
  cnpj text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT 'Simples Nacional' CHECK (tipo IN ('PF', 'MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Isenta')),
  categoria_cliente text,
  tipo_estabelecimento text NOT NULL DEFAULT 'Matriz' CHECK (tipo_estabelecimento IN ('Matriz', 'Filial')),
  logo text,
  funcionarios_count integer NOT NULL DEFAULT 0 CHECK (funcionarios_count >= 0),
  status text NOT NULL DEFAULT 'Ativa' CHECK (status IN ('Ativa', 'Inativa')),
  email text NOT NULL DEFAULT '',
  telefone text NOT NULL DEFAULT '',
  endereco text NOT NULL DEFAULT '',
  cidade text,
  uf text,
  cep text,
  bairro text,
  contato text,
  inscricao_estadual text,
  funcionarios jsonb NOT NULL DEFAULT '[]'::jsonb,
  ferias jsonb NOT NULL DEFAULT '[]'::jsonb,
  documentos jsonb NOT NULL DEFAULT '[]'::jsonb,
  pastas_documentos text[] NOT NULL DEFAULT ARRAY[]::text[],
  categorias_documentos text[] NOT NULL DEFAULT ARRAY[]::text[],
  capital_social numeric,
  socios jsonb NOT NULL DEFAULT '[]'::jsonb,
  historico_corporativo jsonb NOT NULL DEFAULT '[]'::jsonb,
  certificados jsonb NOT NULL DEFAULT '[]'::jsonb,
  polos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clientes_empresa_id ON public.clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_status ON public.clientes(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON public.clientes(empresa_id, nome);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clientes_tenant_policy ON public.clientes;
CREATE POLICY clientes_tenant_policy ON public.clientes
  FOR ALL
  TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

DROP TRIGGER IF EXISTS trg_clientes_updated_at ON public.clientes;
CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
