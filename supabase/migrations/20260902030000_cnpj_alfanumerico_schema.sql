BEGIN;

SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '120s';

-- A Receita Federal passa a emitir CNPJ alfanumerico em julho de 2026. Os
-- doze primeiros caracteres podem conter A-Z; os dois digitos verificadores
-- permanecem numericos. Pontuacao de exibicao nao faz parte do documento.
CREATE OR REPLACE FUNCTION app_private.normalizar_cnpj_alfanumerico(
  p_cnpj text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $function$
  SELECT pg_catalog.upper(
    pg_catalog.regexp_replace(
      pg_catalog.regexp_replace(
        pg_catalog.btrim(COALESCE(p_cnpj, '')),
        '[./-]',
        '',
        'g'
      ),
      '[[:space:]]',
      '',
      'g'
    )
  );
$function$;

CREATE OR REPLACE FUNCTION app_private.cnpj_alfanumerico_valido(
  p_cnpj text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $function$
DECLARE
  v_cnpj text := app_private.normalizar_cnpj_alfanumerico(p_cnpj);
  v_pesos_primeiro constant integer[] := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2];
  v_pesos_segundo constant integer[] := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
  v_soma integer := 0;
  v_primeiro integer;
  v_segundo integer;
  v_indice integer;
BEGIN
  IF v_cnpj !~ '^[0-9A-Z]{12}[0-9]{2}$'
     OR (
       v_cnpj ~ '^[0-9]{14}$'
       AND v_cnpj = pg_catalog.repeat(pg_catalog.substr(v_cnpj, 1, 1), 14)
     ) THEN
    RETURN false;
  END IF;

  FOR v_indice IN 1..12 LOOP
    v_soma := v_soma
      + (pg_catalog.ascii(pg_catalog.substr(v_cnpj, v_indice, 1)) - 48)
      * v_pesos_primeiro[v_indice];
  END LOOP;
  v_primeiro := CASE
    WHEN pg_catalog.mod(v_soma, 11) < 2 THEN 0
    ELSE 11 - pg_catalog.mod(v_soma, 11)
  END;

  IF v_primeiro <> pg_catalog.substr(v_cnpj, 13, 1)::integer THEN
    RETURN false;
  END IF;

  v_soma := 0;
  FOR v_indice IN 1..12 LOOP
    v_soma := v_soma
      + (pg_catalog.ascii(pg_catalog.substr(v_cnpj, v_indice, 1)) - 48)
      * v_pesos_segundo[v_indice];
  END LOOP;
  v_soma := v_soma + v_primeiro * v_pesos_segundo[13];
  v_segundo := CASE
    WHEN pg_catalog.mod(v_soma, 11) < 2 THEN 0
    ELSE 11 - pg_catalog.mod(v_soma, 11)
  END;

  RETURN v_segundo = pg_catalog.substr(v_cnpj, 14, 1)::integer;
END;
$function$;

REVOKE ALL ON FUNCTION app_private.normalizar_cnpj_alfanumerico(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.cnpj_alfanumerico_valido(text)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION app_private.normalizar_cnpj_alfanumerico(text) IS
  'Normaliza CNPJ numerico ou alfanumerico sem apagar caracteres invalidos.';
COMMENT ON FUNCTION app_private.cnpj_alfanumerico_valido(text) IS
  'Valida CNPJ numerico/alfanumerico pelo modulo 11 e valores ASCII menos 48.';

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS cnpj_lookup_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.clientes'::pg_catalog.regclass
      AND conname = 'clientes_cnpj_lookup_snapshot_objeto_check'
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_cnpj_lookup_snapshot_objeto_check
      CHECK (pg_catalog.jsonb_typeof(cnpj_lookup_snapshot) = 'object')
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.clientes'::pg_catalog.regclass
      AND conname = 'clientes_cnpj_lookup_snapshot_tamanho_check'
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_cnpj_lookup_snapshot_tamanho_check
      CHECK (pg_catalog.octet_length(cnpj_lookup_snapshot::text) <= 196608)
      NOT VALID;
  END IF;
END;
$migration$;

ALTER TABLE public.clientes
  VALIDATE CONSTRAINT clientes_cnpj_lookup_snapshot_objeto_check,
  VALIDATE CONSTRAINT clientes_cnpj_lookup_snapshot_tamanho_check;

COMMENT ON COLUMN public.clientes.cnpj_lookup_snapshot IS
  'Snapshot suplementar da ultima consulta oficial de CNPJ; sempre objeto JSON.';

LOCK TABLE public.clientes IN SHARE ROW EXCLUSIVE MODE;

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.clientes cliente
    CROSS JOIN LATERAL (
      SELECT app_private.normalizar_cnpj_alfanumerico(cliente.cnpj) AS documento
    ) normalizado
    WHERE normalizado.documento ~ '^[0-9A-Z]{12}[0-9]{2}$'
    GROUP BY cliente.empresa_id, normalizado.documento
    HAVING pg_catalog.count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Existem CNPJs normalizados duplicados no tenant; corrija-os antes da migracao alfanumerica.'
      USING ERRCODE = '23505';
  END IF;
END;
$migration$;

DROP INDEX IF EXISTS public.clientes_cnpj_normalizado_por_empresa_unq;
DROP INDEX IF EXISTS public.uq_clientes_empresa_cnpj_normalizado;

CREATE UNIQUE INDEX clientes_cnpj_normalizado_por_empresa_unq
  ON public.clientes (
    empresa_id,
    app_private.normalizar_cnpj_alfanumerico(cnpj)
  )
  WHERE app_private.normalizar_cnpj_alfanumerico(cnpj)
    ~ '^[0-9A-Z]{12}[0-9]{2}$';

COMMIT;
