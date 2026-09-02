BEGIN;
SET TRANSACTION READ ONLY;

DO $test$
DECLARE
  v_normalizar regprocedure := pg_catalog.to_regprocedure(
    'app_private.normalizar_cnpj_alfanumerico(text)'
  );
  v_validar regprocedure := pg_catalog.to_regprocedure(
    'app_private.cnpj_alfanumerico_valido(text)'
  );
  v_definicao text;
BEGIN
  IF v_normalizar IS NULL OR v_validar IS NULL THEN
    RAISE EXCEPTION 'Helpers de CNPJ alfanumerico estao ausentes.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc procedimento
    WHERE procedimento.oid IN (v_normalizar::oid, v_validar::oid)
      AND (
        procedimento.provolatile <> 'i'
        OR procedimento.proparallel <> 's'
        OR procedimento.prosecdef
        OR pg_catalog.strpos(
          pg_catalog.pg_get_functiondef(procedimento.oid), 'SET search_path TO '''''
        ) = 0
      )
  ) THEN
    RAISE EXCEPTION 'Helpers de CNPJ precisam ser imutaveis, parallel safe e invoker.';
  END IF;

  IF pg_catalog.has_function_privilege('anon', v_normalizar, 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', v_normalizar, 'EXECUTE')
     OR pg_catalog.has_function_privilege('anon', v_validar, 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', v_validar, 'EXECUTE') THEN
    RAISE EXCEPTION 'Helpers internos de CNPJ nao podem ser RPC publica.';
  END IF;

  IF app_private.normalizar_cnpj_alfanumerico(' 00.000.000/e08g-12 ') <> '00000000E08G12'
     OR app_private.normalizar_cnpj_alfanumerico('00000000E08G12!') <> '00000000E08G12!'
     OR NOT app_private.cnpj_alfanumerico_valido('00.000.000/E08G-12')
     OR NOT app_private.cnpj_alfanumerico_valido('11.444.777/0001-61')
     OR app_private.cnpj_alfanumerico_valido('00.000.000/E08G-13')
     OR app_private.cnpj_alfanumerico_valido('00.000.000/0000-00')
     OR app_private.cnpj_alfanumerico_valido('00000000E08G12!') THEN
    RAISE EXCEPTION 'Normalizacao ou digitos verificadores de CNPJ divergiram do contrato.';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(v_validar) INTO v_definicao;
  v_definicao := pg_catalog.regexp_replace(
    v_definicao,
    '[[:space:]]',
    '',
    'g'
  );
  IF pg_catalog.strpos(pg_catalog.lower(v_definicao), 'ascii') = 0
     OR pg_catalog.strpos(v_definicao, '-48') = 0
     OR pg_catalog.strpos(v_definicao, '5,4,3,2,9,8,7,6,5,4,3,2') = 0
     OR pg_catalog.strpos(v_definicao, '6,5,4,3,2,9,8,7,6,5,4,3,2') = 0 THEN
    RAISE EXCEPTION 'Algoritmo ASCII-48/modulo 11 de CNPJ foi alterado.';
  END IF;
END;
$test$;

DO $test$
DECLARE
  v_indice text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute atributo
    JOIN pg_catalog.pg_class tabela ON tabela.oid = atributo.attrelid
    JOIN pg_catalog.pg_namespace esquema ON esquema.oid = tabela.relnamespace
    JOIN pg_catalog.pg_type tipo ON tipo.oid = atributo.atttypid
    WHERE esquema.nspname = 'public'
      AND tabela.relname = 'clientes'
      AND atributo.attname = 'cnpj_lookup_snapshot'
      AND atributo.attnum > 0
      AND NOT atributo.attisdropped
      AND atributo.attnotnull
      AND tipo.typname = 'jsonb'
      AND pg_catalog.pg_get_expr(
        (SELECT pad.adbin
         FROM pg_catalog.pg_attrdef pad
         WHERE pad.adrelid = atributo.attrelid
           AND pad.adnum = atributo.attnum),
        atributo.attrelid
      ) = '''{}''::jsonb'
  ) THEN
    RAISE EXCEPTION 'Snapshot da consulta de CNPJ nao e jsonb NOT NULL com default objeto.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint restricao
    WHERE restricao.conrelid = 'public.clientes'::pg_catalog.regclass
      AND restricao.conname = 'clientes_cnpj_lookup_snapshot_objeto_check'
      AND restricao.contype = 'c'
      AND restricao.convalidated
      AND pg_catalog.pg_get_constraintdef(restricao.oid)
        ILIKE '%jsonb_typeof(cnpj_lookup_snapshot)%object%'
  ) THEN
    RAISE EXCEPTION 'Snapshot da consulta de CNPJ nao esta limitado a objeto JSON.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint restricao
    WHERE restricao.conrelid = 'public.clientes'::pg_catalog.regclass
      AND restricao.conname = 'clientes_cnpj_lookup_snapshot_tamanho_check'
      AND restricao.contype = 'c'
      AND restricao.convalidated
      AND pg_catalog.pg_get_constraintdef(restricao.oid)
        ILIKE '%octet_length%cnpj_lookup_snapshot%196608%'
  ) THEN
    RAISE EXCEPTION 'Snapshot da consulta de CNPJ nao possui limite de tamanho.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class tabela
    WHERE tabela.oid = 'public.clientes'::pg_catalog.regclass
      AND tabela.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS de clientes foi desabilitada.';
  END IF;

  SELECT pg_catalog.pg_get_indexdef(indice.indexrelid)
  INTO v_indice
  FROM pg_catalog.pg_index indice
  JOIN pg_catalog.pg_class classe ON classe.oid = indice.indexrelid
  JOIN pg_catalog.pg_namespace esquema ON esquema.oid = classe.relnamespace
  WHERE esquema.nspname = 'public'
    AND classe.relname = 'clientes_cnpj_normalizado_por_empresa_unq'
    AND indice.indrelid = 'public.clientes'::pg_catalog.regclass
    AND indice.indisunique
    AND indice.indisvalid;

  IF v_indice IS NULL
     OR pg_catalog.strpos(v_indice, 'normalizar_cnpj_alfanumerico') = 0
     OR pg_catalog.strpos(v_indice, '[0-9A-Z]{12}[0-9]{2}') = 0 THEN
    RAISE EXCEPTION 'Indice unico de CNPJ nao cobre documento alfanumerico por tenant.';
  END IF;

  IF pg_catalog.to_regclass('public.uq_clientes_empresa_cnpj_normalizado') IS NOT NULL THEN
    RAISE EXCEPTION 'Indice numerico legado redundante de CNPJ ainda existe.';
  END IF;

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
    RAISE EXCEPTION 'Ha CNPJ normalizado duplicado dentro do mesmo tenant.';
  END IF;
END;
$test$;

DO $test$
DECLARE
  v_hierarquia regprocedure := pg_catalog.to_regprocedure(
    'app_private.validar_hierarquia_filial_cliente()'
  );
  v_salvar regprocedure := pg_catalog.to_regprocedure(
    'public.salvar_filial_cliente_v1(uuid,uuid,jsonb,timestamp with time zone)'
  );
  v_definicao text;
BEGIN
  IF v_hierarquia IS NULL OR v_salvar IS NULL THEN
    RAISE EXCEPTION 'Gatilho ou RPC de filial esta ausente.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger gatilho
    WHERE gatilho.tgrelid = 'public.clientes'::pg_catalog.regclass
      AND gatilho.tgname = 'validar_hierarquia_filial_cliente'
      AND NOT gatilho.tgisinternal
      AND gatilho.tgenabled <> 'D'
      AND gatilho.tgfoid = v_hierarquia
      AND (gatilho.tgtype::integer & 1) = 1
      AND (gatilho.tgtype::integer & 2) = 2
  ) THEN
    RAISE EXCEPTION 'Gatilho BEFORE ROW de hierarquia de filial esta ausente.';
  END IF;

  IF pg_catalog.has_function_privilege('anon', v_hierarquia, 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', v_hierarquia, 'EXECUTE')
     OR pg_catalog.has_function_privilege('anon', v_salvar, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated', v_salvar, 'EXECUTE') THEN
    RAISE EXCEPTION 'ACL do gatilho/RPC de filial esta incorreta.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc procedimento
    WHERE procedimento.oid IN (v_hierarquia::oid, v_salvar::oid)
      AND (
        NOT procedimento.prosecdef
        OR pg_catalog.strpos(
          pg_catalog.pg_get_functiondef(procedimento.oid), 'SET search_path TO '''''
        ) = 0
      )
  ) THEN
    RAISE EXCEPTION 'Gatilho/RPC precisa ser SECURITY DEFINER com search_path vazio.';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(v_hierarquia) INTO v_definicao;
  IF pg_catalog.strpos(v_definicao, 'normalizar_cnpj_alfanumerico') = 0
     OR pg_catalog.strpos(v_definicao, 'cnpj_alfanumerico_valido') = 0
     OR pg_catalog.strpos(v_definicao, 'NEW.id = NEW.matriz_cliente_id') = 0
     OR pg_catalog.strpos(v_definicao, 'FOR KEY SHARE') = 0
     OR pg_catalog.strpos(v_definicao, 'matriz.empresa_id = NEW.empresa_id') = 0 THEN
    RAISE EXCEPTION 'Gatilho perdeu validacao do CNPJ, tenant, lock ou auto-referencia.';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(v_salvar) INTO v_definicao;
  IF pg_catalog.strpos(v_definicao, 'current_empresa_id()') = 0
     OR pg_catalog.strpos(v_definicao, 'current_user_has_permission') = 0
     OR pg_catalog.strpos(v_definicao, 'current_user_is_client_scoped') = 0
     OR pg_catalog.strpos(v_definicao, 'p_expected_updated_at') = 0
     OR pg_catalog.strpos(v_definicao, 'FOR SHARE') = 0
     OR pg_catalog.strpos(v_definicao, 'FOR UPDATE') = 0
     OR pg_catalog.strpos(v_definicao, '913331') = 0
     OR pg_catalog.strpos(v_definicao, '913332') = 0
     OR pg_catalog.strpos(v_definicao, '913331')
       > pg_catalog.strpos(v_definicao, '913332')
     OR pg_catalog.strpos(v_definicao, 'cnpj_lookup_snapshot') = 0
     OR pg_catalog.strpos(v_definicao, 'jsonb_typeof') = 0
     OR pg_catalog.strpos(v_definicao, 'normalizar_cnpj_alfanumerico') = 0
     OR pg_catalog.strpos(v_definicao, 'cnpj_alfanumerico_valido') = 0
     OR pg_catalog.strpos(v_definicao, 'configuracoes_protocolos_empresas') > 0
     OR pg_catalog.strpos(v_definicao, 'atividades_rotinas') > 0 THEN
    RAISE EXCEPTION 'RPC de filial perdeu tenant/RBAC/CAS/locks/whitelist ou snapshot.';
  END IF;
END;
$test$;

ROLLBACK;
