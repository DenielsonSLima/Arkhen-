-- Consolida classificações repetidas criadas pela convivência entre códigos
-- legados (tp-*, nomes com hífen) e os catálogos canônicos atuais.
--
-- A consolidacao considera empresa, catalogo e nome normalizado, mantendo os
-- conceitos de tipo e categoria independentes.

LOCK TABLE public.parametrizacao_catalogos IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMPORARY TABLE catalogos_duplicados_para_unificar
ON COMMIT DROP
AS
WITH classificados AS (
  SELECT
    catalogo.id,
    catalogo.empresa_id,
    catalogo.tipo,
    lower(regexp_replace(btrim(catalogo.nome), '[[:space:]]+', ' ', 'g')) AS nome_normalizado,
    first_value(catalogo.id) OVER classificacao AS id_canonico,
    first_value(catalogo.nome) OVER classificacao AS nome_canonico,
    row_number() OVER classificacao AS posicao
  FROM public.parametrizacao_catalogos catalogo
  WHERE catalogo.tipo IN ('tipos_parceiros', 'categorias_clientes')
  WINDOW classificacao AS (
    PARTITION BY
      catalogo.empresa_id,
      catalogo.tipo,
      lower(regexp_replace(btrim(catalogo.nome), '[[:space:]]+', ' ', 'g'))
    ORDER BY
      CASE
        WHEN catalogo.tipo = 'tipos_parceiros'
          AND catalogo.codigo IN (
            'cliente_contabil',
            'parceiro_comercial',
            'fornecedor',
            'correspondente'
          ) THEN 0
        WHEN catalogo.tipo = 'categorias_clientes'
          AND catalogo.codigo IN (
            'cliente_contabil',
            'pessoa_fisica',
            'entidade_isenta',
            'holding_patrimonial',
            'outro'
          ) THEN 0
        ELSE 1
      END,
      catalogo.sistema DESC,
      catalogo.ativo DESC,
      catalogo.ordem ASC,
      catalogo.id ASC
  )
)
SELECT
  id AS id_duplicado,
  id_canonico,
  empresa_id,
  tipo,
  nome_normalizado,
  nome_canonico
FROM classificados
WHERE posicao > 1;

-- Preserva todos os vinculos antes de excluir qualquer linha redundante.
UPDATE public.clientes cliente
SET tipo_parceiro_id = duplicado.id_canonico
FROM catalogos_duplicados_para_unificar duplicado
WHERE duplicado.tipo = 'tipos_parceiros'
  AND cliente.empresa_id = duplicado.empresa_id
  AND cliente.tipo_parceiro_id = duplicado.id_duplicado;

UPDATE public.clientes cliente
SET categoria_cliente = duplicado.nome_canonico
FROM catalogos_duplicados_para_unificar duplicado
WHERE duplicado.tipo = 'categorias_clientes'
  AND cliente.empresa_id = duplicado.empresa_id
  AND lower(regexp_replace(btrim(cliente.categoria_cliente), '[[:space:]]+', ' ', 'g'))
    = duplicado.nome_normalizado
  AND cliente.categoria_cliente IS DISTINCT FROM duplicado.nome_canonico;

DELETE FROM public.parametrizacao_catalogos catalogo
USING catalogos_duplicados_para_unificar duplicado
WHERE catalogo.id = duplicado.id_duplicado;

CREATE UNIQUE INDEX IF NOT EXISTS
  parametrizacao_catalogos_parceiros_nome_norm_unq
ON public.parametrizacao_catalogos (
  empresa_id,
  tipo,
  lower(regexp_replace(btrim(nome), '[[:space:]]+', ' ', 'g'))
)
WHERE tipo IN ('tipos_parceiros', 'categorias_clientes');

COMMENT ON INDEX public.parametrizacao_catalogos_parceiros_nome_norm_unq IS
  'Impede nomes repetidos no mesmo catalogo da empresa, ignorando caixa e espacos excedentes.';
