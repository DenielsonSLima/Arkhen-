-- Evita exibir a validade do certificado anterior enquanto um novo arquivo
-- ainda nao foi validado pelo teste mTLS/OAuth.
DO $migration$
DECLARE
  v_definition text;
  v_updated text;
BEGIN
  SELECT pg_get_functiondef('public.build_inter_environment_config(uuid,text,jsonb,jsonb)'::regprocedure)
    INTO v_definition;
  v_updated := replace(
    v_definition,
    $old$    'certificadoValidoDe', p_current->>'certificadoValidoDe',
    'certificadoValidoAte', p_current->>'certificadoValidoAte');$old$,
    $new$    'certificadoValidoDe', CASE WHEN v_clear_certificado OR NULLIF(v_certificado, '') IS NOT NULL
      THEN NULL ELSE p_current->>'certificadoValidoDe' END,
    'certificadoValidoAte', CASE WHEN v_clear_certificado OR NULLIF(v_certificado, '') IS NOT NULL
      THEN NULL ELSE p_current->>'certificadoValidoAte' END);$new$
  );
  IF v_updated <> v_definition THEN
    EXECUTE v_updated;
  ELSIF position('CASE WHEN v_clear_certificado' in v_definition) = 0 THEN
    RAISE EXCEPTION 'Nao foi possivel ajustar a validade do certificado Inter.';
  END IF;
END;
$migration$;
