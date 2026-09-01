-- Execute após 20260901190150_migrar_filiais_legadas_operacionais.
-- Contrato somente leitura para integridade de CNPJ e conversão do JSON legado.
BEGIN;

DO $test$
DECLARE
  v_index_definition text;
  v_trigger_definition text;
  v_function_definition text;
BEGIN
  SELECT pg_catalog.pg_get_indexdef(indice.indexrelid)
  INTO v_index_definition
  FROM pg_catalog.pg_index indice
  WHERE indice.indexrelid = pg_catalog.to_regclass(
    'public.clientes_cnpj_normalizado_por_empresa_unq'
  )
    AND indice.indisunique
    AND indice.indisvalid;

  IF v_index_definition IS NULL
     OR position('regexp_replace' IN lower(v_index_definition)) = 0
     OR position('empresa_id' IN lower(v_index_definition)) = 0
     OR position('= 14' IN lower(v_index_definition)) = 0 THEN
    RAISE EXCEPTION 'Unicidade física do CNPJ normalizado está ausente.';
  END IF;

  SELECT pg_catalog.pg_get_triggerdef(gatilho.oid, true),
    pg_catalog.pg_get_functiondef(gatilho.tgfoid)
  INTO v_trigger_definition, v_function_definition
  FROM pg_catalog.pg_trigger gatilho
  WHERE gatilho.tgrelid = 'public.clientes'::regclass
    AND gatilho.tgname = 'validar_hierarquia_filial_cliente'
    AND NOT gatilho.tgisinternal;

  IF v_trigger_definition IS NULL OR v_function_definition IS NULL
     OR position('cnpj' IN lower(v_trigger_definition)) = 0
     OR position('tipo' IN lower(v_trigger_definition)) = 0
     OR position('new.tipo = ''pf''' IN lower(v_function_definition)) = 0
     OR position('v_matriz.tipo = ''pf''' IN lower(v_function_definition)) = 0
     OR position('left(v_cnpj_numeros, 8)' IN lower(v_function_definition)) = 0
     OR position('matriz_cliente_id = new.id' IN lower(v_function_definition)) = 0 THEN
    RAISE EXCEPTION 'Trigger não protege pessoa jurídica e raiz de CNPJ da hierarquia.';
  END IF;
END;
$test$;

DO $test$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.clientes filial
    JOIN public.clientes matriz
      ON matriz.empresa_id = filial.empresa_id
     AND matriz.id = filial.matriz_cliente_id
    WHERE filial.tipo_estabelecimento <> 'Filial'
       OR matriz.tipo_estabelecimento <> 'Matriz'
       OR filial.tipo = 'PF'
       OR matriz.tipo = 'PF'
       OR char_length(pg_catalog.regexp_replace(
         COALESCE(filial.cnpj, ''), '[^0-9]', '', 'g'
       )) <> 14
       OR left(pg_catalog.regexp_replace(
         COALESCE(filial.cnpj, ''), '[^0-9]', '', 'g'
       ), 8) <> left(pg_catalog.regexp_replace(
         COALESCE(matriz.cnpj, ''), '[^0-9]', '', 'g'
       ), 8)
  ) THEN
    RAISE EXCEPTION 'Há filial relacional fora da hierarquia jurídica esperada.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.clientes matriz
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(matriz.polos) = 'array' THEN matriz.polos ELSE '[]'::jsonb END
    ) item(filial)
    WHERE matriz.matriz_cliente_id IS NULL
      AND matriz.tipo <> 'PF'
      AND char_length(pg_catalog.regexp_replace(
        COALESCE(matriz.cnpj, ''), '[^0-9]', '', 'g'
      )) = 14
      AND char_length(pg_catalog.regexp_replace(
        COALESCE(item.filial ->> 'cnpj', ''), '[^0-9]', '', 'g'
      )) = 14
      AND char_length(pg_catalog.btrim(
        COALESCE(item.filial ->> 'nome', '')
      )) BETWEEN 2 AND 180
      AND left(pg_catalog.regexp_replace(
        COALESCE(item.filial ->> 'cnpj', ''), '[^0-9]', '', 'g'
      ), 8) = left(pg_catalog.regexp_replace(
        COALESCE(matriz.cnpj, ''), '[^0-9]', '', 'g'
      ), 8)
      AND NOT EXISTS (
        SELECT 1
        FROM public.clientes relacional
        WHERE relacional.empresa_id = matriz.empresa_id
          AND relacional.matriz_cliente_id = matriz.id
          AND relacional.tipo_estabelecimento = 'Filial'
          AND pg_catalog.regexp_replace(
            COALESCE(relacional.cnpj, ''), '[^0-9]', '', 'g'
          ) = pg_catalog.regexp_replace(
            COALESCE(item.filial ->> 'cnpj', ''), '[^0-9]', '', 'g'
          )
      )
  ) THEN
    RAISE EXCEPTION 'Ainda existe filial legada válida sem unidade operacional relacional.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.clientes filial
    WHERE filial.filial_ref LIKE 'legada-%'
      AND cardinality(filial.modelos_ativos) <> 0
  ) THEN
    RAISE EXCEPTION 'Filial migrada recebeu rotinas implícitas.';
  END IF;
END;
$test$;

ROLLBACK;
