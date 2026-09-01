-- Converte filiais históricas guardadas em clientes.polos para unidades
-- operacionais reais. O JSON é preservado como arquivo de compatibilidade.
BEGIN;

-- A conversão deve observar um retrato estável de matrizes, CNPJs e polos.
LOCK TABLE public.clientes IN SHARE ROW EXCLUSIVE MODE;

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.clientes matriz
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(matriz.polos) = 'array' THEN matriz.polos ELSE '[]'::jsonb END
    ) item(filial)
    WHERE matriz.matriz_cliente_id IS NULL
      AND matriz.tipo_estabelecimento = 'Matriz'
      AND matriz.tipo <> 'PF'
      AND jsonb_typeof(item.filial) = 'object'
      AND char_length(pg_catalog.regexp_replace(COALESCE(matriz.cnpj, ''), '[^0-9]', '', 'g')) = 14
      AND char_length(pg_catalog.regexp_replace(COALESCE(item.filial ->> 'cnpj', ''), '[^0-9]', '', 'g')) = 14
      AND left(pg_catalog.regexp_replace(COALESCE(matriz.cnpj, ''), '[^0-9]', '', 'g'), 8)
        = left(pg_catalog.regexp_replace(COALESCE(item.filial ->> 'cnpj', ''), '[^0-9]', '', 'g'), 8)
      AND char_length(pg_catalog.btrim(COALESCE(item.filial ->> 'nome', ''))) BETWEEN 2 AND 180
    GROUP BY matriz.empresa_id,
      pg_catalog.regexp_replace(COALESCE(item.filial ->> 'cnpj', ''), '[^0-9]', '', 'g')
    HAVING count(DISTINCT matriz.id) > 1
  ) THEN
    RAISE EXCEPTION 'Um CNPJ de filial legada está associado a mais de uma matriz.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.clientes matriz
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(matriz.polos) = 'array' THEN matriz.polos ELSE '[]'::jsonb END
    ) item(filial)
    JOIN public.clientes existente
      ON existente.empresa_id = matriz.empresa_id
     AND pg_catalog.regexp_replace(COALESCE(existente.cnpj, ''), '[^0-9]', '', 'g')
       = pg_catalog.regexp_replace(COALESCE(item.filial ->> 'cnpj', ''), '[^0-9]', '', 'g')
    WHERE matriz.matriz_cliente_id IS NULL
      AND matriz.tipo_estabelecimento = 'Matriz'
      AND matriz.tipo <> 'PF'
      AND jsonb_typeof(item.filial) = 'object'
      AND char_length(pg_catalog.regexp_replace(COALESCE(matriz.cnpj, ''), '[^0-9]', '', 'g')) = 14
      AND char_length(pg_catalog.regexp_replace(COALESCE(item.filial ->> 'cnpj', ''), '[^0-9]', '', 'g')) = 14
      AND left(pg_catalog.regexp_replace(COALESCE(matriz.cnpj, ''), '[^0-9]', '', 'g'), 8)
        = left(pg_catalog.regexp_replace(COALESCE(item.filial ->> 'cnpj', ''), '[^0-9]', '', 'g'), 8)
      AND char_length(pg_catalog.btrim(COALESCE(item.filial ->> 'nome', ''))) BETWEEN 2 AND 180
      AND (existente.matriz_cliente_id IS DISTINCT FROM matriz.id
        OR existente.tipo_estabelecimento <> 'Filial')
  ) THEN
    RAISE EXCEPTION 'Um CNPJ de filial legada já pertence a outra unidade operacional.';
  END IF;
END;
$migration$;

WITH legadas AS (
  SELECT
    matriz.*,
    item.filial,
    item.ordem,
    pg_catalog.regexp_replace(
      COALESCE(item.filial ->> 'cnpj', ''), '[^0-9]', '', 'g'
    ) AS filial_cnpj_numeros,
    pg_catalog.regexp_replace(
      COALESCE(matriz.cnpj, ''), '[^0-9]', '', 'g'
    ) AS matriz_cnpj_numeros
  FROM public.clientes matriz
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(matriz.polos) = 'array' THEN matriz.polos ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS item(filial, ordem)
  WHERE matriz.matriz_cliente_id IS NULL
    AND matriz.tipo_estabelecimento = 'Matriz'
    AND jsonb_typeof(item.filial) = 'object'
),
validas AS (
  SELECT legadas.*,
    row_number() OVER (
      PARTITION BY legadas.empresa_id, legadas.filial_cnpj_numeros
      ORDER BY legadas.id, legadas.ordem
    ) AS cnpj_ordem
  FROM legadas
  WHERE legadas.tipo <> 'PF'
    AND char_length(legadas.matriz_cnpj_numeros) = 14
    AND char_length(legadas.filial_cnpj_numeros) = 14
    AND left(legadas.matriz_cnpj_numeros, 8) = left(legadas.filial_cnpj_numeros, 8)
    AND char_length(pg_catalog.btrim(COALESCE(legadas.filial ->> 'nome', ''))) BETWEEN 2 AND 180
)
INSERT INTO public.clientes (
  empresa_id, matriz_cliente_id, filial_ref, nome, razao_social, cnpj,
  tipo, categoria_cliente, tipo_estabelecimento, logo, status,
  email, telefone, endereco, cidade, uf, cep, bairro, contato,
  tipo_parceiro_id, tipo_parceiro_catalogo_tipo,
  tipo_empresa_id, tipo_empresa_catalogo_tipo,
  natureza_juridica_id, natureza_juridica_catalogo_tipo,
  modelos_ativos
)
SELECT
  valida.empresa_id,
  valida.id,
  'legada-' || substring(
    md5(valida.id::text || ':' || valida.ordem::text || ':' || valida.filial_cnpj_numeros),
    1, 24
  ),
  pg_catalog.btrim(valida.filial ->> 'nome'),
  pg_catalog.btrim(valida.filial ->> 'nome'),
  pg_catalog.btrim(valida.filial ->> 'cnpj'),
  valida.tipo,
  valida.categoria_cliente,
  'Filial',
  valida.logo,
  CASE WHEN valida.status <> 'Ativa'
      OR lower(COALESCE(valida.filial ->> 'ativo', 'true')) IN ('false', '0', 'não', 'nao')
    THEN 'Inativa' ELSE 'Ativa' END,
  pg_catalog.btrim(COALESCE(valida.filial ->> 'email', '')),
  pg_catalog.btrim(COALESCE(valida.filial ->> 'telefone', '')),
  pg_catalog.btrim(COALESCE(valida.filial ->> 'endereco', '')),
  NULLIF(pg_catalog.btrim(COALESCE(valida.filial ->> 'cidade', '')), ''),
  NULLIF(upper(pg_catalog.btrim(COALESCE(valida.filial ->> 'uf', ''))), ''),
  NULLIF(pg_catalog.btrim(COALESCE(valida.filial ->> 'cep', '')), ''),
  NULLIF(pg_catalog.btrim(COALESCE(valida.filial ->> 'bairro', '')), ''),
  pg_catalog.btrim(COALESCE(valida.filial ->> 'contato', '')),
  valida.tipo_parceiro_id,
  valida.tipo_parceiro_catalogo_tipo,
  valida.tipo_empresa_id,
  valida.tipo_empresa_catalogo_tipo,
  valida.natureza_juridica_id,
  valida.natureza_juridica_catalogo_tipo,
  '{}'::text[]
FROM validas valida
WHERE valida.cnpj_ordem = 1
  AND NOT EXISTS (
    SELECT 1
    FROM public.clientes existente
    WHERE existente.empresa_id = valida.empresa_id
      AND existente.matriz_cliente_id = valida.id
      AND existente.tipo_estabelecimento = 'Filial'
      AND pg_catalog.regexp_replace(
        COALESCE(existente.cnpj, ''), '[^0-9]', '', 'g'
      ) = valida.filial_cnpj_numeros
  )
ON CONFLICT DO NOTHING;

COMMIT;
