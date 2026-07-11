-- Parametrizacao de pastas padrao de documentos por empresa.

CREATE TABLE IF NOT EXISTS public.parametrizacao_pastas_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo varchar(90) NOT NULL,
  caminho text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  sistema boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parametrizacao_pastas_documentos_codigo_unique UNIQUE (empresa_id, codigo),
  CONSTRAINT parametrizacao_pastas_documentos_caminho_unique UNIQUE (empresa_id, caminho)
);

ALTER TABLE public.parametrizacao_pastas_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parametrizacao_pastas_documentos_policy ON public.parametrizacao_pastas_documentos;
CREATE POLICY parametrizacao_pastas_documentos_policy ON public.parametrizacao_pastas_documentos
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

DROP TRIGGER IF EXISTS set_pastas_documentos_updated_at ON public.parametrizacao_pastas_documentos;
CREATE TRIGGER set_pastas_documentos_updated_at
  BEFORE UPDATE ON public.parametrizacao_pastas_documentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_parametrizacao_pastas_documentos_empresa_ordem
  ON public.parametrizacao_pastas_documentos (empresa_id, ordem, caminho);

CREATE OR REPLACE FUNCTION public.seed_pastas_documentos_padrao_empresa(p_empresa_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.parametrizacao_pastas_documentos (
    empresa_id, codigo, caminho, descricao, sistema, ativo, ordem
  )
  SELECT p_empresa_id, seed.codigo, seed.caminho, seed.descricao, true, true, seed.ordem
  FROM (VALUES
    ('societario', 'Societario', 'Atos constitutivos, alteracoes contratuais, atas e registros societarios.', 10),
    ('societario-documentos-socios', 'Societario/Documentos dos Socios', 'RG, CPF, comprovantes, documentos pessoais e informacoes dos socios.', 20),
    ('societario-contrato-social', 'Societario/Contrato Social e Alteracoes', 'Contrato social, requerimento de empresario, alteracoes e consolidacoes.', 30),
    ('fiscal', 'Fiscal', 'Documentos fiscais, notas, apuracoes, guias e comprovantes tributarios.', 40),
    ('fiscal-notas-fiscais', 'Fiscal/Notas Fiscais', 'XML, DANFE, notas de servico e demais documentos fiscais emitidos ou recebidos.', 50),
    ('fiscal-guias-comprovantes', 'Fiscal/Guias e Comprovantes', 'DAS, DARF, DAE, GPS, DCTFWeb e comprovantes de pagamento.', 60),
    ('contabil', 'Contabil', 'Balancetes, demonstracoes, livros contabeis, ECD, ECF e documentos de fechamento.', 70),
    ('financeiro', 'Financeiro', 'Extratos, contas bancarias, comprovantes e documentos financeiros do cliente.', 75),
    ('financeiro-contas-bancarias', 'Financeiro/Contas Bancarias', 'Dados bancarios, comprovantes de abertura de conta, extratos e conciliacoes.', 80),
    ('trabalhista', 'Trabalhista', 'Folha, admissao, rescisao, ferias, encargos e documentos de colaboradores.', 90),
    ('certidoes-licencas', 'Certidoes e Licencas', 'CNDs, alvaras, licencas, certificados digitais e regularidades.', 100),
    ('contratos-procuracoes', 'Contratos e Procuracoes', 'Contratos de prestacao, procuracoes, autorizacoes e instrumentos comerciais.', 110),
    ('bancario-financiamentos', 'Bancario e Financiamentos', 'Financiamentos, emprestimos, garantias, parcelas e contratos bancarios.', 120)
  ) AS seed(codigo, caminho, descricao, ordem)
  ON CONFLICT (empresa_id, codigo) DO UPDATE
    SET caminho = excluded.caminho,
        descricao = excluded.descricao,
        sistema = true,
        ordem = excluded.ordem,
        updated_at = now();
$$;

CREATE OR REPLACE FUNCTION public.expand_pastas_documentos_paths(p_paths text[])
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  WITH input_paths AS (
    SELECT regexp_split_to_array(trim(path), '/') AS parts
    FROM unnest(COALESCE(p_paths, '{}'::text[])) AS path
    WHERE trim(path) <> ''
  ),
  expanded AS (
    SELECT array_to_string(parts[1:(s.idx)], '/') AS path
    FROM input_paths
    CROSS JOIN LATERAL generate_subscripts(parts, 1) AS s(idx)
  )
  SELECT COALESCE(array_agg(DISTINCT path ORDER BY path), '{}'::text[])
  FROM expanded
  WHERE path <> '';
$$;

CREATE OR REPLACE FUNCTION public.get_active_pastas_documentos_padrao(p_empresa_id uuid)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paths text[];
BEGIN
  PERFORM public.seed_pastas_documentos_padrao_empresa(p_empresa_id);

  SELECT COALESCE(array_agg(caminho ORDER BY ordem, caminho), '{}'::text[])
  INTO v_paths
  FROM public.parametrizacao_pastas_documentos
  WHERE empresa_id = p_empresa_id
    AND ativo = true;

  RETURN public.expand_pastas_documentos_paths(v_paths);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_default_clientes_pastas_documentos()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.pastas_documentos IS NULL OR cardinality(NEW.pastas_documentos) = 0 THEN
    NEW.pastas_documentos := public.get_active_pastas_documentos_padrao(NEW.empresa_id);
  ELSE
    NEW.pastas_documentos := public.expand_pastas_documentos_paths(NEW.pastas_documentos);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_clientes_pastas_documentos_before_insert ON public.clientes;
CREATE TRIGGER set_clientes_pastas_documentos_before_insert
  BEFORE INSERT ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_clientes_pastas_documentos();

INSERT INTO public.parametrizacao_pastas_documentos (empresa_id, codigo, caminho, descricao, sistema, ativo, ordem)
SELECT e.id, seed.codigo, seed.caminho, seed.descricao, true, true, seed.ordem
FROM public.empresas e
CROSS JOIN (VALUES
  ('societario', 'Societario', 'Atos constitutivos, alteracoes contratuais, atas e registros societarios.', 10),
  ('societario-documentos-socios', 'Societario/Documentos dos Socios', 'RG, CPF, comprovantes, documentos pessoais e informacoes dos socios.', 20),
  ('societario-contrato-social', 'Societario/Contrato Social e Alteracoes', 'Contrato social, requerimento de empresario, alteracoes e consolidacoes.', 30),
  ('fiscal', 'Fiscal', 'Documentos fiscais, notas, apuracoes, guias e comprovantes tributarios.', 40),
  ('fiscal-notas-fiscais', 'Fiscal/Notas Fiscais', 'XML, DANFE, notas de servico e demais documentos fiscais emitidos ou recebidos.', 50),
  ('fiscal-guias-comprovantes', 'Fiscal/Guias e Comprovantes', 'DAS, DARF, DAE, GPS, DCTFWeb e comprovantes de pagamento.', 60),
  ('contabil', 'Contabil', 'Balancetes, demonstracoes, livros contabeis, ECD, ECF e documentos de fechamento.', 70),
  ('financeiro', 'Financeiro', 'Extratos, contas bancarias, comprovantes e documentos financeiros do cliente.', 75),
  ('financeiro-contas-bancarias', 'Financeiro/Contas Bancarias', 'Dados bancarios, comprovantes de abertura de conta, extratos e conciliacoes.', 80),
  ('trabalhista', 'Trabalhista', 'Folha, admissao, rescisao, ferias, encargos e documentos de colaboradores.', 90),
  ('certidoes-licencas', 'Certidoes e Licencas', 'CNDs, alvaras, licencas, certificados digitais e regularidades.', 100),
  ('contratos-procuracoes', 'Contratos e Procuracoes', 'Contratos de prestacao, procuracoes, autorizacoes e instrumentos comerciais.', 110),
  ('bancario-financiamentos', 'Bancario e Financiamentos', 'Financiamentos, emprestimos, garantias, parcelas e contratos bancarios.', 120)
) AS seed(codigo, caminho, descricao, ordem)
ON CONFLICT (empresa_id, codigo) DO UPDATE
  SET caminho = excluded.caminho,
      descricao = excluded.descricao,
      sistema = true,
      ordem = excluded.ordem,
      updated_at = now();

UPDATE public.clientes c
SET pastas_documentos = public.expand_pastas_documentos_paths(
  COALESCE(c.pastas_documentos, '{}'::text[]) || public.get_active_pastas_documentos_padrao(c.empresa_id)
);

CREATE OR REPLACE FUNCTION public.block_delete_parametrizacao_pastas_documentos_sistema()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.sistema THEN
    RAISE EXCEPTION 'Pastas padrao do sistema nao podem ser excluidas. Inative o registro.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_delete_parametrizacao_pastas_documentos_sistema ON public.parametrizacao_pastas_documentos;
CREATE TRIGGER trg_block_delete_parametrizacao_pastas_documentos_sistema
  BEFORE DELETE ON public.parametrizacao_pastas_documentos
  FOR EACH ROW EXECUTE FUNCTION public.block_delete_parametrizacao_pastas_documentos_sistema();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'parametrizacao_pastas_documentos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.parametrizacao_pastas_documentos;
  END IF;
END;
$$;
