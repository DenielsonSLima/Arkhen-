-- Execute após a sequência 20260901154021..20260901154032 de periodicidades.
-- O teste é somente leitura e falha por exceção se o contrato divergir.

BEGIN;

DO $$
DECLARE
  v_colunas integer;
  v_definicao text;
BEGIN
  SELECT count(*) INTO v_colunas
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN (
      'parametrizacao_protocolos_tipos',
      'parametrizacao_prazos_entrega'
    )
    AND column_name IN ('dia_semana_iso', 'mes_vencimento', 'data_vencimento');
  IF v_colunas <> 6 THEN
    RAISE EXCEPTION 'Contrato incompleto: esperadas 6 colunas de agenda, obtidas %.',
      v_colunas;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.parametrizacao_protocolos_tipos tipo
    WHERE (tipo.periodicidade_padrao = 'semanal')
        IS DISTINCT FROM (tipo.dia_semana_iso IS NOT NULL)
       OR (tipo.periodicidade_padrao = 'anual')
        IS DISTINCT FROM (tipo.mes_vencimento IS NOT NULL)
       OR (tipo.periodicidade_padrao = 'unica')
        IS DISTINCT FROM (tipo.data_vencimento IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Há obrigação fora da agenda canônica por periodicidade.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.parametrizacao_prazos_entrega prazo
    WHERE (prazo.fechamento = 'semanal')
        IS DISTINCT FROM (prazo.dia_semana_iso IS NOT NULL)
       OR (prazo.fechamento = 'anual')
        IS DISTINCT FROM (prazo.mes_vencimento IS NOT NULL)
       OR (prazo.fechamento = 'unica')
        IS DISTINCT FROM (prazo.data_vencimento IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Há prazo espelho fora da agenda canônica por periodicidade.';
  END IF;

  IF app_private.primeira_data_base_rotina(
    DATE '2026-09-01', 'Única', 1, DATE '2026-10-15', NULL, NULL, false
  ) IS DISTINCT FROM DATE '2026-10-15' THEN
    RAISE EXCEPTION 'A frequência Única perdeu sua data de ocorrência.';
  END IF;

  IF app_private.primeira_data_base_rotina(
    DATE '2026-03-01', 'Personalizada', 365,
    DATE '2024-02-29', 29, NULL, true
  ) IS DISTINCT FROM DATE '2027-02-28' THEN
    RAISE EXCEPTION 'A cadência anual deixou de avançar por 12 meses de calendário.';
  END IF;

  -- Depois do backfill, normalizar novamente deve ser um ponto fixo: isso
  -- prova que nenhum prazo antigo do JSON do parceiro continua prevalecendo.
  IF EXISTS (
    SELECT 1
    FROM public.clientes cliente
    WHERE cliente.status = 'Ativa'
      AND EXISTS (
        SELECT 1
        FROM public.parametrizacao_catalogos tipo_parceiro
        WHERE tipo_parceiro.id = cliente.tipo_parceiro_id
          AND tipo_parceiro.empresa_id = cliente.empresa_id
          AND tipo_parceiro.tipo = 'tipos_parceiros'
          AND tipo_parceiro.codigo IN ('cliente_contabil', 'tp-1')
          AND tipo_parceiro.ativo = true
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.configuracoes_protocolos_empresas cfg
        WHERE cfg.empresa_id = cliente.empresa_id
          AND cfg.cliente_id = cliente.id
      )
  ) THEN
    RAISE EXCEPTION 'O backfill não persistiu configuração para todo cliente contábil.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.configuracoes_protocolos_empresas cfg
    JOIN public.clientes cliente
      ON cliente.empresa_id = cfg.empresa_id
     AND cliente.id = cfg.cliente_id
    WHERE cliente.status = 'Ativa'
      AND EXISTS (
        SELECT 1
        FROM public.parametrizacao_catalogos tipo_parceiro
        WHERE tipo_parceiro.id = cliente.tipo_parceiro_id
          AND tipo_parceiro.empresa_id = cliente.empresa_id
          AND tipo_parceiro.tipo = 'tipos_parceiros'
          AND tipo_parceiro.codigo IN ('cliente_contabil', 'tp-1')
          AND tipo_parceiro.ativo = true
      )
      AND cfg.configs IS DISTINCT FROM
        app_private.normalizar_configs_protocolos_cliente(
          cfg.empresa_id,
          cfg.cliente_id,
          app_private.mesclar_configs_obrigacoes_legadas(
            cfg.empresa_id, cfg.cliente_id, cfg.configs
          )
        )
  ) THEN
    RAISE EXCEPTION 'O backfill não deixou as configurações em forma canônica.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.configuracoes_protocolos_empresas cfg
    JOIN public.clientes cliente
      ON cliente.empresa_id = cfg.empresa_id
     AND cliente.id = cfg.cliente_id
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(cfg.configs) = 'array'
        THEN cfg.configs ELSE '[]'::jsonb END
    ) item(valor)
    JOIN public.parametrizacao_protocolos_tipos tipo
      ON tipo.empresa_id = cfg.empresa_id
     AND tipo.codigo = item.valor ->> 'entregaId'
    LEFT JOIN public.atividades_rotinas rotina
      ON rotina.empresa_id = cfg.empresa_id
     AND rotina.cliente_id = cfg.cliente_id
     AND rotina.protocolo_codigo = tipo.codigo
    WHERE cliente.status = 'Ativa'
      AND EXISTS (
        SELECT 1
        FROM public.parametrizacao_catalogos tipo_parceiro
        WHERE tipo_parceiro.id = cliente.tipo_parceiro_id
          AND tipo_parceiro.empresa_id = cliente.empresa_id
          AND tipo_parceiro.tipo = 'tipos_parceiros'
          AND tipo_parceiro.codigo IN ('cliente_contabil', 'tp-1')
          AND tipo_parceiro.ativo = true
      )
      AND item.valor ->> 'ativo' = 'true'
      AND (
        rotina.id IS NULL
        OR rotina.ativa IS DISTINCT FROM CASE
          WHEN item.valor ->> 'periodicidade' = 'unica'
            AND EXISTS (
              SELECT 1
              FROM public.atividades_tarefas tarefa
              WHERE tarefa.empresa_id = rotina.empresa_id
                AND tarefa.rotina_id = rotina.id
                AND tarefa.origem = 'Rotina'
            ) THEN false
          ELSE true
        END
        OR rotina.frequencia IS DISTINCT FROM CASE item.valor ->> 'periodicidade'
          WHEN 'diaria' THEN 'Diária'
          WHEN 'unica' THEN 'Única'
          WHEN 'semanal' THEN 'Semanal'
          WHEN 'quinzenal' THEN 'Quinzenal'
          WHEN 'mensal' THEN 'Mensal'
          WHEN 'trimestral' THEN 'Trimestral'
          WHEN 'semestral' THEN 'Semestral'
          ELSE 'Personalizada'
        END
        OR rotina.data_ancora IS DISTINCT FROM
          (item.valor ->> 'dataInicial')::date
        OR rotina.intervalo_dias IS DISTINCT FROM CASE item.valor ->> 'periodicidade'
          WHEN 'diaria' THEN 1
          WHEN 'unica' THEN 1
          WHEN 'semanal' THEN 7
          WHEN 'quinzenal' THEN 15
          WHEN 'mensal' THEN 30
          WHEN 'trimestral' THEN 90
          WHEN 'semestral' THEN 180
          WHEN 'anual' THEN 365
          ELSE (item.valor ->> 'intervaloDias')::integer
        END
        OR rotina.proxima_execucao IS DISTINCT FROM
          (item.valor ->> 'proximaExecucao')::date
        OR rotina.incluir_finais_de_semana IS DISTINCT FROM false
        OR rotina.dia_semana_iso IS DISTINCT FROM CASE
          WHEN item.valor ->> 'periodicidade' = 'semanal'
            THEN (item.valor ->> 'diaSemana')::integer
          ELSE NULL END
        OR rotina.dia_mes IS DISTINCT FROM CASE
          WHEN item.valor ->> 'periodicidade' IN (
            'mensal', 'trimestral', 'semestral', 'anual'
          ) THEN (item.valor ->> 'diaMes')::integer
          ELSE NULL END
      )
  ) THEN
    RAISE EXCEPTION 'Há rotina ativa ausente ou divergente da agenda canônica.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.atividades_rotinas rotina
    JOIN public.clientes cliente
      ON cliente.empresa_id = rotina.empresa_id
     AND cliente.id = rotina.cliente_id
    WHERE cliente.status = 'Ativa'
      AND rotina.protocolo_codigo IS NOT NULL
      AND rotina.ativa = true
      AND EXISTS (
        SELECT 1
        FROM public.parametrizacao_catalogos tipo_parceiro
        WHERE tipo_parceiro.id = cliente.tipo_parceiro_id
          AND tipo_parceiro.empresa_id = cliente.empresa_id
          AND tipo_parceiro.tipo = 'tipos_parceiros'
          AND tipo_parceiro.codigo IN ('cliente_contabil', 'tp-1')
          AND tipo_parceiro.ativo = true
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.configuracoes_protocolos_empresas cfg
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(cfg.configs) = 'array'
            THEN cfg.configs ELSE '[]'::jsonb END
        ) item(valor)
        WHERE cfg.empresa_id = rotina.empresa_id
          AND cfg.cliente_id = rotina.cliente_id
          AND item.valor ->> 'entregaId' = rotina.protocolo_codigo
          AND item.valor ->> 'ativo' = 'true'
      )
  ) THEN
    RAISE EXCEPTION 'Há rotina ativa sem obrigação ativa no parceiro.';
  END IF;

  SELECT pg_get_functiondef(
    'public.salvar_obrigacao_unificada(jsonb)'::regprocedure
  ) INTO v_definicao;
  IF v_definicao NOT LIKE '%''diaria'', ''unica'', ''semanal''%'
     OR v_definicao NOT LIKE '%''anual''%'
     OR v_definicao NOT LIKE '%dataVencimento%'
     OR v_definicao NOT LIKE '%mesVencimento%'
     OR v_definicao NOT LIKE '%diaSemana%'
     OR v_definicao NOT LIKE '%normalizar_configs_protocolos_cliente%'
     OR v_definicao NOT LIKE '%sincronizar_rotinas_protocolos_cliente%'
     OR v_definicao NOT LIKE '%tarefa.origem = ''Rotina''%' THEN
    RAISE EXCEPTION 'A RPC de gravação não expõe todo o contrato de periodicidades.';
  END IF;

  SELECT pg_get_functiondef(
    'public.get_protocolos_operacionais()'::regprocedure
  ) INTO v_definicao;
  IF v_definicao NOT LIKE '%''Diária''%'
     OR v_definicao NOT LIKE '%''Única''%'
     OR v_definicao NOT LIKE '%''Semanal''%'
     OR v_definicao NOT LIKE '%''Anual''%'
     OR v_definicao LIKE '%config_item.valor ->> ''periodicidade''%'
     OR v_definicao LIKE '%config_item.valor -> ''dataInicial''%'
     OR v_definicao LIKE '%config_item.valor -> ''diaSemana''%'
     OR v_definicao LIKE '%config_item.valor -> ''mesVencimento''%'
     OR v_definicao LIKE '%config_item.valor -> ''dataVencimento''%' THEN
    RAISE EXCEPTION 'A projeção legal não cobre todas as novas periodicidades.';
  END IF;

  SELECT pg_get_functiondef(
    'public.atualizar_protocolo_entrega(jsonb)'::regprocedure
  ) INTO v_definicao;
  IF v_definicao NOT LIKE '%''Diária'', ''Semanal'', ''Única'', ''Anual''%'
     OR v_definicao NOT LIKE '%jsonb_array_elements(public.get_protocolos_operacionais())%'
     OR v_definicao NOT LIKE '%protocolo.periodo_referencia = v_periodo%' THEN
    RAISE EXCEPTION 'A mutação não valida IDs das novas ocorrências projetadas.';
  END IF;

  SELECT pg_get_functiondef(
    'app_private.normalizar_configs_protocolos_cliente(uuid,uuid,jsonb,date)'
      ::regprocedure
  ) INTO v_definicao;
  IF v_definicao NOT LIKE '%WHEN ''unica'' THEN ''Única''%'
     OR v_definicao NOT LIKE '%WHEN ''anual'' THEN 365%'
     OR v_definicao NOT LIKE '%dataVencimento%'
     OR v_definicao NOT LIKE '%mesVencimento%'
     OR v_definicao NOT LIKE '%diaSemana%'
     OR v_definicao LIKE '%v_config -> ''dataInicial''%'
     OR v_definicao LIKE '%v_config -> ''diaMes''%'
     OR v_definicao LIKE '%v_config -> ''diaSemana''%'
     OR v_definicao LIKE '%v_config -> ''mesVencimento''%'
     OR v_definicao LIKE '%v_config -> ''dataVencimento''%' THEN
    RAISE EXCEPTION 'A normalização não materializa o contrato canônico completo.';
  END IF;

  SELECT pg_get_functiondef(
    'public.sincronizar_rotinas_protocolos_cliente(uuid,uuid,jsonb)'
      ::regprocedure
  ) INTO v_definicao;
  IF v_definicao NOT LIKE '%WHEN ''unica'' THEN ''Única''%'
     OR v_definicao NOT LIKE '%WHEN ''anual'' THEN 365%'
     OR v_definicao NOT LIKE '%dia_semana_iso%'
     OR v_definicao NOT LIKE '%v_configs_reconciliadas%'
     OR v_definicao NOT LIKE '%normalizar_configs_protocolos_cliente%'
     OR v_definicao NOT LIKE '%tarefa.origem = ''Rotina''%'
     OR v_definicao NOT LIKE '%SET ativa = false%'
     OR v_definicao NOT LIKE '%cfg.configs IS DISTINCT FROM%'
     THEN
    RAISE EXCEPTION 'A sincronização não cobre as novas cadências.';
  END IF;

  IF has_function_privilege(
       'anon', 'public.salvar_obrigacao_unificada(jsonb)', 'EXECUTE'
     ) OR has_function_privilege(
       'anon', 'public.listar_obrigacoes_unificadas()', 'EXECUTE'
     ) OR has_function_privilege(
       'authenticated', 'public.get_protocolos_operacionais()', 'EXECUTE'
     ) OR NOT has_function_privilege(
       'authenticated', 'public.get_protocolos_operacionais_seguros()', 'EXECUTE'
     ) OR has_function_privilege(
       'authenticated',
       'app_private.normalizar_configs_protocolos_cliente(uuid,uuid,jsonb,date)',
       'EXECUTE'
     ) OR has_function_privilege(
       'authenticated',
       'public.sincronizar_rotinas_protocolos_cliente(uuid,uuid,jsonb)',
       'EXECUTE'
     ) OR has_function_privilege(
       'authenticated', 'public.atualizar_protocolo_entrega(jsonb)', 'EXECUTE'
     ) OR has_function_privilege(
       'anon', 'public.salvar_protocolo_operacional_seguro(jsonb)', 'EXECUTE'
     ) OR NOT has_function_privilege(
       'authenticated',
       'public.salvar_protocolo_operacional_seguro(jsonb)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'ACL das RPCs de obrigações/protocolos divergiu do contrato seguro.';
  END IF;

  IF has_table_privilege(
       'authenticated', 'public.parametrizacao_protocolos_tipos', 'INSERT'
     ) OR has_table_privilege(
       'authenticated', 'public.parametrizacao_prazos_entrega', 'UPDATE'
     ) THEN
    RAISE EXCEPTION 'As tabelas canônicas continuam expostas para gravação direta.';
  END IF;
END;
$$;

ROLLBACK;
