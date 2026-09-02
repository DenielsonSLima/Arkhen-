-- Execute apos as migrations 20260902030200 a 20260902030400.
-- Contrato somente leitura para consumidores bancarios e fiscais ativos.
BEGIN;
SET TRANSACTION READ ONLY;

DO $test$
DECLARE
  v_inter_preparar regprocedure := pg_catalog.to_regprocedure(
    'public.preparar_cobranca_inter(uuid,jsonb)'
  );
  v_inter_registrar regprocedure := pg_catalog.to_regprocedure(
    'public.registrar_cobranca_inter(uuid,jsonb)'
  );
  v_webiss regprocedure := pg_catalog.to_regprocedure(
    'public.preparar_emissao_nfse_webiss(uuid,uuid)'
  );
  v_reforma regprocedure := pg_catalog.to_regprocedure(
    'public.validar_reforma_tributaria_xml(uuid,jsonb)'
  );
BEGIN
  IF v_inter_preparar IS NULL
     OR v_inter_registrar IS NULL
     OR v_webiss IS NULL
     OR v_reforma IS NULL THEN
    RAISE EXCEPTION 'Consumidor bancario/fiscal ativo esta ausente.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc procedimento
    JOIN pg_catalog.pg_namespace esquema
      ON esquema.oid = procedimento.pronamespace
    WHERE esquema.nspname = 'public'
      AND procedimento.proname IN (
        'preparar_cobranca_asaas',
        'registrar_cobranca_asaas'
      )
  ) THEN
    RAISE EXCEPTION 'RPC legada do Asaas foi recriada indevidamente.';
  END IF;
END;
$test$;

DO $test$
DECLARE
  v_inter_preparar regprocedure := 'public.preparar_cobranca_inter(uuid,jsonb)'::regprocedure;
  v_inter_registrar regprocedure := 'public.registrar_cobranca_inter(uuid,jsonb)'::regprocedure;
  v_webiss regprocedure := 'public.preparar_emissao_nfse_webiss(uuid,uuid)'::regprocedure;
  v_reforma regprocedure := 'public.validar_reforma_tributaria_xml(uuid,jsonb)'::regprocedure;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        (v_inter_preparar::oid, 'search_path=public, vault, pg_temp'),
        (v_inter_registrar::oid, 'search_path=public, pg_temp'),
        (v_webiss::oid, 'search_path=public, vault, pg_temp'),
        (v_reforma::oid, 'search_path=public, pg_temp')
    ) AS esperado(oid, search_path)
    JOIN pg_catalog.pg_proc procedimento ON procedimento.oid = esperado.oid
    WHERE NOT procedimento.prosecdef
       OR NOT esperado.search_path = ANY(
         COALESCE(procedimento.proconfig, ARRAY[]::text[])
       )
  ) THEN
    RAISE EXCEPTION 'SECURITY DEFINER/search_path dos consumidores foi alterado.';
  END IF;

  IF pg_catalog.has_function_privilege('anon', v_inter_preparar, 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', v_inter_preparar, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('service_role', v_inter_preparar, 'EXECUTE')
     OR pg_catalog.has_function_privilege('anon', v_inter_registrar, 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', v_inter_registrar, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('service_role', v_inter_registrar, 'EXECUTE')
     OR pg_catalog.has_function_privilege('anon', v_webiss, 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', v_webiss, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('service_role', v_webiss, 'EXECUTE')
     OR pg_catalog.has_function_privilege('anon', v_reforma, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated', v_reforma, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('service_role', v_reforma, 'EXECUTE') THEN
    RAISE EXCEPTION 'ACL dos consumidores bancarios/fiscais esta incorreta.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc procedimento
    CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(
      procedimento.proacl,
      pg_catalog.acldefault('f', procedimento.proowner)
    )) permissao
    WHERE procedimento.oid IN (
      v_inter_preparar::oid,
      v_inter_registrar::oid,
      v_webiss::oid,
      v_reforma::oid
    )
      AND permissao.grantee = 0
      AND permissao.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Consumidor SECURITY DEFINER ainda concede EXECUTE a PUBLIC.';
  END IF;
END;
$test$;

DO $test$
DECLARE
  v_preparar text := pg_catalog.pg_get_functiondef(
    'public.preparar_cobranca_inter(uuid,jsonb)'::regprocedure
  );
  v_registrar text := pg_catalog.pg_get_functiondef(
    'public.registrar_cobranca_inter(uuid,jsonb)'::regprocedure
  );
BEGIN
  IF pg_catalog.strpos(v_preparar, 'v_cliente.tipo = ''PF''') = 0
     OR pg_catalog.strpos(
       v_preparar, 'app_private.normalizar_cnpj_alfanumerico'
     ) = 0
     OR pg_catalog.strpos(
       v_preparar, 'app_private.cnpj_alfanumerico_valido'
     ) = 0
     OR pg_catalog.strpos(v_preparar, '''cpfCnpj'', v_documento') = 0
     OR pg_catalog.strpos(
       v_preparar, $needle$NULLIF(v_cfg->>'contaCorrente','') IS NULL$needle$
     ) > 0
     OR pg_catalog.strpos(
       v_preparar, '''contaCorrente'', v_cfg->>''contaCorrente'''
     ) = 0 THEN
    RAISE EXCEPTION 'Preparo Inter perdeu documento seguro ou conta opcional.';
  END IF;

  IF pg_catalog.strpos(v_registrar, 'v_cliente.tipo = ''PF''') = 0
     OR pg_catalog.strpos(
       v_registrar, 'app_private.normalizar_cnpj_alfanumerico'
     ) = 0
     OR pg_catalog.strpos(
       v_registrar, 'app_private.cnpj_alfanumerico_valido'
     ) = 0 THEN
    RAISE EXCEPTION 'Registro Inter perdeu a validacao segura do documento.';
  END IF;
END;
$test$;

DO $test$
DECLARE
  v_webiss text := pg_catalog.pg_get_functiondef(
    'public.preparar_emissao_nfse_webiss(uuid,uuid)'::regprocedure
  );
  v_reforma text := pg_catalog.pg_get_functiondef(
    'public.validar_reforma_tributaria_xml(uuid,jsonb)'::regprocedure
  );
BEGIN
  IF pg_catalog.strpos(
       v_webiss,
       'v_prestador_documento := app_private.normalizar_cnpj_alfanumerico'
     ) = 0
     OR pg_catalog.strpos(
       v_webiss,
       'v_tomador_documento := app_private.normalizar_cnpj_alfanumerico'
     ) = 0
     OR pg_catalog.strpos(v_webiss, 'v_customer.tipo = ''PF''') = 0
     OR pg_catalog.strpos(v_webiss, '''cnpj'', v_prestador_documento') = 0
     OR pg_catalog.strpos(v_webiss, '''documento'', v_tomador_documento') = 0
     OR pg_catalog.strpos(v_webiss, 'FOR UPDATE') = 0 THEN
    RAISE EXCEPTION 'WebISS perdeu documento integral, tipo do tomador ou lock.';
  END IF;

  IF pg_catalog.strpos(
       v_reforma, 'app_private.normalizar_cnpj_alfanumerico'
     ) = 0
     OR pg_catalog.strpos(
       v_reforma, 'app_private.cnpj_alfanumerico_valido'
     ) = 0
     OR pg_catalog.strpos(v_reforma, 'local-name()="CPF"') = 0
     OR pg_catalog.strpos(v_reforma, 'v_cliente_documento_valido IS NOT TRUE') = 0
     OR pg_catalog.strpos(v_reforma, 'v_emitente_documento_valido IS NOT TRUE') = 0
     OR pg_catalog.strpos(v_reforma, '<!DOCTYPE|<!ENTITY') = 0
     OR pg_catalog.strpos(v_reforma, '10485760') = 0 THEN
    RAISE EXCEPTION 'Validador RTC perdeu documento seguro ou protecao de XML.';
  END IF;
END;
$test$;

ROLLBACK;
