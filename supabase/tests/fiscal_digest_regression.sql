-- Regressao sem gravar configuracoes ou segredos e sem emitir NFS-e.
BEGIN;
SET LOCAL search_path = public, vault, pg_temp;
DO $test$
DECLARE
  v_signature text;
  v_source text;
BEGIN
  IF length(encode(extensions.digest('ItabaianaWebISS'::text, 'sha256'), 'hex')) <> 64 THEN
    RAISE EXCEPTION 'Hash SHA256 invalido';
  END IF;
  FOREACH v_signature IN ARRAY ARRAY[
    'public.upsert_configuracao_fiscal(jsonb)',
    'public.upsert_certificado_fiscal_edge(uuid,jsonb)'
  ] LOOP
    SELECT prosrc INTO STRICT v_source FROM pg_proc WHERE oid = v_signature::regprocedure;
    IF strpos(v_source, 'encode(extensions.digest(v_municipio || v_provedor, ''sha256''), ''hex'')') = 0
      OR strpos(v_source, 'encode(digest(') > 0 THEN
      RAISE EXCEPTION 'Referencia pgcrypto incorreta em %', v_signature;
    END IF;
    IF has_function_privilege('anon', v_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'Acesso anonimo indevido em %', v_signature;
    END IF;
  END LOOP;
  IF has_function_privilege('authenticated',
    'public.upsert_certificado_fiscal_edge(uuid,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Upload deve permanecer restrito ao backend';
  END IF;
END;
$test$;
ROLLBACK;
