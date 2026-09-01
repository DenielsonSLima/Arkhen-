-- Execute após 20260901161259_sincronizar_progresso_operacional_acompanhamento.
-- Teste somente leitura do contrato, ACL e regra de competência/progresso.

BEGIN;

DO $$
DECLARE
  v_acompanhamento oid;
  v_tarefas oid;
  v_definicao text;
  v_security_definer boolean;
BEGIN
  v_acompanhamento := to_regprocedure(
    'public.obter_progresso_fluxos_acompanhamento()'
  );
  v_tarefas := to_regprocedure(
    'public.obter_progresso_tarefas_operacionais()'
  );
  IF v_acompanhamento IS NULL OR v_tarefas IS NULL THEN
    RAISE EXCEPTION 'RPCs de progresso operacional não foram instaladas.';
  END IF;

  SELECT p.prosecdef, pg_get_functiondef(p.oid)
  INTO v_security_definer, v_definicao
  FROM pg_proc p
  WHERE p.oid = v_acompanhamento;

  IF NOT v_security_definer
     OR v_definicao NOT LIKE '%current_empresa_id()%'
     OR v_definicao NOT LIKE '%protocolos:view%'
     OR v_definicao NOT LIKE '%protocolos:view-own%'
     OR v_definicao NOT LIKE '%current_user_can_access_client_row%'
     OR v_definicao NOT LIKE '%rotina.protocolo_codigo IS NOT NULL%'
     OR v_definicao NOT LIKE '%tarefa.ativo = true%'
     OR v_definicao NOT LIKE '%tipo.referencia_mes_anterior%'
     OR v_definicao NOT LIKE '%interval ''2 months''%'
     OR v_definicao NOT LIKE '%etapa.item -> ''concluida''%'
     OR v_definicao LIKE '%rotina.ativa = true%'
  THEN
    RAISE EXCEPTION 'RPC do Acompanhamento divergiu do contrato seguro.';
  END IF;

  SELECT p.prosecdef, pg_get_functiondef(p.oid)
  INTO v_security_definer, v_definicao
  FROM pg_proc p
  WHERE p.oid = v_tarefas;

  IF v_security_definer
     OR v_definicao NOT LIKE '%current_empresa_id()%'
     OR v_definicao NOT LIKE '%public.atividades_tarefas%'
     OR v_definicao NOT LIKE '%tarefa.ativo = true%'
     OR v_definicao NOT LIKE '%etapa.item -> ''concluida''%'
  THEN
    RAISE EXCEPTION 'RPC de tarefas não preserva tenant, RLS e cálculo no banco.';
  END IF;

  IF has_function_privilege(
       'anon', 'public.obter_progresso_fluxos_acompanhamento()', 'EXECUTE'
     ) OR has_function_privilege(
       'anon', 'public.obter_progresso_tarefas_operacionais()', 'EXECUTE'
     ) OR NOT has_function_privilege(
       'authenticated',
       'public.obter_progresso_fluxos_acompanhamento()', 'EXECUTE'
     ) OR NOT has_function_privilege(
       'authenticated',
       'public.obter_progresso_tarefas_operacionais()', 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'ACL das RPCs de progresso operacional está incorreta.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class classe
    JOIN pg_namespace ns ON ns.oid = classe.relnamespace
    WHERE ns.nspname = 'public'
      AND classe.relname = 'atividades_tarefas'
      AND classe.relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'atividades_tarefas precisa manter RLS habilitada.';
  END IF;

  IF to_char(
       date_trunc('month', DATE '2026-09-21'::timestamp) - interval '1 month',
       'YYYY-MM'
     ) IS DISTINCT FROM '2026-08'
     OR round(9::numeric * 100 / 12)::integer IS DISTINCT FROM 75 THEN
    RAISE EXCEPTION 'Regra de competência legal ou percentual divergiu.';
  END IF;

  -- Uma obrigação Única desativa sua rotina depois da materialização. A tarefa
  -- ativa já criada deve continuar elegível para o progresso operacional.
  IF NOT EXISTS (
    SELECT 1
    FROM (VALUES (true, false, 'obrigacao-unica'::text)) AS caso(
      tarefa_ativa, rotina_ativa, protocolo_codigo
    )
    WHERE caso.tarefa_ativa
      AND NOT caso.rotina_ativa
      AND caso.protocolo_codigo IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Tarefa ativa de rotina Única inativa foi ocultada.';
  END IF;

  -- Em 01/09, a janela Julho–Setembro mantém as competências 08 e 09 visíveis.
  IF DATE '2026-08-01' NOT BETWEEN
       (date_trunc('month', DATE '2026-09-01'::timestamp) - interval '2 months')::date
       AND date_trunc('month', DATE '2026-09-01'::timestamp)::date
     OR DATE '2026-09-01' NOT BETWEEN
       (date_trunc('month', DATE '2026-09-01'::timestamp) - interval '2 months')::date
       AND date_trunc('month', DATE '2026-09-01'::timestamp)::date THEN
    RAISE EXCEPTION 'Janela de competências ocultou agosto ou setembro.';
  END IF;
END;
$$;

ROLLBACK;
