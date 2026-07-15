-- O Banco Inter exige x-conta-corrente somente quando a aplicacao esta
-- associada a mais de uma conta. O fluxo padrao usa apenas mTLS e OAuth.
DO $migration$
DECLARE
  v_definition text;
  v_updated text;
BEGIN
  SELECT pg_get_functiondef('public.build_inter_environment_config(uuid,text,jsonb,jsonb)'::regprocedure)
    INTO v_definition;
  v_updated := replace(
    v_definition,
    $old$v_conta text := ltrim(regexp_replace(coalesce(NULLIF(p_payload->>'contaCorrente', ''),
    NULLIF(p_payload->>'conta_corrente', ''), p_current->>'contaCorrente', ''), '[^0-9]', '', 'g'), '0');$old$,
    $new$v_conta text := '';$new$
  );
  v_updated := replace(
    v_updated,
    $old$  IF v_conta <> '' AND length(v_conta) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Conta corrente Inter invalida.'; END IF;
$old$,
    ''
  );
  IF v_updated = v_definition THEN
    RAISE EXCEPTION 'Nao foi possivel atualizar build_inter_environment_config.';
  END IF;
  EXECUTE v_updated;

  SELECT pg_get_functiondef('public.upsert_configuracao_inter(jsonb)'::regprocedure)
    INTO v_definition;
  v_updated := replace(
    v_definition,
    $old$    AND NULLIF(v_selected->>'contaCorrente', '') IS NOT NULL
$old$,
    ''
  );
  IF v_updated = v_definition THEN
    RAISE EXCEPTION 'Nao foi possivel atualizar upsert_configuracao_inter.';
  END IF;
  EXECUTE v_updated;

  SELECT pg_get_functiondef('public.preparar_cobranca_inter(uuid,jsonb)'::regprocedure)
    INTO v_definition;
  v_updated := replace(
    v_definition,
    $old$  IF NULLIF(v_cfg->>'contaCorrente','') IS NULL OR NULLIF(v_cfg->>'baseUrl','') IS NULL
    OR NULLIF(v_cfg->>'authUrl','') IS NULL THEN RAISE EXCEPTION 'Ambiente Inter incompleto.'; END IF;$old$,
    $new$  IF NULLIF(v_cfg->>'baseUrl','') IS NULL
    OR NULLIF(v_cfg->>'authUrl','') IS NULL THEN RAISE EXCEPTION 'Ambiente Inter incompleto.'; END IF;$new$
  );
  IF v_updated = v_definition THEN
    RAISE EXCEPTION 'Nao foi possivel atualizar preparar_cobranca_inter.';
  END IF;
  EXECUTE v_updated;
END;
$migration$;

UPDATE public.configuracoes_integracao_bancaria
SET configuracao = jsonb_set(
  jsonb_set(
    coalesce(configuracao, '{}'::jsonb),
    '{environments,producao,contaCorrente}',
    '""'::jsonb,
    true
  ),
  '{environments,homologacao,contaCorrente}',
  '""'::jsonb,
  true
),
updated_at = now()
WHERE provedor = 'inter';
