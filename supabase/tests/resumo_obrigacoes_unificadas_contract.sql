BEGIN;

DO $test$
DECLARE
  v_procedure regprocedure := pg_catalog.to_regprocedure(
    'public.obter_resumo_obrigacoes_unificadas()'
  );
  v_definition text;
  v_security_definer boolean;
  v_volatility "char";
BEGIN
  IF v_procedure IS NULL THEN
    RAISE EXCEPTION 'RPC obter_resumo_obrigacoes_unificadas ausente';
  END IF;

  SELECT
    pg_catalog.pg_get_functiondef(v_procedure),
    procedimento.prosecdef,
    procedimento.provolatile
  INTO v_definition, v_security_definer, v_volatility
  FROM pg_catalog.pg_proc procedimento
  WHERE procedimento.oid = v_procedure;

  IF NOT v_security_definer OR v_volatility <> 's' THEN
    RAISE EXCEPTION 'RPC deve ser STABLE e SECURITY DEFINER';
  END IF;

  IF position('SET search_path TO ''''' in v_definition) = 0
     OR position('auth.uid() IS NULL' in v_definition) = 0
     OR position('current_empresa_id()' in v_definition) = 0
     OR position('current_user_is_client_scoped' in v_definition) = 0
     OR position('parametrizacao:view' in v_definition) = 0
     OR position('parametrizacao:manage' in v_definition) = 0
     OR position('tipo.empresa_id = v_empresa_id' in v_definition) = 0 THEN
    RAISE EXCEPTION 'RPC não aplica todas as guardas de tenant e permissão';
  END IF;

  IF position('FILTER (WHERE tipo.ativo)' in v_definition) = 0
     OR position('tipo.ativo AND tipo.tem_vencimento' in v_definition) = 0
     OR position('jsonb_array_length(tipo.etapas)' in v_definition) = 0 THEN
    RAISE EXCEPTION 'RPC não calcula os quatro indicadores no PostgreSQL';
  END IF;

  IF pg_catalog.has_function_privilege(
       'anon', v_procedure, 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'anon não pode executar o resumo de obrigações';
  END IF;

  IF NOT pg_catalog.has_function_privilege(
       'authenticated', v_procedure, 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'authenticated precisa executar o resumo de obrigações';
  END IF;
END;
$test$;

-- Contrato determinístico das quatro métricas, incluindo etapas inválidas.
WITH fixture(ativo, tem_vencimento, etapas) AS (
  VALUES
    (true, true, '["a", "b"]'::jsonb),
    (true, false, '["c"]'::jsonb),
    (false, true, '["d", "e", "f"]'::jsonb),
    (true, true, '{}'::jsonb)
), resumo AS (
  SELECT jsonb_build_object(
    'total', count(*)::integer,
    'ativos', count(*) FILTER (WHERE ativo)::integer,
    'comPrazo', count(*) FILTER (WHERE ativo AND tem_vencimento)::integer,
    'etapas', COALESCE(sum(CASE
      WHEN ativo AND jsonb_typeof(etapas) = 'array'
        THEN jsonb_array_length(etapas)
      ELSE 0
    END), 0)::integer
  ) AS valor
  FROM fixture
)
SELECT CASE
  WHEN valor = '{"total":4,"ativos":3,"comPrazo":2,"etapas":3}'::jsonb
    THEN true
  ELSE pg_catalog.set_config(
    'app.test_failure',
    'Contrato numérico do resumo de obrigações divergente',
    true
  )::boolean
END
FROM resumo;

ROLLBACK;
