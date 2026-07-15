-- Corrige a persistência operacional dos protocolos.
-- empresa_id identifica o escritório (tenant); cliente_id identifica a empresa atendida.

CREATE TABLE IF NOT EXISTS public.protocolos_entregas (
  id text PRIMARY KEY,
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
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

ALTER TABLE public.protocolos_entregas
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE;
ALTER TABLE public.protocolos_entregas
  ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.protocolos_entregas WHERE cliente_id IS NULL) THEN
    ALTER TABLE public.protocolos_entregas ALTER COLUMN cliente_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_protocolos_entregas_tenant_cliente
  ON public.protocolos_entregas (empresa_id, cliente_id, status, competencia);

ALTER TABLE public.protocolos_entregas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS protocolos_entregas_policy ON public.protocolos_entregas;
CREATE POLICY protocolos_entregas_policy
  ON public.protocolos_entregas
  FOR ALL TO authenticated
  USING (
    public.is_empresa_member(empresa_id)
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id AND c.empresa_id = protocolos_entregas.empresa_id
    )
  )
  WITH CHECK (
    public.is_empresa_member(empresa_id)
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id AND c.empresa_id = protocolos_entregas.empresa_id
    )
  );

DROP TRIGGER IF EXISTS set_protocolos_entregas_updated_at ON public.protocolos_entregas;
CREATE TRIGGER set_protocolos_entregas_updated_at
  BEFORE UPDATE ON public.protocolos_entregas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.configuracoes_protocolos_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  configs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, cliente_id)
);

ALTER TABLE public.configuracoes_protocolos_empresas
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE;
ALTER TABLE public.configuracoes_protocolos_empresas
  ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
ALTER TABLE public.configuracoes_protocolos_empresas
  DROP CONSTRAINT IF EXISTS configuracoes_protocolos_empresas_empresa_id_key;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.configuracoes_protocolos_empresas WHERE cliente_id IS NULL) THEN
    ALTER TABLE public.configuracoes_protocolos_empresas ALTER COLUMN cliente_id SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.configuracoes_protocolos_empresas'::regclass
      AND contype = 'u'
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.configuracoes_protocolos_empresas'::regclass AND attname = 'empresa_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.configuracoes_protocolos_empresas'::regclass AND attname = 'cliente_id')
      ]::smallint[]
  ) THEN
    ALTER TABLE public.configuracoes_protocolos_empresas
      ADD CONSTRAINT configuracoes_protocolos_empresas_tenant_cliente_key
      UNIQUE (empresa_id, cliente_id);
  END IF;
END $$;

ALTER TABLE public.configuracoes_protocolos_empresas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS configuracoes_protocolos_empresas_policy ON public.configuracoes_protocolos_empresas;
CREATE POLICY configuracoes_protocolos_empresas_policy
  ON public.configuracoes_protocolos_empresas
  FOR ALL TO authenticated
  USING (
    public.is_empresa_member(empresa_id)
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id AND c.empresa_id = configuracoes_protocolos_empresas.empresa_id
    )
  )
  WITH CHECK (
    public.is_empresa_member(empresa_id)
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id AND c.empresa_id = configuracoes_protocolos_empresas.empresa_id
    )
  );

DROP TRIGGER IF EXISTS set_configuracoes_protocolos_empresas_updated_at ON public.configuracoes_protocolos_empresas;
CREATE TRIGGER set_configuracoes_protocolos_empresas_updated_at
  BEFORE UPDATE ON public.configuracoes_protocolos_empresas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'protocolos_entregas'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.protocolos_entregas;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'configuracoes_protocolos_empresas'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.configuracoes_protocolos_empresas;
    END IF;
  END IF;
END $$;
