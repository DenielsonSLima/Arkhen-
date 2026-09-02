-- Execute após as migrations 20260902024551, 20260902024552 e 20260902024553.
-- Teste somente leitura: valida os catálogos de todos os tenants e os vínculos
-- históricos sem criar, editar ou excluir dados.

BEGIN;
SET TRANSACTION READ ONLY;

DO $test$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.empresas empresa
    CROSS JOIN (VALUES
      ('pessoa_fisica', 'Pessoa Física'),
      ('mei', 'MEI'),
      ('microempresa', 'ME'),
      ('epp', 'EPP'),
      ('demais', 'Demais')
    ) AS esperado(codigo, nome)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.parametrizacao_catalogos catalogo
      WHERE catalogo.empresa_id = empresa.id
        AND catalogo.tipo = 'tipos_empresa'
        AND catalogo.codigo = esperado.codigo
        AND catalogo.nome = esperado.nome
        AND catalogo.ativo = true
    )
  ) THEN
    RAISE EXCEPTION 'Porte/enquadramento canônico ausente ou inativo.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.empresas empresa
    CROSS JOIN (VALUES
      ('isenta_imune', 'Isenta / Imune'),
      ('holding_patrimonial', 'Holding / Patrimonial')
    ) AS esperado(codigo, nome)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.parametrizacao_catalogos catalogo
      WHERE catalogo.empresa_id = empresa.id
        AND catalogo.tipo = 'tipos_empresa'
        AND catalogo.codigo = esperado.codigo
        AND catalogo.nome = esperado.nome
        AND catalogo.ativo = false
        AND catalogo.sistema = true
    )
  ) THEN
    RAISE EXCEPTION 'Classificação fiscal/societária legada não foi arquivada.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.empresas empresa
    CROSS JOIN (VALUES
      ('empresario_individual', 'Empresário Individual (EI)'),
      ('sociedade_limitada', 'Sociedade Limitada (LTDA)'),
      ('sociedade_limitada_unipessoal', 'Sociedade Limitada Unipessoal (SLU)'),
      ('associacao_privada', 'Associação'),
      ('sociedade_anonima', 'Sociedade Anônima (S.A.)'),
      ('cooperativa', 'Cooperativa'),
      ('fundacao_privada', 'Fundação'),
      ('sociedade_simples', 'Sociedade Simples'),
      ('organizacao_religiosa', 'Organização Religiosa')
    ) AS esperado(codigo, nome)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.parametrizacao_catalogos catalogo
      WHERE catalogo.empresa_id = empresa.id
        AND catalogo.tipo = 'naturezas_juridicas'
        AND catalogo.codigo = esperado.codigo
        AND catalogo.nome = esperado.nome
        AND catalogo.ativo = true
    )
  ) THEN
    RAISE EXCEPTION 'Natureza jurídica canônica ausente ou inativa.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.empresas empresa
    CROSS JOIN (VALUES
      ('Clínica'), ('Comércio'), ('Restaurante'), ('Transportadora'), ('Escola'),
      ('Prestador de Serviços'), ('Indústria'), ('Agronegócio'), ('Outro')
    ) AS esperado(nome)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.parametrizacao_catalogos catalogo
      WHERE catalogo.empresa_id = empresa.id
        AND catalogo.tipo = 'categorias_clientes'
        AND catalogo.ativo = true
        AND lower(regexp_replace(btrim(catalogo.nome), '[[:space:]]+', ' ', 'g'))
          = lower(regexp_replace(btrim(esperado.nome), '[[:space:]]+', ' ', 'g'))
    )
  ) THEN
    RAISE EXCEPTION 'Categoria de atividade canônica ausente ou inativa.';
  END IF;
END;
$test$;

DO $test$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.parametrizacao_catalogos catalogo
    WHERE catalogo.tipo = 'tipos_empresa'
      AND catalogo.codigo IN (
        'isenta_imune', 'holding_patrimonial',
        'te-1', 'te-2', 'te-3', 'te-4', 'te-5', 'te-6'
      )
      AND catalogo.ativo = true
  ) THEN
    RAISE EXCEPTION 'Tipo legado que não representa porte continua ativo.';
  END IF;

  IF EXISTS (
    WITH aliases(tipo, codigo_alias, nome_canonico) AS (
      VALUES
        ('tipos_empresa', 'te-1', 'Pessoa Física'),
        ('tipos_empresa', 'te-2', 'MEI'),
        ('tipos_empresa', 'te-3', 'ME'),
        ('tipos_empresa', 'te-4', 'EPP'),
        ('tipos_empresa', 'te-5', 'Isenta / Imune'),
        ('tipos_empresa', 'te-6', 'Holding / Patrimonial'),
        ('naturezas_juridicas', 'nj-1', 'Empresário Individual (EI)'),
        ('naturezas_juridicas', 'nj-2', 'Sociedade Limitada (LTDA)'),
        ('naturezas_juridicas', 'nj-3',
          'Sociedade Limitada Unipessoal (SLU)'),
        ('naturezas_juridicas', 'nj-4', 'Associação')
    )
    SELECT 1
    FROM public.parametrizacao_catalogos catalogo
    JOIN aliases alias
      ON alias.tipo = catalogo.tipo
     AND alias.codigo_alias = catalogo.codigo
    WHERE catalogo.ativo = true
       OR catalogo.sistema = false
       OR catalogo.nome IS DISTINCT FROM
          alias.nome_canonico || ' [legado ' || alias.codigo_alias || ']'
  ) THEN
    RAISE EXCEPTION 'Alias legado não foi arquivado de forma auditável.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.clientes cliente
    JOIN public.parametrizacao_catalogos catalogo
      ON catalogo.empresa_id = cliente.empresa_id
    WHERE (catalogo.tipo = 'tipos_empresa'
        AND catalogo.codigo IN ('te-1', 'te-2', 'te-3', 'te-4', 'te-5', 'te-6')
        AND cliente.tipo_empresa_id = catalogo.id)
       OR (catalogo.tipo = 'naturezas_juridicas'
        AND catalogo.codigo IN ('nj-1', 'nj-2', 'nj-3', 'nj-4')
        AND cliente.natureza_juridica_id = catalogo.id)
  ) THEN
    RAISE EXCEPTION 'Cliente ainda referencia alias te-* ou nj-*.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.parametrizacao_catalogos catalogo
    WHERE catalogo.tipo = 'categorias_clientes'
      AND catalogo.codigo IN (
        'cliente_contabil',
        'cliente-contabil',
        'pessoa_fisica',
        'pessoa-fisica',
        'entidade_isenta',
        'entidade-isenta',
        'holding_patrimonial',
        'holding-patrimonial'
      )
      AND catalogo.ativo = true
  ) THEN
    RAISE EXCEPTION 'Categoria não setorial legada continua ativa.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.parametrizacao_catalogos catalogo
    WHERE catalogo.tipo IN ('tipos_empresa', 'naturezas_juridicas')
    GROUP BY
      catalogo.empresa_id,
      catalogo.tipo,
      lower(regexp_replace(btrim(catalogo.nome), '[[:space:]]+', ' ', 'g'))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Nome normalizado duplicado nas classificações.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.clientes cliente
    LEFT JOIN public.parametrizacao_catalogos catalogo
      ON catalogo.id = cliente.tipo_empresa_id
    WHERE cliente.tipo_empresa_id IS NOT NULL
      AND (
        catalogo.id IS NULL
        OR catalogo.empresa_id IS DISTINCT FROM cliente.empresa_id
        OR catalogo.tipo IS DISTINCT FROM 'tipos_empresa'
      )
  ) THEN
    RAISE EXCEPTION 'Vínculo de enquadramento cruzou empresa ou catálogo.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.clientes cliente
    LEFT JOIN public.parametrizacao_catalogos catalogo
      ON catalogo.id = cliente.natureza_juridica_id
    WHERE cliente.natureza_juridica_id IS NOT NULL
      AND (
        catalogo.id IS NULL
        OR catalogo.empresa_id IS DISTINCT FROM cliente.empresa_id
        OR catalogo.tipo IS DISTINCT FROM 'naturezas_juridicas'
      )
  ) THEN
    RAISE EXCEPTION 'Vínculo de natureza jurídica cruzou empresa ou catálogo.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.clientes cliente
    LEFT JOIN public.parametrizacao_catalogos catalogo
      ON catalogo.id = cliente.tipo_empresa_id
     AND catalogo.empresa_id = cliente.empresa_id
     AND catalogo.tipo = 'tipos_empresa'
    WHERE cliente.tipo IN ('PF', 'MEI')
      AND catalogo.codigo IS DISTINCT FROM CASE cliente.tipo
        WHEN 'PF' THEN 'pessoa_fisica'
        WHEN 'MEI' THEN 'mei'
      END
  ) THEN
    RAISE EXCEPTION 'Backfill inequívoco de PF/MEI está incompleto.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.clientes cliente
    JOIN public.parametrizacao_catalogos catalogo
      ON catalogo.id = cliente.tipo_empresa_id
     AND catalogo.empresa_id = cliente.empresa_id
     AND catalogo.tipo = 'tipos_empresa'
     AND catalogo.codigo = 'mei'
    WHERE cliente.tipo IS DISTINCT FROM 'MEI'
  ) THEN
    RAISE EXCEPTION 'Discriminador operacional de MEI não foi preservado.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.clientes cliente
    JOIN public.parametrizacao_catalogos catalogo
      ON catalogo.id = cliente.tipo_empresa_id
     AND catalogo.empresa_id = cliente.empresa_id
     AND catalogo.tipo = 'tipos_empresa'
     AND catalogo.codigo = 'pessoa_fisica'
    WHERE cliente.tipo IS DISTINCT FROM 'PF'
  ) THEN
    RAISE EXCEPTION 'Enquadramento Pessoa Física foi associado a CNPJ.';
  END IF;
END;
$test$;

DO $test$
DECLARE
  v_indice regclass := pg_catalog.to_regclass(
    'public.parametrizacao_catalogos_classificacoes_nome_norm_unq'
  );
  v_funcao regprocedure := pg_catalog.to_regprocedure(
    'app_private.validar_enquadramento_cliente_trigger()'
  );
  v_definicao text;
BEGIN
  IF v_indice IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index indice
    WHERE indice.indexrelid = v_indice
      AND indice.indisunique
      AND indice.indisvalid
      AND indice.indpred IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Índice único das classificações está ausente ou inválido.';
  END IF;

  SELECT pg_catalog.pg_get_indexdef(v_indice) INTO v_definicao;
  IF position('empresa_id, tipo' IN v_definicao) = 0
     OR position('lower(regexp_replace(btrim(' IN lower(v_definicao)) = 0
     OR position('tipos_empresa' IN v_definicao) = 0
     OR position('naturezas_juridicas' IN v_definicao) = 0 THEN
    RAISE EXCEPTION 'Índice único perdeu chave, normalização ou catálogos.';
  END IF;

  IF v_funcao IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger gatilho
    WHERE gatilho.tgrelid = 'public.clientes'::regclass
      AND gatilho.tgname = 'validar_enquadramento_cliente'
      AND NOT gatilho.tgisinternal
      AND gatilho.tgenabled <> 'D'
      AND gatilho.tgfoid = v_funcao
      AND (gatilho.tgtype::integer & 1) = 1
      AND (gatilho.tgtype::integer & 2) = 2
      AND (gatilho.tgtype::integer & 4) = 4
      AND (gatilho.tgtype::integer & 16) = 16
  ) THEN
    RAISE EXCEPTION 'Proteção permanente do enquadramento está ausente.';
  END IF;

  IF NOT (
    SELECT procedimento.prosecdef
    FROM pg_catalog.pg_proc procedimento
    WHERE procedimento.oid = v_funcao::oid
  ) THEN
    RAISE EXCEPTION 'Proteção do enquadramento precisa ignorar RLS do catálogo.';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(v_funcao) INTO v_definicao;
  IF position('isenta_imune' IN v_definicao) = 0
     OR position('holding_patrimonial' IN v_definicao) = 0
     OR position('''te-5''' IN v_definicao) = 0
     OR position('''te-6''' IN v_definicao) = 0
     OR position('''nj-1''' IN v_definicao) = 0
     OR position('''nj-4''' IN v_definicao) = 0
     OR position('catalogo.ativo = false' IN lower(v_definicao)) = 0
     OR position('pessoa_fisica' IN v_definicao) = 0
     OR position('new.tipo = ''pf''' IN lower(v_definicao)) = 0
     OR position('new.tipo' IN lower(v_definicao)) = 0
     OR position('new.tipo_empresa_id' IN lower(v_definicao)) = 0
     OR position('new.natureza_juridica_id' IN lower(v_definicao)) = 0
     OR position('set search_path to ''''' IN lower(v_definicao)) = 0 THEN
    RAISE EXCEPTION 'Proteção permanente não cobre os aliases legados.';
  END IF;

  IF has_function_privilege(
       'anon', 'app_private.validar_enquadramento_cliente_trigger()', 'EXECUTE'
     ) OR has_function_privilege(
       'authenticated',
       'app_private.validar_enquadramento_cliente_trigger()',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Função interna do gatilho está exposta à API.';
  END IF;
END;
$test$;

DO $test$
DECLARE
  v_funcao regprocedure := pg_catalog.to_regprocedure(
    'app_private.provisionar_classificacoes_parceiro_empresa_trigger()'
  );
  v_definicao text;
BEGIN
  IF v_funcao IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger gatilho
    WHERE gatilho.tgrelid = 'public.empresas'::regclass
      AND gatilho.tgname = 'provisionar_classificacoes_parceiro_empresa'
      AND NOT gatilho.tgisinternal
      AND gatilho.tgenabled <> 'D'
      AND gatilho.tgfoid = v_funcao
  ) THEN
    RAISE EXCEPTION 'Provisionamento de classificações para novas empresas está ausente.';
  END IF;

  IF NOT (
    SELECT procedimento.prosecdef
    FROM pg_catalog.pg_proc procedimento
    WHERE procedimento.oid = v_funcao::oid
  ) THEN
    RAISE EXCEPTION 'Provisionamento precisa executar com privilégios internos.';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(v_funcao) INTO v_definicao;
  IF position('pessoa_fisica' IN v_definicao) = 0
     OR position('demais' IN v_definicao) = 0
     OR position('isenta_imune' IN v_definicao) = 0
     OR position('holding_patrimonial' IN v_definicao) = 0
     OR position('sociedade_limitada_unipessoal' IN v_definicao) = 0
     OR position('cliente_contabil' IN v_definicao) = 0
     OR position('categorias_clientes' IN v_definicao) = 0
     OR position('new.id' IN lower(v_definicao)) = 0
     OR position('set search_path to ''''' IN lower(v_definicao)) = 0 THEN
    RAISE EXCEPTION 'Provisionamento futuro perdeu catálogos, tenant ou search_path.';
  END IF;

  IF has_function_privilege(
       'anon', 'app_private.provisionar_classificacoes_parceiro_empresa_trigger()', 'EXECUTE'
     ) OR has_function_privilege(
       'authenticated',
       'app_private.provisionar_classificacoes_parceiro_empresa_trigger()',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Função interna de provisionamento está exposta à API.';
  END IF;
END;
$test$;

ROLLBACK;
