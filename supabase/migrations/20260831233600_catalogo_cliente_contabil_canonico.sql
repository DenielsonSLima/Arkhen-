-- O tipo Cliente Contábil é infraestrutura operacional de Agenda, Rotinas,
-- Acompanhamento e carteira. Ele precisa existir antes de qualquer tela.

-- Corrige o trigger legado deste catálogo: a tabela usa `atualizado_em`, não
-- `updated_at`. Sem isso, qualquer upsert existente falha antes da migration.
DROP TRIGGER IF EXISTS set_updated_at_parametrizacao_catalogos
  ON public.parametrizacao_catalogos;
CREATE TRIGGER set_updated_at_parametrizacao_catalogos
  BEFORE UPDATE ON public.parametrizacao_catalogos
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

INSERT INTO public.parametrizacao_catalogos (
  empresa_id,
  tipo,
  codigo,
  nome,
  descricao,
  sistema,
  ativo,
  ordem
)
SELECT
  empresa.id,
  padrao.tipo,
  padrao.codigo,
  padrao.nome,
  padrao.descricao,
  true,
  true,
  padrao.ordem
FROM public.empresas empresa
CROSS JOIN (VALUES
  ('tipos_parceiros', 'cliente_contabil', 'Cliente Contábil', 'Empresa atendida diretamente pelo escritório.', 10),
  ('tipos_parceiros', 'parceiro_comercial', 'Parceiro Comercial', 'Origem de indicações e oportunidades comerciais.', 20),
  ('tipos_parceiros', 'fornecedor', 'Fornecedor', 'Prestador ou fornecedor vinculado às rotinas internas.', 30),
  ('tipos_parceiros', 'correspondente', 'Correspondente', 'Parceiro operacional para demandas locais.', 40),
  ('tipos_empresa', 'pessoa_fisica', 'Pessoa Física', 'Parceiro PF/autônomo sem CNPJ.', 10),
  ('tipos_empresa', 'mei', 'MEI', 'Microempreendedor individual.', 20),
  ('tipos_empresa', 'microempresa', 'Microempresa', 'Empresa de pequeno porte.', 30),
  ('tipos_empresa', 'epp', 'Empresa de Pequeno Porte', 'Empresa de pequeno porte com maior volume operacional.', 40),
  ('tipos_empresa', 'isenta_imune', 'Isenta / Imune', 'Entidade com tratamento tributário diferenciado.', 50),
  ('tipos_empresa', 'holding_patrimonial', 'Holding / Patrimonial', 'Empresa patrimonial ou holding.', 60),
  ('naturezas_juridicas', 'empresario_individual', 'Empresário Individual', 'Pessoa física titular de atividade empresarial.', 10),
  ('naturezas_juridicas', 'sociedade_limitada', 'Sociedade Limitada', 'Sociedade formada por sócios com quotas.', 20),
  ('naturezas_juridicas', 'sociedade_limitada_unipessoal', 'Sociedade Limitada Unipessoal', 'Sociedade limitada com um titular.', 30),
  ('naturezas_juridicas', 'associacao_privada', 'Associação Privada', 'Entidade privada sem fins lucrativos.', 40)
) AS padrao(tipo, codigo, nome, descricao, ordem)
ON CONFLICT (empresa_id, tipo, codigo) DO NOTHING;

-- O tipo canônico não pode ser inativado: rotinas e agenda dependem dele.
UPDATE public.parametrizacao_catalogos
SET ativo = true,
    sistema = true,
    atualizado_em = now()
WHERE tipo = 'tipos_parceiros'
  AND codigo = 'cliente_contabil'
  AND (ativo = false OR sistema = false);

WITH tipo_canonico AS (
  SELECT empresa_id, id
  FROM public.parametrizacao_catalogos
  WHERE tipo = 'tipos_parceiros'
    AND codigo = 'cliente_contabil'
    AND ativo = true
)
UPDATE public.clientes cliente
SET tipo_parceiro_id = tipo.id
FROM tipo_canonico tipo
WHERE cliente.empresa_id = tipo.empresa_id
  AND (
    cliente.tipo_parceiro_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.parametrizacao_catalogos tipo_atual
      WHERE tipo_atual.id = cliente.tipo_parceiro_id
        AND tipo_atual.empresa_id = cliente.empresa_id
        AND tipo_atual.tipo = 'tipos_parceiros'
        AND (
          tipo_atual.codigo = 'tp-1'
          OR tipo_atual.nome = 'Cliente Contábil'
        )
    )
  );

UPDATE public.parametrizacao_catalogos
SET ativo = false,
    atualizado_em = now()
WHERE tipo = 'tipos_parceiros'
  AND codigo <> 'cliente_contabil'
  AND (codigo = 'tp-1' OR nome = 'Cliente Contábil')
  AND ativo = true;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.clientes
    WHERE tipo_parceiro_id IS NULL
       OR EXISTS (
         SELECT 1
         FROM public.parametrizacao_catalogos tipo_atual
         WHERE tipo_atual.id = clientes.tipo_parceiro_id
           AND tipo_atual.empresa_id = clientes.empresa_id
           AND tipo_atual.tipo = 'tipos_parceiros'
           AND tipo_atual.codigo = 'tp-1'
       )
  ) THEN
    RAISE EXCEPTION 'Existem parceiros legados sem tipo canônico.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.obter_tipo_parceiro_cliente_contabil()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_tipo_id uuid;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR COALESCE(public.current_user_is_client_scoped(v_empresa_id), true) THEN
    RAISE EXCEPTION 'Tipo de parceiro não encontrado.' USING ERRCODE = '42501';
  END IF;

  SELECT catalogo.id INTO v_tipo_id
  FROM public.parametrizacao_catalogos catalogo
  WHERE catalogo.empresa_id = v_empresa_id
    AND catalogo.tipo = 'tipos_parceiros'
    AND catalogo.codigo = 'cliente_contabil'
    AND catalogo.ativo = true;

  IF v_tipo_id IS NULL THEN
    RAISE EXCEPTION 'Tipo de parceiro não encontrado.' USING ERRCODE = '42501';
  END IF;
  RETURN v_tipo_id;
END;
$$;

REVOKE ALL ON FUNCTION public.obter_tipo_parceiro_cliente_contabil()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_tipo_parceiro_cliente_contabil()
  TO authenticated;
