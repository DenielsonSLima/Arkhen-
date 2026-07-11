-- Parametrização: base de configuração por módulo (cadastros/submódulos).

CREATE TABLE IF NOT EXISTS public.parametrizacao_cnaes (
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  codigo varchar(40) NOT NULL,
  descricao text NOT NULL,
  simples_nacional boolean NOT NULL DEFAULT true,
  simples_anexo varchar(20) NOT NULL DEFAULT 'N/A' CHECK (
    simples_anexo IN ('Anexo I', 'Anexo II', 'Anexo III', 'Anexo IV', 'Anexo V', 'N/A')
  ),
  presuncao_irpj numeric(7,2) NOT NULL DEFAULT 0,
  presuncao_csll numeric(7,2) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);

CREATE TABLE IF NOT EXISTS public.parametrizacao_regras_imposto (
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome varchar(180) NOT NULL,
  regime varchar(30) NOT NULL CHECK (regime IN ('Lucro Presumido', 'Lucro Real')),
  cnae_codigo varchar(40) NOT NULL,
  cst_pis varchar(10) NOT NULL,
  aliquota_pis numeric(7,2) NOT NULL DEFAULT 0,
  cst_cofins varchar(10) NOT NULL,
  aliquota_cofins numeric(7,2) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.parametrizacao_regras_cnab (
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome varchar(220) NOT NULL,
  banco varchar(80) NOT NULL,
  tipo_regra varchar(20) NOT NULL CHECK (tipo_regra IN ('cobranca', 'conciliacao')),
  multa numeric(7,2),
  juros numeric(7,2),
  dias_tolerancia integer,
  padrao_texto text,
  conta_contabil text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parametrizacao_regras_cnab_check_cobranca CHECK (
    (tipo_regra <> 'cobranca') OR (multa IS NOT NULL AND juros IS NOT NULL AND dias_tolerancia IS NOT NULL)
  ),
  CONSTRAINT parametrizacao_regras_cnab_check_conciliacao CHECK (
    (tipo_regra <> 'conciliacao') OR (padrao_texto IS NOT NULL AND conta_contabil IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.parametrizacao_regimes_tributarios (
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  id text NOT NULL,
  title varchar(180) NOT NULL,
  limit varchar(120) NOT NULL,
  desc text NOT NULL,
  positives text[] NOT NULL DEFAULT '{}'::text[],
  negatives text[] NOT NULL DEFAULT '{}'::text[],
  color varchar(80) NOT NULL DEFAULT 'default',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, id)
);

CREATE TABLE IF NOT EXISTS public.parametrizacao_prazos_entrega (
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  regime varchar(40) NOT NULL,
  entrega_id varchar(80) NOT NULL,
  entrega_nome varchar(180) NOT NULL,
  categoria varchar(40) NOT NULL DEFAULT 'Fiscal',
  dia_vencimento integer NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  referencia_mes_anterior boolean NOT NULL DEFAULT true,
  fechamento varchar(20) NOT NULL DEFAULT 'mensal' CHECK (fechamento IN ('mensal', 'quinzenal', 'trimestral', 'semestral')),
  dia_vencimento_primeira_quinzena integer NOT NULL DEFAULT 1 CHECK (dia_vencimento_primeira_quinzena BETWEEN 1 AND 31),
  dia_vencimento_segunda_quinzena integer NOT NULL DEFAULT 1 CHECK (dia_vencimento_segunda_quinzena BETWEEN 1 AND 31),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, regime, entrega_id)
);

CREATE TABLE IF NOT EXISTS public.parametrizacao_protocolos_tipos (
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  id text PRIMARY KEY,
  nome text NOT NULL,
  categoria varchar(20) NOT NULL CHECK (categoria IN ('Fiscal', 'Contábil', 'Trabalhista', 'Financeiro', 'Documentos', 'NF-e', 'NFC-e'),
  descricao text NOT NULL DEFAULT '',
  dia_limite integer NOT NULL CHECK (dia_limite BETWEEN 1 AND 31),
  status varchar(10) NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
  regimes text[] NOT NULL DEFAULT '{}'::text[],
  periodicidade_padrao varchar(20) NOT NULL DEFAULT 'mensal' CHECK (periodicidade_padrao IN ('mensal', 'quinzenal', 'trimestral', 'semestral')),
  origem_padrao varchar(20) NOT NULL DEFAULT 'Cliente envia' CHECK (origem_padrao IN ('Cliente envia', 'Escritório envia', 'Ambos')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.parametrizacao_tipos_empresa (
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  id text NOT NULL,
  nome text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  status varchar(12) NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo', 'Padrão')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, id)
);

CREATE TABLE IF NOT EXISTS public.parametrizacao_natureza_juridica (
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  id text NOT NULL,
  nome text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  status varchar(12) NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo', 'Padrão')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, id)
);

CREATE TABLE IF NOT EXISTS public.parametrizacao_tipos_parceiros (
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  id text NOT NULL,
  nome text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  status varchar(12) NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo', 'Padrão')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, id)
);

CREATE TABLE IF NOT EXISTS public.parametrizacao_tipos_documentos (
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  id text NOT NULL,
  nome text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  status varchar(12) NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo', 'Padrão')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, id)
);

CREATE TABLE IF NOT EXISTS public.parametrizacao_categorias_clientes (
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  id text NOT NULL,
  nome text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  status varchar(12) NOT NULL DEFAULT 'Ativa' CHECK (status IN ('Ativa', 'Inativa')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, id)
);

CREATE TABLE IF NOT EXISTS public.parametrizacao_checklist_modelos (
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  id text NOT NULL,
  nome text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  etapas text[] NOT NULL DEFAULT '{}'::text[],
  tipos text[] NOT NULL DEFAULT '{}'::text[],
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, id)
);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'parametrizacao_cnaes',
    'parametrizacao_regras_imposto',
    'parametrizacao_regras_cnab',
    'parametrizacao_regimes_tributarios',
    'parametrizacao_prazos_entrega',
    'parametrizacao_protocolos_tipos',
    'parametrizacao_tipos_empresa',
    'parametrizacao_natureza_juridica',
    'parametrizacao_tipos_parceiros',
    'parametrizacao_tipos_documentos',
    'parametrizacao_categorias_clientes',
    'parametrizacao_checklist_modelos'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_%I_updated_at ON public.%I',
      replace(t, 'parametrizacao_', ''),
      t
    );

    EXECUTE format(
      'CREATE TRIGGER set_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      replace(t, 'parametrizacao_', ''),
      t
    );
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY[
      'parametrizacao_cnaes',
      'parametrizacao_regras_imposto',
      'parametrizacao_regras_cnab',
      'parametrizacao_regimes_tributarios',
      'parametrizacao_prazos_entrega',
      'parametrizacao_protocolos_tipos',
      'parametrizacao_tipos_empresa',
      'parametrizacao_natureza_juridica',
      'parametrizacao_tipos_parceiros',
      'parametrizacao_tipos_documentos',
      'parametrizacao_categorias_clientes',
      'parametrizacao_checklist_modelos'
    ] LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
      END IF;
    END LOOP;
  END IF;

  DROP POLICY IF EXISTS parametrizacao_cnaes_policy ON public.parametrizacao_cnaes;
  CREATE POLICY parametrizacao_cnaes_policy ON public.parametrizacao_cnaes
    FOR ALL TO authenticated
    USING (public.is_empresa_member(empresa_id))
    WITH CHECK (public.is_empresa_member(empresa_id));

  DROP POLICY IF EXISTS parametrizacao_regras_imposto_policy ON public.parametrizacao_regras_imposto;
  CREATE POLICY parametrizacao_regras_imposto_policy ON public.parametrizacao_regras_imposto
    FOR ALL TO authenticated
    USING (public.is_empresa_member(empresa_id))
    WITH CHECK (public.is_empresa_member(empresa_id));

  DROP POLICY IF EXISTS parametrizacao_regras_cnab_policy ON public.parametrizacao_regras_cnab;
  CREATE POLICY parametrizacao_regras_cnab_policy ON public.parametrizacao_regras_cnab
    FOR ALL TO authenticated
    USING (public.is_empresa_member(empresa_id))
    WITH CHECK (public.is_empresa_member(empresa_id));

  DROP POLICY IF EXISTS parametrizacao_regimes_tributarios_policy ON public.parametrizacao_regimes_tributarios;
  CREATE POLICY parametrizacao_regimes_tributarios_policy ON public.parametrizacao_regimes_tributarios
    FOR ALL TO authenticated
    USING (public.is_empresa_member(empresa_id))
    WITH CHECK (public.is_empresa_member(empresa_id));

  DROP POLICY IF EXISTS parametrizacao_prazos_entrega_policy ON public.parametrizacao_prazos_entrega;
  CREATE POLICY parametrizacao_prazos_entrega_policy ON public.parametrizacao_prazos_entrega
    FOR ALL TO authenticated
    USING (public.is_empresa_member(empresa_id))
    WITH CHECK (public.is_empresa_member(empresa_id));

  DROP POLICY IF EXISTS parametrizacao_protocolos_tipos_policy ON public.parametrizacao_protocolos_tipos;
  CREATE POLICY parametrizacao_protocolos_tipos_policy ON public.parametrizacao_protocolos_tipos
    FOR ALL TO authenticated
    USING (public.is_empresa_member(empresa_id))
    WITH CHECK (public.is_empresa_member(empresa_id));

  DROP POLICY IF EXISTS parametrizacao_tipos_empresa_policy ON public.parametrizacao_tipos_empresa;
  CREATE POLICY parametrizacao_tipos_empresa_policy ON public.parametrizacao_tipos_empresa
    FOR ALL TO authenticated
    USING (public.is_empresa_member(empresa_id))
    WITH CHECK (public.is_empresa_member(empresa_id));

  DROP POLICY IF EXISTS parametrizacao_natureza_juridica_policy ON public.parametrizacao_natureza_juridica;
  CREATE POLICY parametrizacao_natureza_juridica_policy ON public.parametrizacao_natureza_juridica
    FOR ALL TO authenticated
    USING (public.is_empresa_member(empresa_id))
    WITH CHECK (public.is_empresa_member(empresa_id));

  DROP POLICY IF EXISTS parametrizacao_tipos_parceiros_policy ON public.parametrizacao_tipos_parceiros;
  CREATE POLICY parametrizacao_tipos_parceiros_policy ON public.parametrizacao_tipos_parceiros
    FOR ALL TO authenticated
    USING (public.is_empresa_member(empresa_id))
    WITH CHECK (public.is_empresa_member(empresa_id));

  DROP POLICY IF EXISTS parametrizacao_tipos_documentos_policy ON public.parametrizacao_tipos_documentos;
  CREATE POLICY parametrizacao_tipos_documentos_policy ON public.parametrizacao_tipos_documentos
    FOR ALL TO authenticated
    USING (public.is_empresa_member(empresa_id))
    WITH CHECK (public.is_empresa_member(empresa_id));

  DROP POLICY IF EXISTS parametrizacao_categorias_clientes_policy ON public.parametrizacao_categorias_clientes;
  CREATE POLICY parametrizacao_categorias_clientes_policy ON public.parametrizacao_categorias_clientes
    FOR ALL TO authenticated
    USING (public.is_empresa_member(empresa_id))
    WITH CHECK (public.is_empresa_member(empresa_id));

  DROP POLICY IF EXISTS parametrizacao_checklist_modelos_policy ON public.parametrizacao_checklist_modelos;
  CREATE POLICY parametrizacao_checklist_modelos_policy ON public.parametrizacao_checklist_modelos
    FOR ALL TO authenticated
    USING (public.is_empresa_member(empresa_id))
    WITH CHECK (public.is_empresa_member(empresa_id));
END;
$$;

CREATE INDEX IF NOT EXISTS idx_parametrizacao_cnaes_empresa_codigo ON public.parametrizacao_cnaes (empresa_id, codigo);
CREATE INDEX IF NOT EXISTS idx_parametrizacao_regras_imposto_empresa ON public.parametrizacao_regras_imposto (empresa_id);
CREATE INDEX IF NOT EXISTS idx_parametrizacao_regras_cnab_empresa ON public.parametrizacao_regras_cnab (empresa_id);
CREATE INDEX IF NOT EXISTS idx_parametrizacao_regimes_empresa ON public.parametrizacao_regimes_tributarios (empresa_id, id);
CREATE INDEX IF NOT EXISTS idx_parametrizacao_prazos_empresa_regime ON public.parametrizacao_prazos_entrega (empresa_id, regime);
CREATE INDEX IF NOT EXISTS idx_parametrizacao_protocolos_empresa ON public.parametrizacao_protocolos_tipos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_parametrizacao_tipos_empresa ON public.parametrizacao_tipos_empresa (empresa_id, id);
CREATE INDEX IF NOT EXISTS idx_parametrizacao_natureza_juridica_empresa ON public.parametrizacao_natureza_juridica (empresa_id, id);
CREATE INDEX IF NOT EXISTS idx_parametrizacao_tipos_parceiros_empresa ON public.parametrizacao_tipos_parceiros (empresa_id, id);
CREATE INDEX IF NOT EXISTS idx_parametrizacao_tipos_documentos_empresa ON public.parametrizacao_tipos_documentos (empresa_id, id);
CREATE INDEX IF NOT EXISTS idx_parametrizacao_categorias_clientes_empresa ON public.parametrizacao_categorias_clientes (empresa_id, id);
CREATE INDEX IF NOT EXISTS idx_parametrizacao_checklist_modelos_empresa ON public.parametrizacao_checklist_modelos (empresa_id, id);
