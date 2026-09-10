-- Qualifica pgcrypto sem ampliar search_path ou alterar ACLs/isolamento.
DO $migration$
DECLARE
  v_signature text;
  v_definition text;
  v_old text := 'encode(digest(v_municipio || v_provedor, ''sha256''), ''hex'')';
  v_new text := 'encode(extensions.digest(v_municipio || v_provedor, ''sha256''), ''hex'')';
BEGIN
  IF to_regprocedure('extensions.digest(text,text)') IS NULL THEN
    RAISE EXCEPTION 'pgcrypto extensions.digest(text,text) indisponivel';
  END IF;
  FOREACH v_signature IN ARRAY ARRAY[
    'public.upsert_configuracao_fiscal(jsonb)',
    'public.upsert_certificado_fiscal_edge(uuid,jsonb)'
  ] LOOP
    v_definition := pg_get_functiondef(v_signature::regprocedure);
    IF strpos(v_definition, v_old) > 0 THEN
      EXECUTE replace(v_definition, v_old, v_new);
    ELSIF strpos(v_definition, v_new) = 0 THEN
      RAISE EXCEPTION 'Definicao inesperada de %; revisar antes de alterar', v_signature;
    END IF;
  END LOOP;
END;
$migration$;
