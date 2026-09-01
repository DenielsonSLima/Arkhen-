-- Execute após 20260901190000_filiais_operacionais_clientes e 20260901190100_filiais_operacionais_rpc_e_ciclo.
-- Teste somente leitura: falha se estrutura, RLS, ACL ou ausência de provisionamento implícito divergirem.
BEGIN;
DO $test$
DECLARE
  v_empresa_attnum smallint;
  v_id_attnum smallint;
  v_matriz_attnum smallint;
  v_constraint_definition text;
  v_index_definition text;
  v_index regclass;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns coluna
    WHERE coluna.table_schema = 'public'
      AND coluna.table_name = 'clientes'
      AND coluna.column_name = 'matriz_cliente_id'
      AND coluna.data_type = 'uuid'
      AND coluna.is_nullable = 'YES'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns coluna
    WHERE coluna.table_schema = 'public'
      AND coluna.table_name = 'clientes'
      AND coluna.column_name = 'filial_ref'
      AND coluna.data_type = 'text'
      AND coluna.is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'Clientes não expõe as colunas opcionais de hierarquia de filiais.';
  END IF;

  SELECT atributo.attnum INTO v_empresa_attnum
  FROM pg_catalog.pg_attribute atributo
  WHERE atributo.attrelid = 'public.clientes'::regclass
    AND atributo.attname = 'empresa_id'
    AND NOT atributo.attisdropped;
  SELECT atributo.attnum INTO v_id_attnum
  FROM pg_catalog.pg_attribute atributo
  WHERE atributo.attrelid = 'public.clientes'::regclass
    AND atributo.attname = 'id'
    AND NOT atributo.attisdropped;
  SELECT atributo.attnum INTO v_matriz_attnum
  FROM pg_catalog.pg_attribute atributo
  WHERE atributo.attrelid = 'public.clientes'::regclass
    AND atributo.attname = 'matriz_cliente_id'
    AND NOT atributo.attisdropped;

  IF v_empresa_attnum IS NULL OR v_id_attnum IS NULL OR v_matriz_attnum IS NULL THEN
    RAISE EXCEPTION 'A chave tenant/cliente usada pelas filiais está incompleta.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index indice
    WHERE indice.indrelid = 'public.clientes'::regclass
      AND indice.indisunique
      AND indice.indisvalid
      AND indice.indpred IS NULL
      AND position(
        '(empresa_id, id)' IN pg_catalog.pg_get_indexdef(indice.indexrelid)
      ) > 0
  ) THEN
    RAISE EXCEPTION 'Clientes não preserva unicidade por (empresa_id, id).';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint restricao
    WHERE restricao.conrelid = 'public.clientes'::regclass
      AND restricao.conname = 'clientes_matriz_cliente_tenant_fk'
      AND restricao.contype = 'f'
      AND restricao.convalidated
      AND restricao.conkey = ARRAY[v_empresa_attnum, v_matriz_attnum]::smallint[]
      AND restricao.confrelid = 'public.clientes'::regclass
      AND restricao.confkey = ARRAY[v_empresa_attnum, v_id_attnum]::smallint[]
      AND restricao.confupdtype = 'r'
      AND restricao.confdeltype = 'r'
  ) THEN
    RAISE EXCEPTION 'A FK composta matriz/filial deixou de restringir o tenant.';
  END IF;

  SELECT pg_catalog.pg_get_constraintdef(restricao.oid, true)
  INTO v_constraint_definition
  FROM pg_catalog.pg_constraint restricao
  WHERE restricao.conrelid = 'public.clientes'::regclass
    AND restricao.conname = 'clientes_matriz_filial_forma_check'
    AND restricao.contype = 'c'
    AND restricao.convalidated;

  IF v_constraint_definition IS NULL
     OR position('matriz_cliente_id is null' IN lower(v_constraint_definition)) = 0
     OR position('filial_ref is null' IN lower(v_constraint_definition)) = 0
     OR position('matriz_cliente_id is not null' IN lower(v_constraint_definition)) = 0
     OR position('filial_ref is not null' IN lower(v_constraint_definition)) = 0
     OR position('tipo_estabelecimento = ''matriz''' IN lower(v_constraint_definition)) = 0
     OR position('tipo_estabelecimento = ''filial''' IN lower(v_constraint_definition)) = 0 THEN
    RAISE EXCEPTION 'O CHECK de forma matriz/filial não está validado ou está incompleto.';
  END IF;

  v_index := pg_catalog.to_regclass('public.clientes_matriz_operacional_idx');
  IF v_index IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index indice
    WHERE indice.indexrelid = v_index
      AND indice.indrelid = 'public.clientes'::regclass
      AND NOT indice.indisunique
      AND indice.indisvalid
      AND indice.indpred IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Índice operacional de matriz/filial ausente ou inválido.';
  END IF;
  SELECT pg_catalog.pg_get_indexdef(v_index) INTO v_index_definition;
  IF position('empresa_id, matriz_cliente_id' IN v_index_definition) = 0
     OR position('matriz_cliente_id IS NOT NULL' IN v_index_definition) = 0 THEN
    RAISE EXCEPTION 'Índice operacional de matriz/filial perdeu chave ou predicado.';
  END IF;

  v_index := pg_catalog.to_regclass('public.clientes_filial_ref_por_matriz_unq');
  IF v_index IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index indice
    WHERE indice.indexrelid = v_index
      AND indice.indrelid = 'public.clientes'::regclass
      AND indice.indisunique
      AND indice.indisvalid
      AND indice.indpred IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Índice único de referência da filial ausente ou inválido.';
  END IF;
  SELECT pg_catalog.pg_get_indexdef(v_index) INTO v_index_definition;
  IF position('empresa_id, matriz_cliente_id' IN v_index_definition) = 0
     OR position('lower(btrim(filial_ref))' IN lower(v_index_definition)) = 0
     OR position('matriz_cliente_id IS NOT NULL' IN v_index_definition) = 0 THEN
    RAISE EXCEPTION 'Índice único de referência da filial perdeu normalização ou predicado.';
  END IF;
END;
$test$;

DO $test$
DECLARE
  v_hierarquia regprocedure := pg_catalog.to_regprocedure(
    'app_private.validar_hierarquia_filial_cliente()'
  );
  v_modelos regprocedure := pg_catalog.to_regprocedure(
    'public.set_default_clientes_modelos_ativos()'
  );
  v_ciclo regprocedure := pg_catalog.to_regprocedure(
    'app_private.sincronizar_obrigacoes_ciclo_cliente()'
  );
  v_classificacoes regprocedure := pg_catalog.to_regprocedure(
    'app_private.sincronizar_classificacoes_matriz_filiais()'
  );
  v_bloqueio regprocedure := pg_catalog.to_regprocedure(
    'app_private.bloquear_obrigacoes_cliente_statement()'
  );
  v_definition text;
BEGIN
  IF v_hierarquia IS NULL OR v_modelos IS NULL OR v_ciclo IS NULL
     OR v_classificacoes IS NULL OR v_bloqueio IS NULL THEN
    RAISE EXCEPTION 'Uma função necessária aos gatilhos de filiais está ausente.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger gatilho
    WHERE gatilho.tgrelid = 'public.clientes'::regclass
      AND gatilho.tgname = 'validar_hierarquia_filial_cliente'
      AND NOT gatilho.tgisinternal
      AND gatilho.tgenabled <> 'D'
      AND gatilho.tgfoid = v_hierarquia
      AND (gatilho.tgtype::integer & 1) = 1
      AND (gatilho.tgtype::integer & 2) = 2
      AND (gatilho.tgtype::integer & 4) = 4
      AND (gatilho.tgtype::integer & 16) = 16
  ) THEN
    RAISE EXCEPTION 'Gatilho de validação de hierarquia matriz/filial ausente.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger gatilho
    WHERE gatilho.tgrelid = 'public.clientes'::regclass
      AND gatilho.tgname = 'set_clientes_modelos_ativos_before_insert'
      AND NOT gatilho.tgisinternal
      AND gatilho.tgenabled <> 'D'
      AND gatilho.tgfoid = v_modelos
      AND (gatilho.tgtype::integer & 1) = 1
      AND (gatilho.tgtype::integer & 2) = 2
      AND (gatilho.tgtype::integer & 4) = 4
  ) THEN
    RAISE EXCEPTION 'Gatilho de modelo vazio no novo parceiro está ausente.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger gatilho
    WHERE gatilho.tgrelid = 'public.clientes'::regclass
      AND gatilho.tgname = 'sincronizar_obrigacoes_ciclo_cliente'
      AND NOT gatilho.tgisinternal
      AND gatilho.tgenabled <> 'D'
      AND gatilho.tgfoid = v_ciclo
      AND (gatilho.tgtype::integer & 1) = 1
      AND (gatilho.tgtype::integer & 2) = 0
      AND (gatilho.tgtype::integer & 4) = 4
      AND (gatilho.tgtype::integer & 16) = 16
  ) THEN
    RAISE EXCEPTION 'Gatilho do ciclo de obrigações das filiais está ausente.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger gatilho
    WHERE gatilho.tgrelid = 'public.clientes'::regclass
      AND gatilho.tgname = 'bloquear_obrigacoes_cliente_statement'
      AND NOT gatilho.tgisinternal
      AND gatilho.tgenabled <> 'D'
      AND gatilho.tgfoid = v_bloqueio
      AND (gatilho.tgtype::integer & 1) = 0
      AND (gatilho.tgtype::integer & 2) = 2
      AND (gatilho.tgtype::integer & 4) = 4
      AND (gatilho.tgtype::integer & 16) = 16
  ) THEN
    RAISE EXCEPTION 'Gatilho statement de serialização das filiais está ausente.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger gatilho
    WHERE gatilho.tgrelid = 'public.clientes'::regclass
      AND gatilho.tgname = 'sincronizar_classificacoes_matriz_filiais'
      AND NOT gatilho.tgisinternal
      AND gatilho.tgenabled <> 'D'
      AND gatilho.tgfoid = v_classificacoes
      AND (gatilho.tgtype::integer & 1) = 1
      AND (gatilho.tgtype::integer & 2) = 0
      AND (gatilho.tgtype::integer & 16) = 16
  ) THEN
    RAISE EXCEPTION 'Gatilho de propagação das classificações da matriz está ausente.';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(v_hierarquia) INTO v_definition;
  IF position('NEW.id = NEW.matriz_cliente_id' IN v_definition) = 0
     OR position('OLD.matriz_cliente_id IS NOT NULL' IN v_definition) = 0
     OR position('OLD.matriz_cliente_id IS NULL' IN v_definition) = 0
     OR position('matriz.empresa_id = NEW.empresa_id' IN v_definition) = 0
     OR position('FOR KEY SHARE' IN v_definition) = 0
     OR position('^[a-z0-9][a-z0-9_-]{0,79}$' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'A validação de hierarquia não protege auto-referência, tenant ou conversões.';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(v_classificacoes) INTO v_definition;
  IF position('NEW.matriz_cliente_id IS NOT NULL' IN v_definition) = 0
     OR position('UPDATE public.clientes filial' IN v_definition) = 0
     OR position('tipo_parceiro_id = NEW.tipo_parceiro_id' IN v_definition) = 0
     OR position('tipo_empresa_id = NEW.tipo_empresa_id' IN v_definition) = 0
     OR position('natureza_juridica_id = NEW.natureza_juridica_id' IN v_definition) = 0
     OR position('categoria_cliente = NEW.categoria_cliente' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'A propagação das classificações matriz/filial está incompleta.';
  END IF;
END;
$test$;

DO $test$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class classe
    JOIN pg_catalog.pg_namespace esquema
      ON esquema.oid = classe.relnamespace
    WHERE esquema.nspname = 'public'
      AND classe.relname = 'clientes'
      AND classe.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Clientes precisa manter RLS habilitada para filiais operacionais.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy politica
    WHERE politica.polrelid = 'public.clientes'::regclass
      AND politica.polname = 'clientes_select_operacional_scope'
      AND politica.polcmd = 'r'
      AND NOT politica.polpermissive
      AND (pg_catalog.to_regrole('authenticated'))::oid = ANY (politica.polroles)
      AND pg_catalog.pg_get_expr(politica.polqual, politica.polrelid)
        ILIKE '%current_user_can_access_cliente_operacional%'
  ) THEN
    RAISE EXCEPTION 'A policy restritiva de leitura operacional de clientes está ausente.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy politica
    WHERE politica.polrelid = 'public.clientes'::regclass
      AND politica.polname = 'clientes_insert_apenas_matriz'
      AND politica.polcmd = 'a'
      AND NOT politica.polpermissive
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polwithcheck, politica.polrelid
      ), '')) LIKE '%clientes:create%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polwithcheck, politica.polrelid
      ), '')) LIKE '%matriz_cliente_id is null%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polwithcheck, politica.polrelid
      ), '')) LIKE '%filial_ref is null%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polwithcheck, politica.polrelid
      ), '')) LIKE '%tipo_estabelecimento = ''matriz''%'
  ) THEN
    RAISE EXCEPTION 'A policy restritiva de insert direto apenas em matriz está ausente.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy politica
    WHERE politica.polrelid = 'public.clientes'::regclass
      AND politica.polname = 'clientes_update_apenas_matriz'
      AND politica.polcmd = 'w'
      AND NOT politica.polpermissive
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polqual, politica.polrelid
      ), '')) LIKE '%clientes:update%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polqual, politica.polrelid
      ), '')) LIKE '%matriz_cliente_id is null%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polwithcheck, politica.polrelid
      ), '')) LIKE '%filial_ref is null%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polwithcheck, politica.polrelid
      ), '')) LIKE '%tipo_estabelecimento = ''matriz''%'
  ) THEN
    RAISE EXCEPTION 'A policy restritiva de update direto apenas em matriz está ausente.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy politica
    WHERE politica.polrelid = 'public.clientes'::regclass
      AND politica.polname = 'clientes_delete_apenas_matriz'
      AND politica.polcmd = 'd'
      AND NOT politica.polpermissive
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polqual, politica.polrelid
      ), '')) LIKE '%clientes:delete%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polqual, politica.polrelid
      ), '')) LIKE '%matriz_cliente_id is null%'
  ) THEN
    RAISE EXCEPTION 'A policy restritiva de delete direto apenas em matriz está ausente.';
  END IF;
END;
$test$;

DO $test$
DECLARE
  v_salvar regprocedure := pg_catalog.to_regprocedure(
    'public.salvar_filial_cliente_v1(uuid,uuid,jsonb,timestamp with time zone)'
  );
  v_status regprocedure := pg_catalog.to_regprocedure(
    'public.definir_status_filial_cliente_v1(uuid,uuid,text,timestamp with time zone)'
  );
  v_obter_configuracao regprocedure := pg_catalog.to_regprocedure(
    'public.obter_configuracao_protocolos_cliente(uuid)'
  );
  v_acesso_uuid regprocedure := pg_catalog.to_regprocedure(
    'public.current_user_can_access_client_row(uuid,uuid)'
  );
  v_acesso_texto regprocedure := pg_catalog.to_regprocedure(
    'public.current_user_can_access_client_row(uuid,text)'
  );
  v_acesso_operacional regprocedure := pg_catalog.to_regprocedure(
    'public.current_user_can_access_cliente_operacional(uuid,uuid)'
  );
  v_modelos regprocedure := pg_catalog.to_regprocedure(
    'public.set_default_clientes_modelos_ativos()'
  );
  v_ciclo regprocedure := pg_catalog.to_regprocedure(
    'app_private.sincronizar_obrigacoes_ciclo_cliente()'
  );
  v_definition text;
  v_insert_guard integer;
  v_no_config_guard integer;
  v_config_write integer;
BEGIN
  IF v_salvar IS NULL OR v_status IS NULL OR v_obter_configuracao IS NULL
     OR v_acesso_uuid IS NULL OR v_acesso_texto IS NULL
     OR v_acesso_operacional IS NULL OR v_modelos IS NULL OR v_ciclo IS NULL THEN
    RAISE EXCEPTION 'Uma RPC ou função de acesso de filiais está ausente.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc procedimento
    WHERE procedimento.oid IN (
      v_salvar::oid, v_status::oid, v_obter_configuracao::oid,
      v_acesso_uuid::oid, v_acesso_texto::oid, v_acesso_operacional::oid,
      v_modelos::oid, v_ciclo::oid
    )
      AND (
        NOT procedimento.prosecdef
        OR position(
          'SET search_path TO ''''' IN pg_catalog.pg_get_functiondef(procedimento.oid)
        ) = 0
      )
  ) THEN
    RAISE EXCEPTION 'Funções de filiais precisam ser SECURITY DEFINER com search_path vazio.';
  END IF;

  IF pg_catalog.has_function_privilege('anon', v_salvar, 'EXECUTE')
     OR pg_catalog.has_function_privilege('anon', v_status, 'EXECUTE')
     OR pg_catalog.has_function_privilege('anon', v_obter_configuracao, 'EXECUTE')
     OR pg_catalog.has_function_privilege('anon', v_acesso_uuid, 'EXECUTE')
     OR pg_catalog.has_function_privilege('anon', v_acesso_texto, 'EXECUTE')
     OR pg_catalog.has_function_privilege('anon', v_acesso_operacional, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated', v_salvar, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated', v_status, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated', v_obter_configuracao, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated', v_acesso_uuid, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated', v_acesso_texto, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated', v_acesso_operacional, 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', v_modelos, 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', v_ciclo, 'EXECUTE') THEN
    RAISE EXCEPTION 'ACL das RPCs e funções internas de filiais está incorreta.';
  END IF;
  SELECT pg_catalog.pg_get_functiondef(v_salvar) INTO v_definition;
  IF position('current_empresa_id()' IN v_definition) = 0
     OR position('p_expected_updated_at' IN v_definition) = 0
     OR position('v_matriz.tipo = ''PF''' IN v_definition) = 0 OR position('char_length(v_matriz_cnpj_numeros) <> 14' IN v_definition) = 0
     OR position('FOR SHARE' IN v_definition) = 0
     OR position('FOR UPDATE' IN v_definition) = 0
     OR position('''{}''::text[]' IN v_definition) = 0
     OR position('configuracoes_protocolos_empresas' IN v_definition) > 0
     OR position('sincronizar_rotinas_protocolos_cliente' IN v_definition) > 0
     OR position('atividades_rotinas' IN v_definition) > 0
     OR position('913331' IN v_definition) = 0
     OR position('913332' IN v_definition) = 0
     OR position('913331' IN v_definition) > position('913332' IN v_definition) THEN
    RAISE EXCEPTION 'RPC de salvar filial perdeu lock/CAS ou passou a provisionar obrigações.';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(v_status) INTO v_definition;
  IF position('v_status = ''Ativa'' AND v_matriz.status <> ''Ativa''' IN v_definition) = 0
     OR position('p_expected_updated_at IS NULL' IN v_definition) = 0
     OR position('FOR SHARE' IN v_definition) = 0
     OR position('FOR UPDATE' IN v_definition) = 0
     OR position('913331' IN v_definition) = 0
     OR position('913332' IN v_definition) = 0
     OR position('913331' IN v_definition) > position('913332' IN v_definition) THEN
    RAISE EXCEPTION 'RPC de status da filial perdeu CAS, lock ou proteção da matriz ativa.';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(v_acesso_uuid) INTO v_definition;
  IF position('alvo.matriz_cliente_id IS NOT NULL' IN v_definition) = 0
     OR position('acesso.cliente_id = alvo.matriz_cliente_id' IN v_definition) = 0
     OR position('alvo.tipo_estabelecimento = ''Filial''' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Acesso cliente-escopado não deriva a filial exclusivamente da matriz.';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(v_acesso_operacional) INTO v_definition;
  IF position('current_user_can_access_client_row' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'A policy operacional não reutiliza a guarda de acesso cliente-escopado.';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(v_obter_configuracao) INTO v_definition;
  IF position('v_configs_salvas IS NULL' IN v_definition) = 0
     OR position(
       'normalizar_configs_protocolos_cliente(v_empresa_id, p_cliente_id, ''[]''::jsonb)'
       IN v_definition
     ) = 0
     OR position('mesclar_configs_obrigacoes_legadas' IN v_definition) > 0
     OR position('INSERT INTO public.configuracoes_protocolos_empresas' IN v_definition) > 0
     OR position('UPDATE public.configuracoes_protocolos_empresas' IN v_definition) > 0
     OR position('sincronizar_rotinas_protocolos_cliente' IN v_definition) > 0 THEN
    RAISE EXCEPTION 'Leitura de protocolos voltou a mesclar ou provisionar configuração implícita.';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(v_modelos) INTO v_definition;
  IF position('NEW.modelos_ativos := ''{}''::text[]' IN v_definition) = 0
     OR position('atividades_modelos' IN v_definition) > 0
     OR position('array_agg' IN lower(v_definition)) > 0 THEN
    RAISE EXCEPTION 'Novo parceiro não inicia mais com modelos vazios.';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(v_ciclo) INTO v_definition;
  v_insert_guard := position('IF TG_OP = ''INSERT''' IN v_definition);
  v_no_config_guard := position('IF NOT FOUND THEN RETURN NEW' IN v_definition);
  v_config_write := position('INSERT INTO public.configuracoes_protocolos_empresas' IN v_definition);
  IF v_insert_guard = 0 OR v_no_config_guard = 0 OR v_config_write = 0
     OR v_insert_guard > v_config_write
     OR v_no_config_guard > v_config_write
     OR position('mesclar_configs_obrigacoes_legadas' IN v_definition) > 0 THEN
    RAISE EXCEPTION 'Ciclo de obrigações pode criar configuração no insert ou sem configuração salva.';
  END IF;
END;
$test$;

ROLLBACK;
