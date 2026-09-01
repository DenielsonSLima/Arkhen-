-- Execute após 20260901190200_filiais_documentos_scope_cas.
-- Contrato somente de leitura: inspeciona catálogo, ACL e definições sem
-- depender de dados de uma empresa e sempre desfaz a transação.
BEGIN;
DO $test$
DECLARE
  v_acesso regprocedure := pg_catalog.to_regprocedure(
    'public.current_user_has_client_access(uuid,uuid)'
  );
  v_definition text;
BEGIN
  IF v_acesso IS NULL THEN
    RAISE EXCEPTION 'Helper de acesso direto matriz/filial está ausente.';
  END IF;
  SELECT pg_catalog.pg_get_functiondef(v_acesso) INTO v_definition;
  IF NOT (
    SELECT procedimento.prosecdef
    FROM pg_catalog.pg_proc procedimento
    WHERE procedimento.oid = v_acesso::oid
  ) OR position('set search_path to ''''' IN lower(v_definition)) = 0 THEN
    RAISE EXCEPTION 'Helper de acesso matriz/filial precisa ser SECURITY DEFINER com search_path vazio.';
  END IF;
  IF pg_catalog.has_function_privilege('anon', v_acesso, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated', v_acesso, 'EXECUTE') THEN
    RAISE EXCEPTION 'ACL do helper de acesso matriz/filial está incorreta.';
  END IF;
  -- O alvo é sempre o p_cliente_id. A ramificação derivada só encontra uma
  -- filial cujo matriz_cliente_id é o acesso concedido: matriz -> filial,
  -- nunca filial -> matriz ou irmã.
  IF position('auth.uid() is not null' IN lower(v_definition)) = 0
     OR position('acesso.auth_user_id = auth.uid()' IN lower(v_definition)) = 0
     OR position('acesso.empresa_id = p_empresa_id' IN lower(v_definition)) = 0
     OR position('acesso.status = ''ativo''' IN lower(v_definition)) = 0
     OR position('acesso.cliente_id = p_cliente_id' IN lower(v_definition)) = 0
     OR position('alvo.id = p_cliente_id' IN lower(v_definition)) = 0
     OR position('alvo.empresa_id = p_empresa_id' IN lower(v_definition)) = 0
     OR position('alvo.matriz_cliente_id = acesso.cliente_id' IN lower(v_definition)) = 0
     OR position('alvo.tipo_estabelecimento = ''filial''' IN lower(v_definition)) = 0 THEN
    RAISE EXCEPTION 'A expansão de acesso precisa ser exclusivamente matriz para filial.';
  END IF;
END;
$test$;
DO $test$
DECLARE
  v_helper regprocedure := pg_catalog.to_regprocedure(
    'public.documento_cliente_belongs_to_empresa(text,uuid)'
  );
  v_salvar regprocedure := pg_catalog.to_regprocedure(
    'public.salvar_configuracao_documental_cliente_v1(uuid,text[],text[],timestamp with time zone)'
  );
  v_definition text;
BEGIN
  IF v_helper IS NULL OR v_salvar IS NULL THEN
    RAISE EXCEPTION 'Helper operacional ou RPC documental CAS está ausente.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc procedimento
    WHERE procedimento.oid IN (v_helper::oid, v_salvar::oid)
      AND (
        NOT procedimento.prosecdef
        OR position(
          'set search_path to ''''' IN lower(
            pg_catalog.pg_get_functiondef(procedimento.oid)
          )
        ) = 0
      )
  ) THEN
    RAISE EXCEPTION 'Helper e RPC documental precisam ser SECURITY DEFINER com search_path vazio.';
  END IF;

  IF pg_catalog.has_function_privilege('anon', v_helper, 'EXECUTE')
     OR pg_catalog.has_function_privilege('anon', v_salvar, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated', v_helper, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated', v_salvar, 'EXECUTE') THEN
    RAISE EXCEPTION 'ACL do helper ou da RPC documental está incorreta.';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(v_helper) INTO v_definition;
  IF position('auth.uid() is not null' IN lower(v_definition)) = 0
     OR position('current_user_can_access_cliente_operacional' IN lower(v_definition)) = 0
     OR position('cliente.id::text' IN lower(v_definition)) = 0
     OR position('cliente.empresa_id = p_empresa_id' IN lower(v_definition)) = 0 THEN
    RAISE EXCEPTION 'Helper documental não valida o parceiro operacional no tenant.';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(v_salvar) INTO v_definition;
  IF position('current_empresa_id()' IN lower(v_definition)) = 0
     OR position('documentos:manage' IN lower(v_definition)) = 0
     OR position('current_user_can_access_cliente_operacional' IN lower(v_definition)) = 0
     OR position('p_expected_updated_at is null' IN lower(v_definition)) = 0
     OR position('40001' IN v_definition) = 0
     OR position('pg_advisory_xact_lock' IN lower(v_definition)) = 0
     OR position('913331' IN v_definition) = 0
     OR position('913334' IN v_definition) = 0
     OR position('913331' IN v_definition) > position('913334' IN v_definition)
     OR position('for update' IN lower(v_definition)) = 0
     OR position('expand_pastas_documentos_paths' IN lower(v_definition)) = 0
     OR position('cardinality(p_pastas)' IN lower(v_definition)) = 0
     OR position('cardinality(p_categorias)' IN lower(v_definition)) = 0
     OR position('regexp_replace' IN lower(v_definition)) = 0
     OR position('[[:cntrl:]]' IN lower(v_definition)) = 0
     OR position('insert into public.documentos_categorias' IN lower(v_definition)) = 0
     OR position('delete from public.documentos_categorias' IN lower(v_definition)) = 0
     OR position('update public.clientes' IN lower(v_definition)) = 0
     OR position('is distinct from p_expected_updated_at' IN lower(v_definition)) = 0
     OR position('on conflict do nothing' IN lower(v_definition)) = 0
     OR position('jsonb_build_object' IN lower(v_definition)) = 0
     OR position('global.empresa_id = v_empresa_id' IN lower(v_definition)) = 0
     OR position('global.cliente_id is null' IN lower(v_definition)) = 0
     OR position('lower(pg_catalog.btrim(global.nome)) = lower(item.categoria)' IN lower(v_definition)) = 0 THEN
    RAISE EXCEPTION 'RPC documental perdeu CAS, lock, validação ou sincronização atômica.';
  END IF;
END;
$test$;
DO $test$
DECLARE
  v_docs regclass := 'public.documentos'::regclass;
  v_categorias regclass := 'public.documentos_categorias'::regclass;
  v_storage regclass := 'storage.objects'::regclass;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (VALUES (v_docs), (v_categorias), (v_storage)) alvo(relid)
    LEFT JOIN pg_catalog.pg_class classe ON classe.oid = alvo.relid
    WHERE classe.oid IS NULL OR NOT classe.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Documentos, categorias e Storage precisam manter RLS habilitada.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy politica
    WHERE politica.polrelid = v_docs
      AND politica.polname = 'documentos_operacional_allow'
      AND politica.polcmd = '*' AND politica.polpermissive
      AND (pg_catalog.to_regrole('authenticated'))::oid = ANY (politica.polroles)
  ) THEN
    RAISE EXCEPTION 'A policy base de documentos para authenticated está ausente.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy politica
    WHERE politica.polrelid = v_docs
      AND politica.polname = 'documentos_operacional_select_guard'
      AND politica.polcmd = 'r' AND NOT politica.polpermissive
      AND (pg_catalog.to_regrole('authenticated'))::oid = ANY (politica.polroles)
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polqual, politica.polrelid
      ), '')) LIKE '%documento_cliente_belongs_to_empresa%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polqual, politica.polrelid
      ), '')) LIKE '%(scope)::text = ''empresa''::text%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polqual, politica.polrelid
      ), '')) LIKE '%(scope)::text = ''pessoal''::text%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polqual, politica.polrelid
      ), '')) LIKE '%owner_user_id = auth.uid()%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polqual, politica.polrelid
      ), '')) LIKE '%is_empresa_member%'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy politica
    WHERE politica.polrelid = v_docs
      AND politica.polname = 'documentos_operacional_insert_guard'
      AND politica.polcmd = 'a' AND NOT politica.polpermissive
      AND (pg_catalog.to_regrole('authenticated'))::oid = ANY (politica.polroles)
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polwithcheck, politica.polrelid
      ), '')) LIKE '%documento_cliente_belongs_to_empresa%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polwithcheck, politica.polrelid
      ), '')) LIKE '%documento_storage_cadastro_consistente%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polwithcheck, politica.polrelid
      ), '')) LIKE '%current_empresa_id%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polwithcheck, politica.polrelid
      ), '')) LIKE '%(scope)::text = ''pessoal''::text%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polwithcheck, politica.polrelid
      ), '')) LIKE '%owner_user_id = auth.uid()%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polwithcheck, politica.polrelid
      ), '')) LIKE '%is_empresa_member%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polwithcheck, politica.polrelid
      ), '')) LIKE '%documentos:create%'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy politica
    WHERE politica.polrelid = v_docs
      AND politica.polname = 'documentos_operacional_update_guard'
      AND politica.polcmd = 'w' AND NOT politica.polpermissive
      AND (pg_catalog.to_regrole('authenticated'))::oid = ANY (politica.polroles)
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polqual, politica.polrelid
      ), '')) LIKE '%documentos:manage%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polqual, politica.polrelid
      ), '')) LIKE '%(scope)::text = ''pessoal''::text%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polqual, politica.polrelid
      ), '')) LIKE '%is_empresa_member%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polwithcheck, politica.polrelid
      ), '')) LIKE '%documento_cliente_belongs_to_empresa%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polwithcheck, politica.polrelid
      ), '')) LIKE '%documentos:manage%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polqual, politica.polrelid
      ), '')) LIKE '%owner_user_id = auth.uid()%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polqual, politica.polrelid
      ), '')) LIKE '%documentos:create-own%'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy politica
    WHERE politica.polrelid = v_docs
      AND politica.polname = 'documentos_operacional_delete_guard'
      AND politica.polcmd = 'd' AND NOT politica.polpermissive
      AND (pg_catalog.to_regrole('authenticated'))::oid = ANY (politica.polroles)
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polqual, politica.polrelid
      ), '')) LIKE '%documentos:manage%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polqual, politica.polrelid
      ), '')) LIKE '%(scope)::text = ''pessoal''::text%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polqual, politica.polrelid
      ), '')) LIKE '%is_empresa_member%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polqual, politica.polrelid
      ), '')) LIKE '%documento_cliente_belongs_to_empresa%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polqual, politica.polrelid
      ), '')) LIKE '%owner_user_id = auth.uid()%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polqual, politica.polrelid
      ), '')) LIKE '%documentos:create-own%'
  ) THEN
    RAISE EXCEPTION 'Policies restritivas de documentos não mantêm RBAC e escopo operacional.';
  END IF;
END;
$test$;

DO $test$
DECLARE
  v_categorias regclass := 'public.documentos_categorias'::regclass;
  v_select_guard text;
  v_insert_guard text;
  v_update_guard text;
  v_delete_guard text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy politica
    WHERE politica.polrelid = v_categorias
      AND politica.polname = 'documentos_categorias_operacional_allow'
      AND politica.polcmd = '*' AND politica.polpermissive
      AND (pg_catalog.to_regrole('authenticated'))::oid = ANY (politica.polroles)
  ) THEN
    RAISE EXCEPTION 'A policy base de categorias para authenticated está ausente.';
  END IF;

  SELECT lower(coalesce(pg_catalog.pg_get_expr(
    politica.polqual, politica.polrelid
  ), ''))
  INTO v_select_guard
  FROM pg_catalog.pg_policy politica
  WHERE politica.polrelid = v_categorias
    AND politica.polname = 'documentos_categorias_select_guard'
    AND politica.polcmd = 'r' AND NOT politica.polpermissive
    AND (pg_catalog.to_regrole('authenticated'))::oid = ANY (politica.polroles);

  SELECT lower(coalesce(pg_catalog.pg_get_expr(
    politica.polwithcheck, politica.polrelid
  ), ''))
  INTO v_insert_guard
  FROM pg_catalog.pg_policy politica
  WHERE politica.polrelid = v_categorias
    AND politica.polname = 'documentos_categorias_insert_guard'
    AND politica.polcmd = 'a' AND NOT politica.polpermissive;

  SELECT lower(concat_ws(' ', pg_catalog.pg_get_expr(
    politica.polqual, politica.polrelid
  ), pg_catalog.pg_get_expr(politica.polwithcheck, politica.polrelid)))
  INTO v_update_guard
  FROM pg_catalog.pg_policy politica
  WHERE politica.polrelid = v_categorias
    AND politica.polname = 'documentos_categorias_update_guard'
    AND politica.polcmd = 'w' AND NOT politica.polpermissive;

  SELECT lower(coalesce(pg_catalog.pg_get_expr(
    politica.polqual, politica.polrelid
  ), ''))
  INTO v_delete_guard
  FROM pg_catalog.pg_policy politica
  WHERE politica.polrelid = v_categorias
    AND politica.polname = 'documentos_categorias_delete_guard'
    AND politica.polcmd = 'd' AND NOT politica.polpermissive;

  -- Categorias vinculadas a parceiro são alteradas exclusivamente pela RPC
  -- SECURITY DEFINER; REST direto só pode administrar categorias tenant-globais.
  IF v_select_guard IS NULL OR v_insert_guard IS NULL OR v_update_guard IS NULL OR v_delete_guard IS NULL
     OR v_select_guard NOT LIKE '%current_user_can_access_cliente_operacional%'
     OR v_select_guard NOT LIKE '%empresa_id is null%'
     OR v_select_guard NOT LIKE '%sistema = true%'
     OR v_insert_guard NOT LIKE '%documentos:manage%'
     OR v_update_guard NOT LIKE '%documentos:manage%'
     OR v_delete_guard NOT LIKE '%documentos:manage%'
     OR v_insert_guard NOT LIKE '%cliente_id is null%'
     OR v_update_guard NOT LIKE '%cliente_id is null%'
     OR v_delete_guard NOT LIKE '%cliente_id is null%'
     OR v_insert_guard NOT LIKE '%sistema = false%'
     OR v_update_guard NOT LIKE '%sistema = false%'
     OR v_delete_guard NOT LIKE '%sistema = false%'
     OR v_insert_guard NOT LIKE '%current_user_is_client_scoped%'
     OR v_update_guard NOT LIKE '%current_user_is_client_scoped%'
     OR v_delete_guard NOT LIKE '%current_user_is_client_scoped%'
     OR v_insert_guard LIKE '%cliente_id is not null%'
     OR v_update_guard LIKE '%cliente_id is not null%'
     OR v_delete_guard LIKE '%cliente_id is not null%'
     OR EXISTS (
       SELECT 1
       FROM pg_catalog.pg_policy politica
       WHERE politica.polrelid = v_categorias
         AND politica.polname IN (
           'documentos_categorias_insert_guard',
           'documentos_categorias_update_guard',
           'documentos_categorias_delete_guard'
         )
         AND NOT ((pg_catalog.to_regrole('authenticated'))::oid = ANY (politica.polroles))
     ) THEN
    RAISE EXCEPTION 'DML direto ainda pode alterar categorias vinculadas a parceiro.';
  END IF;
END;
$test$;

DO $test$
DECLARE
  v_storage regclass := 'storage.objects'::regclass;
  v_insert_guard text;
  v_select_guard text;
  v_update_guard text;
  v_delete_guard text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy politica
    WHERE politica.polrelid = v_storage
      AND politica.polname = 'documentos_storage_operacional_allow'
      AND politica.polcmd = '*' AND politica.polpermissive
      AND (pg_catalog.to_regrole('authenticated'))::oid = ANY (politica.polroles)
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polqual, politica.polrelid
      ), '')) LIKE '%bucket_id = ''documentos''::text%'
      AND lower(coalesce(pg_catalog.pg_get_expr(
        politica.polwithcheck, politica.polrelid
      ), '')) LIKE '%bucket_id = ''documentos''::text%'
  ) THEN
    RAISE EXCEPTION 'A policy base de Storage para authenticated está ausente.';
  END IF;

  SELECT lower(coalesce(pg_catalog.pg_get_expr(
    politica.polwithcheck, politica.polrelid
  ), ''))
  INTO v_insert_guard
  FROM pg_catalog.pg_policy politica
  WHERE politica.polrelid = v_storage
    AND politica.polname = 'documentos_storage_insert_guard'
    AND politica.polcmd = 'a' AND NOT politica.polpermissive;

  SELECT lower(coalesce(pg_catalog.pg_get_expr(
    politica.polqual, politica.polrelid
  ), ''))
  INTO v_select_guard
  FROM pg_catalog.pg_policy politica
  WHERE politica.polrelid = v_storage
    AND politica.polname = 'documentos_storage_select_guard'
    AND politica.polcmd = 'r' AND NOT politica.polpermissive;

  SELECT lower(concat_ws(' ', pg_catalog.pg_get_expr(
    politica.polqual, politica.polrelid
  ), pg_catalog.pg_get_expr(politica.polwithcheck, politica.polrelid)))
  INTO v_update_guard
  FROM pg_catalog.pg_policy politica
  WHERE politica.polrelid = v_storage
    AND politica.polname = 'documentos_storage_update_guard'
    AND politica.polcmd = 'w' AND NOT politica.polpermissive;

  SELECT lower(coalesce(pg_catalog.pg_get_expr(
    politica.polqual, politica.polrelid
  ), ''))
  INTO v_delete_guard
  FROM pg_catalog.pg_policy politica
  WHERE politica.polrelid = v_storage
    AND politica.polname = 'documentos_storage_delete_guard'
    AND politica.polcmd = 'd' AND NOT politica.polpermissive;

  IF v_insert_guard IS NULL OR v_select_guard IS NULL OR v_update_guard IS NULL
     OR v_insert_guard NOT LIKE '%bucket_id = ''documentos''::text%'
     OR v_insert_guard NOT LIKE '%owner = auth.uid%'
     OR v_insert_guard NOT LIKE '%storage.foldername%'
     OR v_insert_guard NOT LIKE '%current_empresa_id%'
     OR v_insert_guard NOT LIKE '%documento_cliente_belongs_to_empresa%'
     OR v_insert_guard NOT LIKE '%''pessoal''%'
     OR v_insert_guard NOT LIKE '%''clientes''%'
     OR v_insert_guard NOT LIKE '%[3] = (auth.uid())::text%'
     OR v_insert_guard NOT LIKE '%documentos:create%'
     OR v_select_guard NOT LIKE '%owner = auth.uid%'
     OR v_select_guard NOT LIKE '%current_empresa_id%'
     OR v_select_guard NOT LIKE '%documento_cliente_belongs_to_empresa%'
     OR v_select_guard NOT LIKE '%''pessoal''%'
     OR v_select_guard NOT LIKE '%documentos_compartilhamentos%'
     OR v_select_guard NOT LIKE '%expires_at > now()%'
     OR v_update_guard NOT LIKE '%owner = auth.uid%'
     OR v_update_guard NOT LIKE '%current_empresa_id%'
     OR v_update_guard NOT LIKE '%documentos:manage%'
     OR v_update_guard NOT LIKE '%documento.owner_user_id = auth.uid()%'
     OR v_update_guard NOT LIKE '%documentos:create-own%'
     OR v_update_guard NOT LIKE '%documento_cliente_belongs_to_empresa%' THEN
    RAISE EXCEPTION 'INSERT no Storage não valida dono, tenant, parceiro e permissão.';
  END IF;

  -- O upload é anterior ao INSERT em public.documentos. Em caso de erro de
  -- metadados, o mesmo dono deve remover o objeto de parceiro ainda órfão,
  -- mediante escopo operacional e prova de que não há metadado vinculado,
  -- sem depender da linha que ainda não chegou a existir.
  IF v_delete_guard IS NULL
     OR v_delete_guard NOT LIKE '%owner = auth.uid%'
     OR v_delete_guard NOT LIKE '%storage.foldername%'
     OR v_delete_guard NOT LIKE '%current_empresa_id%'
     OR v_delete_guard NOT LIKE '%documento_cliente_belongs_to_empresa%'
     OR v_delete_guard NOT LIKE '%''clientes''%'
     OR v_delete_guard NOT LIKE '%documento.owner_user_id = auth.uid()%'
     OR v_delete_guard NOT LIKE '%documentos:create-own%'
     OR v_delete_guard NOT LIKE '%documento_storage_objeto_orfao%' THEN
    RAISE EXCEPTION 'DELETE no Storage não preserva limpeza segura de objeto órfão.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('documentos_storage_select_guard', 'r'),
      ('documentos_storage_insert_guard', 'a'),
      ('documentos_storage_update_guard', 'w'),
      ('documentos_storage_delete_guard', 'd')
    ) esperado(nome, comando)
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_policy politica
      WHERE politica.polrelid = v_storage
        AND politica.polname = esperado.nome
        AND politica.polcmd = esperado.comando::"char"
        AND NOT politica.polpermissive
        AND (pg_catalog.to_regrole('authenticated'))::oid = ANY (politica.polroles)
    )
  ) THEN
    RAISE EXCEPTION 'Storage não mantém guards RESTRICTIVE para todas as operações.';
  END IF;
END;
$test$;

ROLLBACK;
