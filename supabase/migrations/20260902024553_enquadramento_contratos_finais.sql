-- Verifica, dentro de uma transação, o resultado das etapas canônicas.
-- Nenhuma inferência por nome é feita: apenas códigos oficiais são auditados.

BEGIN;

SET LOCAL lock_timeout = '15s';

-- Empresas primeiro impede a criação concorrente de tenant durante o contrato.
-- Os demais locks preservam a ordem catálogo -> clientes usada nas etapas.
LOCK TABLE public.empresas IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.parametrizacao_catalogos IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.clientes IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMPORARY TABLE catalogos_aliases_exatos_para_validar
ON COMMIT DROP
AS
SELECT mapa.tipo, mapa.codigo_alias, mapa.codigo_canonico,
  mapa.nome_canonico, mapa.ativo_canonico
FROM (VALUES
  ('tipos_empresa', 'te-1', 'pessoa_fisica', 'Pessoa Física', true),
  ('tipos_empresa', 'te-2', 'mei', 'MEI', true),
  ('tipos_empresa', 'te-3', 'microempresa', 'ME', true),
  ('tipos_empresa', 'te-4', 'epp', 'EPP', true),
  ('tipos_empresa', 'te-5', 'isenta_imune', 'Isenta / Imune', false),
  ('tipos_empresa', 'te-6', 'holding_patrimonial', 'Holding / Patrimonial', false),
  ('naturezas_juridicas', 'nj-1', 'empresario_individual',
    'Empresário Individual (EI)', true),
  ('naturezas_juridicas', 'nj-2', 'sociedade_limitada',
    'Sociedade Limitada (LTDA)', true),
  ('naturezas_juridicas', 'nj-3', 'sociedade_limitada_unipessoal',
    'Sociedade Limitada Unipessoal (SLU)', true),
  ('naturezas_juridicas', 'nj-4', 'associacao_privada', 'Associação', true)
) AS mapa(
  tipo, codigo_alias, codigo_canonico, nome_canonico, ativo_canonico
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.empresas empresa
    CROSS JOIN (VALUES
      ('pessoa_fisica', 'Pessoa Física'),
      ('mei', 'MEI'),
      ('microempresa', 'ME'),
      ('epp', 'EPP'),
      ('demais', 'Demais')
    ) AS esperado(codigo, nome)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.parametrizacao_catalogos catalogo
      WHERE catalogo.empresa_id = empresa.id
        AND catalogo.tipo = 'tipos_empresa'
        AND catalogo.codigo = esperado.codigo
        AND catalogo.nome = esperado.nome
        AND catalogo.ativo = true
    )
  ) THEN
    RAISE EXCEPTION
      'Catálogo de porte/enquadramento incompleto para uma ou mais empresas.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.empresas empresa
    CROSS JOIN catalogos_aliases_exatos_para_validar mapa
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.parametrizacao_catalogos canonico
      WHERE canonico.empresa_id = empresa.id
        AND canonico.tipo = mapa.tipo
        AND canonico.codigo = mapa.codigo_canonico
        AND canonico.nome = mapa.nome_canonico
        AND canonico.ativo = mapa.ativo_canonico
        AND canonico.sistema = true
    )
  ) THEN
    RAISE EXCEPTION
      'Destino canônico de alias ausente ou com estado incorreto.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.parametrizacao_catalogos
    WHERE tipo = 'tipos_empresa'
      AND codigo IN (
        'isenta_imune', 'holding_patrimonial',
        'te-1', 'te-2', 'te-3', 'te-4', 'te-5', 'te-6'
      )
      AND ativo = true
  ) THEN
    RAISE EXCEPTION 'Tipo de empresa legado permaneceu ativo.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.parametrizacao_catalogos alias
    JOIN catalogos_aliases_exatos_para_validar mapa
      ON mapa.tipo = alias.tipo
     AND mapa.codigo_alias = alias.codigo
    WHERE alias.ativo = true
       OR alias.sistema = false
       OR alias.nome IS DISTINCT FROM
          mapa.nome_canonico || ' [legado ' || mapa.codigo_alias || ']'
  ) THEN
    RAISE EXCEPTION 'Alias legado não foi arquivado de forma auditável.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.clientes cliente
    JOIN public.parametrizacao_catalogos alias
      ON alias.empresa_id = cliente.empresa_id
    JOIN catalogos_aliases_exatos_para_validar mapa
      ON mapa.tipo = alias.tipo
     AND mapa.codigo_alias = alias.codigo
    WHERE (mapa.tipo = 'tipos_empresa'
        AND cliente.tipo_empresa_id = alias.id)
       OR (mapa.tipo = 'naturezas_juridicas'
        AND cliente.natureza_juridica_id = alias.id)
  ) THEN
    RAISE EXCEPTION 'Cliente permaneceu vinculado a um alias legado.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.parametrizacao_catalogos catalogo
    WHERE catalogo.tipo IN ('tipos_empresa', 'naturezas_juridicas')
    GROUP BY
      catalogo.empresa_id,
      catalogo.tipo,
      lower(regexp_replace(btrim(catalogo.nome), '[[:space:]]+', ' ', 'g'))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Classificação ficou com nome normalizado duplicado.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.clientes cliente
    JOIN public.parametrizacao_catalogos catalogo
      ON catalogo.id = cliente.tipo_empresa_id
     AND catalogo.empresa_id = cliente.empresa_id
     AND catalogo.tipo = 'tipos_empresa'
    WHERE (catalogo.codigo = 'pessoa_fisica'
        AND cliente.tipo IS DISTINCT FROM 'PF')
       OR (catalogo.codigo = 'mei' AND cliente.tipo IS DISTINCT FROM 'MEI')
       OR (cliente.tipo = 'PF'
        AND catalogo.codigo IS DISTINCT FROM 'pessoa_fisica')
       OR (cliente.tipo = 'MEI' AND catalogo.codigo IS DISTINCT FROM 'mei')
  ) THEN
    RAISE EXCEPTION 'Semântica operacional de PF/MEI ficou inconsistente.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.parametrizacao_catalogos
    WHERE tipo = 'categorias_clientes'
      AND codigo IN (
        'cliente_contabil',
        'cliente-contabil',
        'pessoa_fisica',
        'pessoa-fisica',
        'entidade_isenta',
        'entidade-isenta',
        'holding_patrimonial',
        'holding-patrimonial'
      )
      AND ativo = true
  ) THEN
    RAISE EXCEPTION 'Categoria legada não setorial permaneceu ativa.';
  END IF;
END;
$$;

COMMENT ON COLUMN public.clientes.tipo_empresa_id IS
  'Porte/enquadramento no catálogo multiempresa tipos_empresa.';

COMMENT ON COLUMN public.clientes.natureza_juridica_id IS
  'Natureza jurídica no catálogo multiempresa naturezas_juridicas.';

COMMIT;
