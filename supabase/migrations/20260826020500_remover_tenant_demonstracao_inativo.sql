-- Remove exclusivamente o tenant legado de demonstracao. A limpeza nao usa
-- efeitos referenciais para descobrir o que apagar: ela bloqueia as tabelas,
-- inventaria toda coluna empresa_id e toda FK direta para empresas, exige que
-- somente o scaffold conhecido exista, apaga-o explicitamente e confere a
-- pos-condicao antes de remover a empresa.
DO $$
DECLARE
  v_empresa public.empresas%rowtype;
  v_perfil public.perfis%rowtype;
  v_usuario public.configuracoes_usuarios%rowtype;
  v_config_empresa public.configuracoes_empresa%rowtype;
  v_empresa_id uuid;
  v_user_id uuid;
  v_auth_email text;
  v_deleted_id uuid;
  v_quantidade integer;
  v_marca_dagua_quantidade integer;
  v_row_count integer;
  v_exists boolean;
  v_canonical boolean;
  v_keys text[];
  v_relation record;
  v_reference record;
  v_label text;
  v_blockers text[] := ARRAY[]::text[];
BEGIN
  SELECT count(*)
  INTO v_quantidade
  FROM public.empresas
  WHERE nome = 'Empresa Fictícia Contábil'
    AND cnpj = '12.345.678/0001-90'
    AND status = 'inativo';

  IF v_quantidade = 0 THEN
    RETURN;
  END IF;

  IF v_quantidade IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION
      'Limpeza abortada: foram encontrados % tenants com o marcador de demonstracao.',
      v_quantidade;
  END IF;

  LOCK TABLE public.empresas IN SHARE ROW EXCLUSIVE MODE NOWAIT;

  SELECT *
  INTO STRICT v_empresa
  FROM public.empresas
  WHERE nome = 'Empresa Fictícia Contábil'
    AND cnpj = '12.345.678/0001-90'
    AND status = 'inativo'
  FOR UPDATE;

  v_empresa_id := v_empresa.id;

  IF v_empresa.razao_social IS DISTINCT FROM 'Empresa Fictícia Contábil'
     OR v_empresa.parent_empresa_id IS NOT NULL THEN
    RAISE EXCEPTION
      'Limpeza abortada: a identidade ou hierarquia do tenant de demonstracao divergiu.';
  END IF;

  -- Bloqueia toda tabela tenant-aware antes do preflight. NOWAIT faz a
  -- migration abortar, em vez de concorrer com uma escrita em andamento.
  FOR v_relation IN
    SELECT DISTINCT relation_schema, relation_name
    FROM (
      SELECT namespace.nspname AS relation_schema, relation.relname AS relation_name
      FROM pg_attribute attribute
      JOIN pg_class relation ON relation.oid = attribute.attrelid
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND relation.relkind IN ('r', 'p')
        AND relation.relname <> 'empresas'
        AND attribute.attname = 'empresa_id'
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped

      UNION ALL

      SELECT namespace.nspname, relation.relname
      FROM pg_constraint reference_constraint
      JOIN pg_class relation ON relation.oid = reference_constraint.conrelid
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE reference_constraint.contype = 'f'
        AND reference_constraint.confrelid = 'public.empresas'::regclass
        AND relation.oid <> 'public.empresas'::regclass
        AND relation.relkind IN ('r', 'p')
    ) relations
    ORDER BY relation_schema, relation_name
  LOOP
    EXECUTE format(
      'LOCK TABLE %I.%I IN SHARE ROW EXCLUSIVE MODE NOWAIT',
      v_relation.relation_schema,
      v_relation.relation_name
    );
  END LOOP;

  IF to_regclass('storage.objects') IS NOT NULL THEN
    EXECUTE 'LOCK TABLE storage.objects IN SHARE ROW EXCLUSIVE MODE NOWAIT';
  END IF;
  IF to_regclass('vault.secrets') IS NOT NULL THEN
    EXECUTE 'LOCK TABLE vault.secrets IN SHARE ROW EXCLUSIVE MODE NOWAIT';
  END IF;

  SELECT count(*)
  INTO v_quantidade
  FROM public.perfis
  WHERE empresa_id = v_empresa_id;

  IF v_quantidade IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION
      'Limpeza abortada: o tenant de demonstracao possui % perfis; esperado 1.',
      v_quantidade;
  END IF;

  SELECT *
  INTO STRICT v_perfil
  FROM public.perfis
  WHERE empresa_id = v_empresa_id;

  IF v_perfil.nome IS DISTINCT FROM 'João Silva Demonstração'
     OR v_perfil.papel IS DISTINCT FROM 'admin'
     OR v_perfil.ativo IS DISTINCT FROM false THEN
    RAISE EXCEPTION
      'Limpeza abortada: o marcador completo do perfil de demonstracao nao confere.';
  END IF;

  v_user_id := v_perfil.user_id;

  SELECT email
  INTO STRICT v_auth_email
  FROM auth.users
  WHERE id = v_user_id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.perfis perfil_ativo
    JOIN public.empresas empresa_ativa ON empresa_ativa.id = perfil_ativo.empresa_id
    WHERE perfil_ativo.user_id = v_user_id
      AND perfil_ativo.empresa_id <> v_empresa_id
      AND perfil_ativo.ativo = true
      AND empresa_ativa.status = 'ativo'
  ) THEN
    RAISE EXCEPTION
      'Limpeza abortada: o usuario nao possui outro vinculo empresarial ativo.';
  END IF;

  SELECT count(*)
  INTO v_quantidade
  FROM public.configuracoes_usuarios
  WHERE empresa_id = v_empresa_id;

  IF v_quantidade IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION
      'Limpeza abortada: o tenant de demonstracao possui % usuarios configurados; esperado 1.',
      v_quantidade;
  END IF;

  SELECT *
  INTO STRICT v_usuario
  FROM public.configuracoes_usuarios
  WHERE empresa_id = v_empresa_id;

  IF v_usuario.nome IS DISTINCT FROM 'João Silva Demonstração'
     OR v_usuario.perfil_id IS DISTINCT FROM v_perfil.id
     OR (v_usuario.auth_user_id IS NOT NULL AND v_usuario.auth_user_id IS DISTINCT FROM v_user_id)
     OR lower(v_usuario.email) IS DISTINCT FROM lower(v_auth_email)
     OR v_usuario.status IS DISTINCT FROM 'Inativo' THEN
    RAISE EXCEPTION
      'Limpeza abortada: o usuario configurado nao corresponde ao perfil inativo de demonstracao.';
  END IF;

  SELECT count(*)
  INTO v_quantidade
  FROM public.configuracoes_empresa
  WHERE empresa_id = v_empresa_id;

  IF v_quantidade IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION
      'Limpeza abortada: a configuracao-base do tenant de demonstracao nao e unica.';
  END IF;

  SELECT *
  INTO STRICT v_config_empresa
  FROM public.configuracoes_empresa
  WHERE empresa_id = v_empresa_id;

  IF v_config_empresa.razao_social IS DISTINCT FROM 'Empresa Fictícia Contábil'
     OR v_config_empresa.nome_fantasia IS DISTINCT FROM 'Empresa Fictícia Contábil'
     OR v_config_empresa.cnpj IS DISTINCT FROM '12.345.678/0001-90'
     OR lower(v_config_empresa.email) IS DISTINCT FROM lower(v_auth_email)
     OR v_config_empresa.telefone IS DISTINCT FROM '(79) 99999-0000'
     OR v_config_empresa.cep IS DISTINCT FROM '49000-000'
     OR v_config_empresa.endereco IS DISTINCT FROM 'Rua Fictícia da Contabilidade'
     OR v_config_empresa.numero IS DISTINCT FROM '100'
     OR v_config_empresa.cidade IS DISTINCT FROM 'Aracaju'
     OR v_config_empresa.estado IS DISTINCT FROM 'SE'
     OR nullif(btrim(v_config_empresa.logo_url), '') IS NOT NULL THEN
    RAISE EXCEPTION
      'Limpeza abortada: a configuracao-base deixou de ser o scaffold de demonstracao.';
  END IF;

  SELECT count(*)
  INTO v_marca_dagua_quantidade
  FROM public.configuracoes_marca_dagua
  WHERE empresa_id = v_empresa_id;

  IF v_marca_dagua_quantidade > 1 OR EXISTS (
    SELECT 1
    FROM public.configuracoes_marca_dagua marca
    WHERE marca.empresa_id = v_empresa_id
      AND (
        nullif(btrim(marca.file_url), '') IS NOT NULL
        OR nullif(btrim(marca.file_url_paisagem), '') IS NOT NULL
        OR nullif(btrim(marca.file_url_retrato), '') IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION
      'Limpeza abortada: a marca d''agua possui arquivo ou configuracao inesperada.';
  END IF;

  PERFORM public.validar_scaffolds_tenant_demonstracao(
    v_empresa_id,
    v_user_id,
    v_usuario.id
  );
  IF to_regclass('storage.objects') IS NOT NULL THEN
    EXECUTE
      'SELECT EXISTS (
         SELECT 1 FROM storage.objects
         WHERE left(name, length($1::text) + 1) = $1::text || ''/''
       )'
    INTO v_exists
    USING v_empresa_id;
    IF v_exists THEN
      RAISE EXCEPTION
        'Limpeza abortada: existem objetos no Storage vinculados ao tenant de demonstracao.';
    END IF;
  END IF;

  IF to_regclass('vault.secrets') IS NOT NULL THEN
    EXECUTE
      'SELECT EXISTS (
         SELECT 1 FROM vault.secrets
         WHERE left(name, length($1)) = $1
       )'
    INTO v_exists
    USING 'empresa_' || v_empresa_id::text || '_';
    IF v_exists THEN
      RAISE EXCEPTION
        'Limpeza abortada: existem segredos no Vault vinculados ao tenant de demonstracao.';
    END IF;
  END IF;

  -- Qualquer referencia fora dos scaffolds validados impede a limpeza.
  v_blockers := public.listar_referencias_tenant_demonstracao(
    v_empresa_id,
    ARRAY[
      'agenda_responsaveis',
      'atividades_modelos',
      'perfis',
      'configuracoes_usuarios',
      'configuracoes_empresa',
      'configuracoes_marca_dagua',
      'configuracoes_perfis_acesso',
      'parametrizacao_catalogos',
      'parametrizacao_cnaes',
      'parametrizacao_documentos_funcionarios',
      'parametrizacao_parametros_calculo',
      'parametrizacao_prazos_entrega',
      'parametrizacao_protocolos_tipos',
      'parametrizacao_regimes_tributarios',
      'parametrizacao_regras_cnab',
      'parametrizacao_regras_imposto'
    ]::text[]
  );
  IF cardinality(v_blockers) > 0 THEN
    RAISE EXCEPTION
      'Limpeza abortada: o tenant possui referencias fora do scaffold permitido: %',
      array_to_string(v_blockers, ', ');
  END IF;

  -- Apaga os scaffolds validados em ordem explicita. As tabelas opcionais do
  -- bootstrap remoto podem estar ausentes ou vazias em históricos locais.
  IF to_regclass('public.agenda_responsaveis') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.agenda_responsaveis WHERE empresa_id = $1'
      USING v_empresa_id;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count NOT IN (0, 1) THEN
      RAISE EXCEPTION 'Limpeza abortada: quantidade inesperada de responsaveis removidos.';
    END IF;
  END IF;

  IF to_regclass('public.parametrizacao_regras_cnab') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.parametrizacao_regras_cnab WHERE empresa_id = $1'
      USING v_empresa_id;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count NOT IN (0, 3) THEN
      RAISE EXCEPTION 'Limpeza abortada: quantidade inesperada de regras CNAB removidas.';
    END IF;
  END IF;

  IF to_regclass('public.parametrizacao_regras_imposto') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.parametrizacao_regras_imposto WHERE empresa_id = $1'
      USING v_empresa_id;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count NOT IN (0, 3) THEN
      RAISE EXCEPTION 'Limpeza abortada: quantidade inesperada de regras tributarias removidas.';
    END IF;
  END IF;

  IF to_regclass('public.parametrizacao_catalogos') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.parametrizacao_catalogos WHERE empresa_id = $1'
      USING v_empresa_id;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count NOT IN (0, 25) THEN
      RAISE EXCEPTION 'Limpeza abortada: quantidade inesperada de catalogos removidos.';
    END IF;
  END IF;

  IF to_regclass('public.parametrizacao_documentos_funcionarios') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.parametrizacao_documentos_funcionarios WHERE empresa_id = $1'
      USING v_empresa_id;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count NOT IN (0, 7) THEN
      RAISE EXCEPTION 'Limpeza abortada: quantidade inesperada de documentos funcionais removidos.';
    END IF;
  END IF;

  IF to_regclass('public.parametrizacao_parametros_calculo') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.parametrizacao_parametros_calculo WHERE empresa_id = $1'
      USING v_empresa_id;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count NOT IN (0, 1) THEN
      RAISE EXCEPTION 'Limpeza abortada: quantidade inesperada de parametros de calculo removidos.';
    END IF;
  END IF;

  IF to_regclass('public.parametrizacao_prazos_entrega') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.parametrizacao_prazos_entrega WHERE empresa_id = $1'
      USING v_empresa_id;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count NOT IN (0, 16) THEN
      RAISE EXCEPTION 'Limpeza abortada: quantidade inesperada de prazos removidos.';
    END IF;
  END IF;

  IF to_regclass('public.parametrizacao_protocolos_tipos') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.parametrizacao_protocolos_tipos WHERE empresa_id = $1'
      USING v_empresa_id;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count NOT IN (0, 10) THEN
      RAISE EXCEPTION 'Limpeza abortada: quantidade inesperada de tipos de protocolo removidos.';
    END IF;
  END IF;

  IF to_regclass('public.parametrizacao_regimes_tributarios') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.parametrizacao_regimes_tributarios WHERE empresa_id = $1'
      USING v_empresa_id;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count NOT IN (0, 6) THEN
      RAISE EXCEPTION 'Limpeza abortada: quantidade inesperada de regimes removidos.';
    END IF;
  END IF;

  DELETE FROM public.parametrizacao_cnaes WHERE empresa_id = v_empresa_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count IS DISTINCT FROM 20 THEN
    RAISE EXCEPTION 'Limpeza abortada: quantidade inesperada de CNAEs removidos.';
  END IF;

  DELETE FROM public.atividades_modelos WHERE empresa_id = v_empresa_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count IS DISTINCT FROM 6 THEN
    RAISE EXCEPTION 'Limpeza abortada: quantidade inesperada de modelos removidos.';
  END IF;

  DELETE FROM public.configuracoes_perfis_acesso WHERE empresa_id = v_empresa_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'Limpeza abortada: quantidade inesperada de perfis de acesso removidos.';
  END IF;

  DELETE FROM public.configuracoes_usuarios WHERE empresa_id = v_empresa_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Limpeza abortada: quantidade inesperada de usuarios removidos.';
  END IF;

  DELETE FROM public.configuracoes_marca_dagua WHERE empresa_id = v_empresa_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count IS DISTINCT FROM v_marca_dagua_quantidade THEN
    RAISE EXCEPTION 'Limpeza abortada: quantidade inesperada de marcas d''agua removidas.';
  END IF;

  DELETE FROM public.configuracoes_empresa WHERE empresa_id = v_empresa_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Limpeza abortada: quantidade inesperada de configuracoes removidas.';
  END IF;

  DELETE FROM public.perfis WHERE empresa_id = v_empresa_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Limpeza abortada: quantidade inesperada de perfis removidos.';
  END IF;

  -- Pos-condicao: nenhuma linha tenant-aware nem FK direta pode permanecer.
  v_blockers := public.listar_referencias_tenant_demonstracao(
    v_empresa_id,
    ARRAY[]::text[]
  );
  IF cardinality(v_blockers) > 0 THEN
    RAISE EXCEPTION
      'Limpeza abortada: referencias permaneceram apos a exclusao explicita: %',
      array_to_string(v_blockers, ', ');
  END IF;

  DELETE FROM public.empresas
  WHERE id = v_empresa_id
  RETURNING id INTO v_deleted_id;

  IF v_deleted_id IS DISTINCT FROM v_empresa_id THEN
    RAISE EXCEPTION 'Limpeza abortada: a empresa de demonstracao nao foi removida.';
  END IF;
END;
$$;

DROP FUNCTION public.validar_scaffolds_tenant_demonstracao(uuid, uuid, uuid);
DROP FUNCTION public.listar_referencias_tenant_demonstracao(uuid, text[]);
