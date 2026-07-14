-- Catálogo CNAE padrão e classificado por empresa.
-- As regras são mantidas pelo sistema; o escritório pode apenas ativar ou desativar itens.

ALTER TABLE public.parametrizacao_cnaes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS mei_permitido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mei_tipo text NOT NULL DEFAULT 'nao_aplicavel',
  ADD COLUMN IF NOT EXISTS mei_ocupacoes text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS regimes_permitidos text[] NOT NULL DEFAULT ARRAY['simples_nacional', 'lucro_presumido', 'lucro_real']::text[],
  ADD COLUMN IF NOT EXISTS anexos_simples text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS sujeito_fator_r boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS padrao_sistema boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS observacoes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fonte_cnae_url text NOT NULL DEFAULT 'https://concla.ibge.gov.br/busca-online-cnae.html',
  ADD COLUMN IF NOT EXISTS fonte_tributaria_url text NOT NULL DEFAULT 'https://www8.receita.fazenda.gov.br/simplesnacional/arquivos/manual/anexo_xi.pdf',
  ADD COLUMN IF NOT EXISTS classificacao_revisada_em date NOT NULL DEFAULT DATE '2026-07-14';

-- Compatibilidade com o gatilho legado compartilhado por tabelas de parametrização.
ALTER TABLE public.parametrizacao_regras_imposto
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.parametrizacao_cnaes
  DROP CONSTRAINT IF EXISTS parametrizacao_cnaes_mei_tipo_check,
  ADD CONSTRAINT parametrizacao_cnaes_mei_tipo_check
    CHECK (mei_tipo IN ('normal', 'caminhoneiro', 'nao_aplicavel')),
  DROP CONSTRAINT IF EXISTS parametrizacao_cnaes_mei_consistencia_check,
  ADD CONSTRAINT parametrizacao_cnaes_mei_consistencia_check
    CHECK ((mei_permitido AND mei_tipo <> 'nao_aplicavel') OR (NOT mei_permitido AND mei_tipo = 'nao_aplicavel')),
  DROP CONSTRAINT IF EXISTS parametrizacao_cnaes_regimes_check,
  ADD CONSTRAINT parametrizacao_cnaes_regimes_check
    CHECK (
      cardinality(regimes_permitidos) > 0
      AND regimes_permitidos <@ ARRAY['mei', 'simples_nacional', 'lucro_presumido', 'lucro_real']::text[]
    ),
  DROP CONSTRAINT IF EXISTS parametrizacao_cnaes_anexos_check,
  ADD CONSTRAINT parametrizacao_cnaes_anexos_check
    CHECK (anexos_simples <@ ARRAY['Anexo I', 'Anexo II', 'Anexo III', 'Anexo IV', 'Anexo V']::text[]);

-- Corrige códigos de classe usados anteriormente para as subclasses oficiais correspondentes.
UPDATE public.parametrizacao_regras_imposto SET cnae_codigo = '6201-5/01' WHERE cnae_codigo = '6201-5/00';
UPDATE public.parametrizacao_cnaes c
SET codigo = '6201-5/01'
WHERE codigo = '6201-5/00'
  AND NOT EXISTS (
    SELECT 1 FROM public.parametrizacao_cnaes x
    WHERE x.empresa_id = c.empresa_id AND x.codigo = '6201-5/01'
  );

UPDATE public.parametrizacao_regras_imposto SET cnae_codigo = '4711-3/01' WHERE cnae_codigo = '4711-3/00';
UPDATE public.parametrizacao_cnaes c
SET codigo = '4711-3/01'
WHERE codigo = '4711-3/00'
  AND NOT EXISTS (
    SELECT 1 FROM public.parametrizacao_cnaes x
    WHERE x.empresa_id = c.empresa_id AND x.codigo = '4711-3/01'
  );

CREATE OR REPLACE FUNCTION public.seed_catalogo_cnaes_empresa(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_empresa_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.empresas WHERE id = p_empresa_id) THEN
    RAISE EXCEPTION 'Empresa inválida para o catálogo CNAE';
  END IF;

  INSERT INTO public.parametrizacao_cnaes (
    empresa_id, codigo, descricao, simples_nacional, simples_anexo,
    presuncao_irpj, presuncao_csll, ativo, mei_permitido, mei_tipo,
    mei_ocupacoes, regimes_permitidos, anexos_simples, sujeito_fator_r,
    padrao_sistema, observacoes, fonte_cnae_url, fonte_tributaria_url,
    classificacao_revisada_em
  )
  SELECT
    p_empresa_id, s.codigo, s.descricao, s.simples_nacional, s.simples_anexo,
    s.presuncao_irpj, s.presuncao_csll, true, s.mei_permitido, s.mei_tipo,
    s.mei_ocupacoes, s.regimes_permitidos, s.anexos_simples, s.sujeito_fator_r,
    true, s.observacoes,
    'https://concla.ibge.gov.br/busca-online-cnae.html',
    'https://www8.receita.fazenda.gov.br/simplesnacional/arquivos/manual/anexo_xi.pdf',
    DATE '2026-07-14'
  FROM (VALUES
    ('4711-3/01', 'Comércio varejista de mercadorias em geral, com predominância de produtos alimentícios - hipermercados', true, 'Anexo I', 8.00, 12.00, false, 'nao_aplicavel', ARRAY[]::text[], ARRAY['simples_nacional','lucro_presumido','lucro_real']::text[], ARRAY['Anexo I']::text[], false, 'O regime efetivo também depende dos limites de receita e das demais vedações legais.'),
    ('4711-3/02', 'Comércio varejista de mercadorias em geral, com predominância de produtos alimentícios - supermercados', true, 'Anexo I', 8.00, 12.00, false, 'nao_aplicavel', ARRAY[]::text[], ARRAY['simples_nacional','lucro_presumido','lucro_real']::text[], ARRAY['Anexo I']::text[], false, 'O regime efetivo também depende dos limites de receita e das demais vedações legais.'),
    ('4712-1/00', 'Comércio varejista de mercadorias em geral, com predominância de produtos alimentícios - minimercados, mercearias e armazéns', true, 'Anexo I', 8.00, 12.00, true, 'normal', ARRAY['Merceeiro(a)/vendeiro(a) independente']::text[], ARRAY['mei','simples_nacional','lucro_presumido','lucro_real']::text[], ARRAY['Anexo I']::text[], false, 'Permitido ao MEI quando exercido conforme a ocupação oficial e atendidos os demais requisitos.'),
    ('6201-5/01', 'Desenvolvimento de programas de computador sob encomenda', true, 'Anexo III', 32.00, 32.00, false, 'nao_aplicavel', ARRAY[]::text[], ARRAY['simples_nacional','lucro_presumido','lucro_real']::text[], ARRAY['Anexo III','Anexo V']::text[], true, 'No Simples Nacional, a tributação pode ocorrer nos Anexos III ou V conforme o fator R.'),
    ('6911-7/01', 'Serviços advocatícios', true, 'Anexo IV', 32.00, 32.00, false, 'nao_aplicavel', ARRAY[]::text[], ARRAY['simples_nacional','lucro_presumido','lucro_real']::text[], ARRAY['Anexo IV']::text[], false, 'Serviços advocatícios são tributados pelo Anexo IV quando optantes pelo Simples Nacional.'),
    ('6920-6/01', 'Atividades de contabilidade', true, 'Anexo III', 32.00, 32.00, false, 'nao_aplicavel', ARRAY[]::text[], ARRAY['simples_nacional','lucro_presumido','lucro_real']::text[], ARRAY['Anexo III']::text[], false, 'Escritórios contábeis possuem regras específicas de ISS; confirmar a legislação municipal aplicável.'),
    ('7112-0/00', 'Serviços de engenharia', true, 'Anexo III', 32.00, 32.00, false, 'nao_aplicavel', ARRAY[]::text[], ARRAY['simples_nacional','lucro_presumido','lucro_real']::text[], ARRAY['Anexo III','Anexo V']::text[], true, 'No Simples Nacional, a tributação pode ocorrer nos Anexos III ou V conforme o fator R.'),
    ('8630-5/03', 'Atividade médica ambulatorial restrita a consultas', true, 'Anexo III', 32.00, 32.00, false, 'nao_aplicavel', ARRAY[]::text[], ARRAY['simples_nacional','lucro_presumido','lucro_real']::text[], ARRAY['Anexo III','Anexo V']::text[], true, 'No Simples Nacional, serviços de medicina podem ocorrer nos Anexos III ou V conforme o fator R.'),
    ('9602-5/01', 'Cabeleireiros, manicure e pedicure', true, 'Anexo III', 32.00, 32.00, true, 'normal', ARRAY['Barbeiro independente','Cabeleireiro(a) independente','Manicure/pedicure independente']::text[], ARRAY['mei','simples_nacional','lucro_presumido','lucro_real']::text[], ARRAY['Anexo III']::text[], false, 'Um mesmo CNAE possui mais de uma ocupação permitida ao MEI.'),
    ('9602-5/02', 'Atividades de estética e outros serviços de cuidados com a beleza', true, 'Anexo III', 32.00, 32.00, true, 'normal', ARRAY['Esteticista independente','Maquiador(a) independente','Depilador(a) independente']::text[], ARRAY['mei','simples_nacional','lucro_presumido','lucro_real']::text[], ARRAY['Anexo III']::text[], false, 'Um mesmo CNAE possui mais de uma ocupação permitida ao MEI.'),
    ('8599-6/04', 'Treinamento em desenvolvimento profissional e gerencial', true, 'Anexo III', 32.00, 32.00, true, 'normal', ARRAY['Instrutor(a) de cursos gerenciais independente']::text[], ARRAY['mei','simples_nacional','lucro_presumido','lucro_real']::text[], ARRAY['Anexo III']::text[], false, 'A ocupação informada deve corresponder ao serviço efetivamente prestado.'),
    ('4321-5/00', 'Instalação e manutenção elétrica', true, 'Anexo III', 32.00, 32.00, true, 'normal', ARRAY['Eletricista em residências e estabelecimentos comerciais independente','Instalador(a) de antenas de TV independente']::text[], ARRAY['mei','simples_nacional','lucro_presumido','lucro_real']::text[], ARRAY['Anexo III','Anexo IV']::text[], false, 'O anexo pode depender da natureza do contrato e do enquadramento do serviço de construção.'),
    ('4322-3/01', 'Instalações hidráulicas, sanitárias e de gás', true, 'Anexo III', 32.00, 32.00, true, 'normal', ARRAY['Bombeiro(a) hidráulico independente','Encanador independente']::text[], ARRAY['mei','simples_nacional','lucro_presumido','lucro_real']::text[], ARRAY['Anexo III','Anexo IV']::text[], false, 'O anexo pode depender da natureza do contrato e do enquadramento do serviço de construção.'),
    ('4520-0/01', 'Serviços de manutenção e reparação mecânica de veículos automotores', true, 'Anexo III', 32.00, 32.00, true, 'normal', ARRAY['Mecânico(a) de veículos independente','Vidraceiro de automóveis independente']::text[], ARRAY['mei','simples_nacional','lucro_presumido','lucro_real']::text[], ARRAY['Anexo III']::text[], false, 'Um mesmo CNAE possui mais de uma ocupação permitida ao MEI.'),
    ('5620-1/04', 'Fornecimento de alimentos preparados preponderantemente para consumo domiciliar', true, 'Anexo I', 8.00, 12.00, true, 'normal', ARRAY['Cozinheiro(a) que fornece refeições prontas e embaladas independente','Doceiro(a) independente','Marmiteiro(a) independente']::text[], ARRAY['mei','simples_nacional','lucro_presumido','lucro_real']::text[], ARRAY['Anexo I','Anexo II']::text[], false, 'A segregação da receita no Simples depende da operação efetivamente realizada.'),
    ('1412-6/02', 'Confecção, sob medida, de peças do vestuário, exceto roupas íntimas', true, 'Anexo II', 8.00, 12.00, true, 'normal', ARRAY['Alfaiate independente','Costureiro(a) de roupas sob medida independente']::text[], ARRAY['mei','simples_nacional','lucro_presumido','lucro_real']::text[], ARRAY['Anexo II','Anexo III']::text[], false, 'A segregação da receita depende de haver produção própria ou prestação de serviço.'),
    ('4930-2/01', 'Transporte rodoviário de carga, exceto produtos perigosos e mudanças, municipal', true, 'Anexo III', 8.00, 12.00, true, 'caminhoneiro', ARRAY['Transportador autônomo de carga - municipal']::text[], ARRAY['mei','simples_nacional','lucro_presumido','lucro_real']::text[], ARRAY['Anexo III']::text[], false, 'O MEI Caminhoneiro possui limite e contribuição previdenciária próprios.'),
    ('6422-1/00', 'Bancos múltiplos, com carteira comercial', false, 'N/A', 0.00, 0.00, false, 'nao_aplicavel', ARRAY[]::text[], ARRAY['lucro_real']::text[], ARRAY[]::text[], false, 'Instituições bancárias estão entre as pessoas jurídicas obrigadas à apuração pelo Lucro Real.')
  ) AS s(
    codigo, descricao, simples_nacional, simples_anexo, presuncao_irpj, presuncao_csll,
    mei_permitido, mei_tipo, mei_ocupacoes, regimes_permitidos, anexos_simples,
    sujeito_fator_r, observacoes
  )
  ON CONFLICT (empresa_id, codigo) DO UPDATE SET
    descricao = EXCLUDED.descricao,
    simples_nacional = EXCLUDED.simples_nacional,
    simples_anexo = EXCLUDED.simples_anexo,
    presuncao_irpj = EXCLUDED.presuncao_irpj,
    presuncao_csll = EXCLUDED.presuncao_csll,
    mei_permitido = EXCLUDED.mei_permitido,
    mei_tipo = EXCLUDED.mei_tipo,
    mei_ocupacoes = EXCLUDED.mei_ocupacoes,
    regimes_permitidos = EXCLUDED.regimes_permitidos,
    anexos_simples = EXCLUDED.anexos_simples,
    sujeito_fator_r = EXCLUDED.sujeito_fator_r,
    padrao_sistema = true,
    observacoes = EXCLUDED.observacoes,
    fonte_cnae_url = EXCLUDED.fonte_cnae_url,
    fonte_tributaria_url = EXCLUDED.fonte_tributaria_url,
    classificacao_revisada_em = EXCLUDED.classificacao_revisada_em,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.seed_catalogo_cnaes_empresa(uuid) FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_empresa record;
BEGIN
  FOR v_empresa IN SELECT id FROM public.empresas LOOP
    PERFORM public.seed_catalogo_cnaes_empresa(v_empresa.id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_catalogo_cnaes_empresa_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.seed_catalogo_cnaes_empresa(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_catalogo_cnaes_empresa_trigger() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS seed_catalogo_cnaes_after_empresa_insert ON public.empresas;
CREATE TRIGGER seed_catalogo_cnaes_after_empresa_insert
AFTER INSERT ON public.empresas
FOR EACH ROW EXECUTE FUNCTION public.seed_catalogo_cnaes_empresa_trigger();

CREATE OR REPLACE FUNCTION public.proteger_catalogo_cnae_padrao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.padrao_sistema
     AND current_user NOT IN ('postgres', 'supabase_admin')
     AND TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'CNAEs padrão não podem ser excluídos; desative o item.';
  END IF;

  IF OLD.padrao_sistema
     AND current_user NOT IN ('postgres', 'supabase_admin')
     AND TG_OP = 'UPDATE'
     AND (to_jsonb(NEW) - ARRAY['ativo', 'updated_at']::text[])
         IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['ativo', 'updated_at']::text[]) THEN
    RAISE EXCEPTION 'CNAEs padrão permitem alterar apenas o status ativo/inativo.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proteger_catalogo_cnae_padrao ON public.parametrizacao_cnaes;
CREATE TRIGGER proteger_catalogo_cnae_padrao
BEFORE UPDATE OR DELETE ON public.parametrizacao_cnaes
FOR EACH ROW EXECUTE FUNCTION public.proteger_catalogo_cnae_padrao();

DROP POLICY IF EXISTS parametrizacao_cnaes_policy ON public.parametrizacao_cnaes;
DROP POLICY IF EXISTS parametrizacao_cnaes_empresa_policy ON public.parametrizacao_cnaes;
DROP POLICY IF EXISTS parametrizacao_cnaes_select ON public.parametrizacao_cnaes;
DROP POLICY IF EXISTS parametrizacao_cnaes_update_status ON public.parametrizacao_cnaes;

CREATE POLICY parametrizacao_cnaes_select ON public.parametrizacao_cnaes
  FOR SELECT TO authenticated
  USING (public.is_empresa_member(empresa_id));

CREATE POLICY parametrizacao_cnaes_update_status ON public.parametrizacao_cnaes
  FOR UPDATE TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

CREATE INDEX IF NOT EXISTS idx_parametrizacao_cnaes_empresa_ativo_mei
  ON public.parametrizacao_cnaes (empresa_id, ativo, mei_permitido, codigo);

COMMENT ON TABLE public.parametrizacao_cnaes IS
  'Catálogo CNAE classificado e replicado por empresa; usuários autenticados podem apenas ativar ou desativar itens padrão.';
