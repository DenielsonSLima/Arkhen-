-- Base multi-tenant do modulo Reforma Tributaria.

CREATE TABLE IF NOT EXISTS public.reforma_tributaria_adequacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'nao_iniciado' CHECK (status IN (
    'nao_iniciado', 'aguardando_informacoes', 'em_configuracao',
    'aguardando_xml', 'xml_inconsistente', 'adequado', 'nao_aplicavel'
  )),
  emissor text NOT NULL DEFAULT '',
  ambiente text NOT NULL DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao', 'producao')),
  tipos_documentos text[] NOT NULL DEFAULT '{}',
  responsavel text NOT NULL DEFAULT '',
  prazo date NOT NULL DEFAULT '2026-08-03',
  checklist jsonb NOT NULL DEFAULT '{
    "emissor_atualizado": false,
    "cadastros_revisados": false,
    "cst_configurado": false,
    "classificacao_configurada": false,
    "aliquotas_configuradas": false,
    "totalizadores_configurados": false,
    "xml_emitido": false,
    "xml_validado": false
  }'::jsonb,
  observacoes text NOT NULL DEFAULT '',
  atualizado_por uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, cliente_id),
  CHECK (jsonb_typeof(checklist) = 'object')
);

CREATE TABLE IF NOT EXISTS public.reforma_tributaria_validacoes_xml (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  documento_id uuid REFERENCES public.documentos(id) ON DELETE SET NULL,
  arquivo_nome text NOT NULL,
  tipo_documento text NOT NULL CHECK (tipo_documento IN ('nfe', 'nfce', 'nfse', 'cte', 'mdfe', 'desconhecido')),
  chave_acesso text,
  emitido_em timestamptz,
  arquivo_hash_sha256 text NOT NULL,
  resultado text NOT NULL CHECK (resultado IN ('valido', 'alerta', 'invalido')),
  campos jsonb NOT NULL DEFAULT '{}'::jsonb,
  inconsistencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  versao_regra text NOT NULL DEFAULT 'rtc-2026.1',
  validado_por uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(campos) = 'object'),
  CHECK (jsonb_typeof(inconsistencias) = 'array'),
  CHECK (arquivo_hash_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE TABLE IF NOT EXISTS public.reforma_tributaria_simulacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('ibs_cbs', 'split_payment')),
  competencia date NOT NULL,
  entrada jsonb NOT NULL,
  resultado jsonb NOT NULL,
  versao_regra text NOT NULL DEFAULT 'cenario-parametrico-2026.1',
  criado_por uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(entrada) = 'object'),
  CHECK (jsonb_typeof(resultado) = 'object')
);

CREATE TABLE IF NOT EXISTS public.reforma_tributaria_decisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  simulacao_id uuid REFERENCES public.reforma_tributaria_simulacoes(id) ON DELETE SET NULL,
  decisao text NOT NULL CHECK (decisao IN ('manter_simples', 'regime_regular', 'inconclusivo', 'pendente')),
  parecer text NOT NULL DEFAULT '',
  ciencia_cliente_em timestamptz,
  comprovante_documento_id uuid REFERENCES public.documentos(id) ON DELETE SET NULL,
  periodo_inicio date NOT NULL DEFAULT '2027-01-01',
  periodo_fim date NOT NULL DEFAULT '2027-06-30',
  decidido_por uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (periodo_fim >= periodo_inicio)
);

CREATE INDEX IF NOT EXISTS idx_reforma_adequacoes_empresa_status
  ON public.reforma_tributaria_adequacoes (empresa_id, status, prazo);
CREATE INDEX IF NOT EXISTS idx_reforma_validacoes_empresa_cliente_data
  ON public.reforma_tributaria_validacoes_xml (empresa_id, cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reforma_simulacoes_empresa_cliente_data
  ON public.reforma_tributaria_simulacoes (empresa_id, cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reforma_decisoes_empresa_cliente_data
  ON public.reforma_tributaria_decisoes (empresa_id, cliente_id, created_at DESC);

DROP TRIGGER IF EXISTS set_reforma_adequacoes_updated_at ON public.reforma_tributaria_adequacoes;
CREATE TRIGGER set_reforma_adequacoes_updated_at
  BEFORE UPDATE ON public.reforma_tributaria_adequacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS set_reforma_decisoes_updated_at ON public.reforma_tributaria_decisoes;
CREATE TRIGGER set_reforma_decisoes_updated_at
  BEFORE UPDATE ON public.reforma_tributaria_decisoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.reforma_tributaria_adequacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reforma_tributaria_validacoes_xml ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reforma_tributaria_simulacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reforma_tributaria_decisoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY reforma_adequacoes_select_tenant ON public.reforma_tributaria_adequacoes
  FOR SELECT TO authenticated USING (
    public.is_empresa_member(empresa_id) AND public.modulo_sistema_habilitado('reforma-tributaria')
  );
CREATE POLICY reforma_validacoes_select_tenant ON public.reforma_tributaria_validacoes_xml
  FOR SELECT TO authenticated USING (
    public.is_empresa_member(empresa_id) AND public.modulo_sistema_habilitado('reforma-tributaria')
  );
CREATE POLICY reforma_simulacoes_select_tenant ON public.reforma_tributaria_simulacoes
  FOR SELECT TO authenticated USING (
    public.is_empresa_member(empresa_id) AND public.modulo_sistema_habilitado('reforma-tributaria')
  );
CREATE POLICY reforma_decisoes_select_tenant ON public.reforma_tributaria_decisoes
  FOR SELECT TO authenticated USING (
    public.is_empresa_member(empresa_id) AND public.modulo_sistema_habilitado('reforma-tributaria')
  );

REVOKE INSERT, UPDATE, DELETE ON public.reforma_tributaria_adequacoes FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.reforma_tributaria_validacoes_xml FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.reforma_tributaria_simulacoes FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.reforma_tributaria_decisoes FROM authenticated, anon;
GRANT SELECT ON public.reforma_tributaria_adequacoes TO authenticated;
GRANT SELECT ON public.reforma_tributaria_validacoes_xml TO authenticated;
GRANT SELECT ON public.reforma_tributaria_simulacoes TO authenticated;
GRANT SELECT ON public.reforma_tributaria_decisoes TO authenticated;

DO $$
DECLARE
  v_table text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RETURN;
  END IF;
  FOREACH v_table IN ARRAY ARRAY[
    'reforma_tributaria_adequacoes',
    'reforma_tributaria_validacoes_xml',
    'reforma_tributaria_simulacoes',
    'reforma_tributaria_decisoes'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = v_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
    END IF;
  END LOOP;
END;
$$;
