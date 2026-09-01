-- Fecha o escopo documental por parceiro operacional (matriz/filial) e
-- centraliza a gravação concorrente de pastas e categorias customizadas.
BEGIN;

CREATE OR REPLACE FUNCTION public.documento_cliente_belongs_to_empresa(
  p_cliente_id text,
  p_empresa_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND p_empresa_id IS NOT NULL
    AND NULLIF(pg_catalog.btrim(p_cliente_id), '') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.clientes cliente
      WHERE cliente.empresa_id = p_empresa_id
        AND cliente.id::text = NULLIF(pg_catalog.btrim(p_cliente_id), '')
        AND public.current_user_can_access_cliente_operacional(
          cliente.empresa_id, cliente.id
        )
    );
$$;

REVOKE ALL ON FUNCTION public.documento_cliente_belongs_to_empresa(text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.documento_cliente_belongs_to_empresa(text, uuid)
  TO authenticated;

-- A policy permissiva é somente a base necessária ao RLS; os guards
-- RESTRICTIVE abaixo permanecem obrigatórios mesmo se existir policy legada.
DROP POLICY IF EXISTS documentos_tenant_policy ON public.documentos;
DROP POLICY IF EXISTS documentos_select_policy ON public.documentos;
DROP POLICY IF EXISTS documentos_insert_policy ON public.documentos;
DROP POLICY IF EXISTS documentos_update_policy ON public.documentos;
DROP POLICY IF EXISTS documentos_delete_policy ON public.documentos;
DROP POLICY IF EXISTS documentos_select_permission ON public.documentos;
DROP POLICY IF EXISTS documentos_insert_permission ON public.documentos;
DROP POLICY IF EXISTS documentos_update_owner_or_manager ON public.documentos;
DROP POLICY IF EXISTS documentos_delete_owner_or_manager ON public.documentos;
DROP POLICY IF EXISTS documentos_operacional_allow ON public.documentos;
DROP POLICY IF EXISTS documentos_operacional_select_guard ON public.documentos;
DROP POLICY IF EXISTS documentos_operacional_insert_guard ON public.documentos;
DROP POLICY IF EXISTS documentos_operacional_update_guard ON public.documentos;
DROP POLICY IF EXISTS documentos_operacional_delete_guard ON public.documentos;

CREATE POLICY documentos_operacional_allow ON public.documentos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY documentos_operacional_select_guard ON public.documentos
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    (scope = 'pessoal' AND cliente_id IS NULL
      AND owner_user_id = auth.uid() AND public.is_empresa_member(empresa_id))
    OR (
      scope = 'empresa' AND cliente_id IS NOT NULL
      AND public.documento_cliente_belongs_to_empresa(cliente_id, empresa_id)
      AND (
        public.current_user_has_permission(empresa_id, 'documentos:view')
        OR public.current_user_has_permission(empresa_id, 'documentos:manage')
        OR public.current_user_has_permission(empresa_id, 'documentos:view-own')
        OR (owner_user_id = auth.uid() AND (
          public.current_user_has_permission(empresa_id, 'documentos:create')
          OR public.current_user_has_permission(empresa_id, 'documentos:create-own')
        ))
      )
    )
  );

CREATE POLICY documentos_operacional_insert_guard ON public.documentos
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND owner_user_id = auth.uid()
    AND public.documento_storage_cadastro_consistente(
      empresa_id, owner_user_id, scope, cliente_id, storage_bucket, storage_path
    )
    AND (
      (scope = 'pessoal' AND cliente_id IS NULL
        AND public.is_empresa_member(empresa_id))
      OR (
        scope = 'empresa' AND cliente_id IS NOT NULL
        AND public.documento_cliente_belongs_to_empresa(cliente_id, empresa_id)
        AND (
          public.current_user_has_permission(empresa_id, 'documentos:create')
          OR public.current_user_has_permission(empresa_id, 'documentos:manage')
          OR public.current_user_has_permission(empresa_id, 'documentos:create-own')
        )
      )
    )
  );

CREATE POLICY documentos_operacional_update_guard ON public.documentos
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    (scope = 'pessoal' AND cliente_id IS NULL
      AND owner_user_id = auth.uid() AND public.is_empresa_member(empresa_id))
    OR (scope = 'empresa' AND cliente_id IS NOT NULL
      AND public.documento_cliente_belongs_to_empresa(cliente_id, empresa_id)
      AND (public.current_user_has_permission(empresa_id, 'documentos:manage')
        OR (owner_user_id = auth.uid() AND (
          public.current_user_has_permission(empresa_id, 'documentos:create')
          OR public.current_user_has_permission(empresa_id, 'documentos:create-own')))))
  )
  WITH CHECK (
    (scope = 'pessoal' AND cliente_id IS NULL
      AND owner_user_id = auth.uid() AND public.is_empresa_member(empresa_id))
    OR (scope = 'empresa' AND cliente_id IS NOT NULL
      AND public.documento_cliente_belongs_to_empresa(cliente_id, empresa_id)
      AND (public.current_user_has_permission(empresa_id, 'documentos:manage')
        OR (owner_user_id = auth.uid() AND (
          public.current_user_has_permission(empresa_id, 'documentos:create')
          OR public.current_user_has_permission(empresa_id, 'documentos:create-own')))))
  );

CREATE POLICY documentos_operacional_delete_guard ON public.documentos
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    (scope = 'pessoal' AND cliente_id IS NULL
      AND owner_user_id = auth.uid() AND public.is_empresa_member(empresa_id))
    OR (scope = 'empresa' AND cliente_id IS NOT NULL
      AND public.documento_cliente_belongs_to_empresa(cliente_id, empresa_id)
      AND (public.current_user_has_permission(empresa_id, 'documentos:manage')
        OR (owner_user_id = auth.uid() AND (
          public.current_user_has_permission(empresa_id, 'documentos:create')
          OR public.current_user_has_permission(empresa_id, 'documentos:create-own')))))
  );

DROP POLICY IF EXISTS documentos_categorias_tenant_policy ON public.documentos_categorias;
DROP POLICY IF EXISTS documentos_categorias_select_policy ON public.documentos_categorias;
DROP POLICY IF EXISTS documentos_categorias_insert_policy ON public.documentos_categorias;
DROP POLICY IF EXISTS documentos_categorias_update_policy ON public.documentos_categorias;
DROP POLICY IF EXISTS documentos_categorias_delete_policy ON public.documentos_categorias;
DROP POLICY IF EXISTS documentos_categorias_operacional_allow ON public.documentos_categorias;
DROP POLICY IF EXISTS documentos_categorias_select_guard ON public.documentos_categorias;
DROP POLICY IF EXISTS documentos_categorias_insert_guard ON public.documentos_categorias;
DROP POLICY IF EXISTS documentos_categorias_update_guard ON public.documentos_categorias;
DROP POLICY IF EXISTS documentos_categorias_delete_guard ON public.documentos_categorias;

CREATE POLICY documentos_categorias_operacional_allow ON public.documentos_categorias
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY documentos_categorias_select_guard ON public.documentos_categorias
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    (empresa_id IS NULL AND cliente_id IS NULL AND sistema = true)
    OR (
      empresa_id IS NOT NULL
      AND (
        cliente_id IS NULL
        OR public.current_user_can_access_cliente_operacional(empresa_id, cliente_id)
      )
      AND (
        public.current_user_has_permission(empresa_id, 'documentos:view')
        OR public.current_user_has_permission(empresa_id, 'documentos:manage')
        OR public.current_user_has_permission(empresa_id, 'documentos:view-own')
        OR public.current_user_has_permission(empresa_id, 'documentos:create')
        OR public.current_user_has_permission(empresa_id, 'documentos:create-own')
      )
    )
  );

CREATE POLICY documentos_categorias_insert_guard ON public.documentos_categorias
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id IS NOT NULL AND sistema = false
    AND public.current_user_has_permission(empresa_id, 'documentos:manage')
    AND cliente_id IS NULL
    AND NOT public.current_user_is_client_scoped(empresa_id)
  );

CREATE POLICY documentos_categorias_update_guard ON public.documentos_categorias
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    empresa_id IS NOT NULL AND sistema = false
    AND public.current_user_has_permission(empresa_id, 'documentos:manage')
    AND cliente_id IS NULL
    AND NOT public.current_user_is_client_scoped(empresa_id)
  )
  WITH CHECK (
    empresa_id IS NOT NULL AND sistema = false
    AND public.current_user_has_permission(empresa_id, 'documentos:manage')
    AND cliente_id IS NULL
    AND NOT public.current_user_is_client_scoped(empresa_id)
  );

CREATE POLICY documentos_categorias_delete_guard ON public.documentos_categorias
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    empresa_id IS NOT NULL AND sistema = false
    AND public.current_user_has_permission(empresa_id, 'documentos:manage')
    AND cliente_id IS NULL
    AND NOT public.current_user_is_client_scoped(empresa_id)
  );

-- A policy pública de compartilhamento permanece intacta. Para usuários
-- autenticados, o guard também a reconhece para não quebrar links válidos.
DROP POLICY IF EXISTS documentos_storage_select_policy ON storage.objects;
DROP POLICY IF EXISTS documentos_storage_insert_policy ON storage.objects;
DROP POLICY IF EXISTS documentos_storage_update_policy ON storage.objects;
DROP POLICY IF EXISTS documentos_storage_delete_policy ON storage.objects;
DROP POLICY IF EXISTS documentos_storage_operacional_allow ON storage.objects;
DROP POLICY IF EXISTS documentos_storage_select_guard ON storage.objects;
DROP POLICY IF EXISTS documentos_storage_insert_guard ON storage.objects;
DROP POLICY IF EXISTS documentos_storage_update_guard ON storage.objects;
DROP POLICY IF EXISTS documentos_storage_delete_guard ON storage.objects;

CREATE POLICY documentos_storage_operacional_allow ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'documentos') WITH CHECK (bucket_id = 'documentos');

CREATE POLICY documentos_storage_select_guard ON storage.objects
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    bucket_id <> 'documentos' OR (
      bucket_id = 'documentos' AND (
        (owner = auth.uid()
          AND (storage.foldername(name))[1] = public.current_empresa_id()::text
          AND (storage.foldername(name))[2] = 'pessoal'
          AND (storage.foldername(name))[3] = auth.uid()::text)
        OR EXISTS (
          SELECT 1 FROM public.documentos documento
          WHERE documento.storage_bucket = storage.objects.bucket_id
            AND documento.storage_path = storage.objects.name
            AND documento.scope = 'empresa' AND documento.cliente_id IS NOT NULL
            AND public.documento_cliente_belongs_to_empresa(
              documento.cliente_id, documento.empresa_id
            )
            AND (
              public.current_user_has_permission(documento.empresa_id, 'documentos:view')
              OR public.current_user_has_permission(documento.empresa_id, 'documentos:manage')
              OR public.current_user_has_permission(documento.empresa_id, 'documentos:view-own')
              OR (documento.owner_user_id = auth.uid() AND (
                public.current_user_has_permission(documento.empresa_id, 'documentos:create')
                OR public.current_user_has_permission(documento.empresa_id, 'documentos:create-own')
              ))
            )
        )
        OR EXISTS (
          SELECT 1
          FROM public.documentos_compartilhamentos compartilhamento
          JOIN public.documentos documento ON documento.id = compartilhamento.documento_id
          WHERE compartilhamento.status = 'Ativo' AND compartilhamento.expires_at > now()
            AND documento.storage_bucket = storage.objects.bucket_id
            AND documento.storage_path = storage.objects.name
        )
      )
    )
  );

CREATE POLICY documentos_storage_insert_guard ON storage.objects
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id <> 'documentos' OR (
      bucket_id = 'documentos' AND owner = auth.uid()
      AND (storage.foldername(name))[1] = public.current_empresa_id()::text
      AND (
        ((storage.foldername(name))[2] = 'pessoal'
          AND (storage.foldername(name))[3] = auth.uid()::text)
        OR ((storage.foldername(name))[2] = 'clientes'
          AND public.documento_cliente_belongs_to_empresa(
            (storage.foldername(name))[3], public.current_empresa_id()
          )
          AND (
            public.current_user_has_permission(public.current_empresa_id(), 'documentos:create')
            OR public.current_user_has_permission(public.current_empresa_id(), 'documentos:manage')
            OR public.current_user_has_permission(public.current_empresa_id(), 'documentos:create-own')
          ))
      )
    )
  );

CREATE POLICY documentos_storage_update_guard ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    bucket_id <> 'documentos' OR (
      bucket_id = 'documentos' AND (
        (owner = auth.uid() AND (storage.foldername(name))[1] = public.current_empresa_id()::text
          AND (storage.foldername(name))[2] = 'pessoal'
          AND (storage.foldername(name))[3] = auth.uid()::text)
        OR EXISTS (
          SELECT 1 FROM public.documentos documento
          WHERE documento.storage_bucket = storage.objects.bucket_id
            AND documento.storage_path = storage.objects.name
            AND documento.scope = 'empresa' AND documento.cliente_id IS NOT NULL
            AND public.documento_cliente_belongs_to_empresa(documento.cliente_id, documento.empresa_id)
            AND (public.current_user_has_permission(documento.empresa_id, 'documentos:manage')
              OR (documento.owner_user_id = auth.uid() AND (
                public.current_user_has_permission(documento.empresa_id, 'documentos:create')
                OR public.current_user_has_permission(documento.empresa_id, 'documentos:create-own'))))
        )
      )
    )
  )
  WITH CHECK (
    bucket_id <> 'documentos' OR (
      bucket_id = 'documentos' AND (
        (owner = auth.uid() AND (storage.foldername(name))[1] = public.current_empresa_id()::text
          AND (storage.foldername(name))[2] = 'pessoal'
          AND (storage.foldername(name))[3] = auth.uid()::text)
        OR EXISTS (
          SELECT 1 FROM public.documentos documento
          WHERE documento.storage_bucket = storage.objects.bucket_id
            AND documento.storage_path = storage.objects.name
            AND documento.scope = 'empresa' AND documento.cliente_id IS NOT NULL
            AND public.documento_cliente_belongs_to_empresa(documento.cliente_id, documento.empresa_id)
            AND (public.current_user_has_permission(documento.empresa_id, 'documentos:manage')
              OR (documento.owner_user_id = auth.uid() AND (
                public.current_user_has_permission(documento.empresa_id, 'documentos:create')
                OR public.current_user_has_permission(documento.empresa_id, 'documentos:create-own'))))
        )
      )
    )
  );

CREATE POLICY documentos_storage_delete_guard ON storage.objects
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    bucket_id <> 'documentos' OR (
      bucket_id = 'documentos' AND (
        (owner = auth.uid() AND (storage.foldername(name))[1] = public.current_empresa_id()::text
          AND (storage.foldername(name))[2] = 'pessoal'
          AND (storage.foldername(name))[3] = auth.uid()::text)
        OR (owner = auth.uid()
          AND (storage.foldername(name))[1] = public.current_empresa_id()::text
          AND (storage.foldername(name))[2] = 'clientes'
          AND public.documento_cliente_belongs_to_empresa(
            (storage.foldername(name))[3], public.current_empresa_id()
          )
          AND public.documento_storage_objeto_orfao(bucket_id, name, owner))
        OR EXISTS (
          SELECT 1 FROM public.documentos documento
          WHERE documento.storage_bucket = storage.objects.bucket_id
            AND documento.storage_path = storage.objects.name
            AND documento.scope = 'empresa' AND documento.cliente_id IS NOT NULL
            AND public.documento_cliente_belongs_to_empresa(documento.cliente_id, documento.empresa_id)
            AND (public.current_user_has_permission(documento.empresa_id, 'documentos:manage')
              OR (documento.owner_user_id = auth.uid() AND (
                public.current_user_has_permission(documento.empresa_id, 'documentos:create')
                OR public.current_user_has_permission(documento.empresa_id, 'documentos:create-own'))))
        )
      )
    )
  );

CREATE OR REPLACE FUNCTION public.salvar_configuracao_documental_cliente_v1(
  p_cliente_id uuid,
  p_pastas text[],
  p_categorias text[],
  p_expected_updated_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_cliente public.clientes%rowtype;
  v_pastas text[] := '{}'::text[];
  v_categorias text[] := '{}'::text[];
  v_updated_at timestamptz;
  v_novo_updated_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR NOT COALESCE(public.current_user_has_permission(v_empresa_id, 'documentos:manage'), false)
     OR p_cliente_id IS NULL
     OR NOT COALESCE(
       public.current_user_can_access_cliente_operacional(v_empresa_id, p_cliente_id), false
     ) THEN
    RAISE EXCEPTION 'Configuração documental não encontrada.' USING ERRCODE = '42501';
  END IF;
  IF p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'Configuração alterada por outro usuário.' USING ERRCODE = '40001';
  END IF;
  IF COALESCE(cardinality(p_pastas), 0) > 300
     OR COALESCE(cardinality(p_categorias), 0) > 100 THEN
    RAISE EXCEPTION 'Configuração documental inválida.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(COALESCE(p_pastas, '{}'::text[])) AS item(pasta)
    WHERE pg_catalog.btrim(pasta) = '' OR char_length(pg_catalog.btrim(pasta)) > 300
      OR pg_catalog.btrim(pasta) ~ '(^/|/$|//|(^|/)[.]{1,2}(/|$)|[[:cntrl:]])'
  ) OR EXISTS (
    SELECT 1 FROM unnest(COALESCE(p_categorias, '{}'::text[])) AS item(categoria)
    WHERE pg_catalog.btrim(categoria) = '' OR char_length(pg_catalog.btrim(categoria)) > 120
      OR pg_catalog.btrim(categoria) ~ '[[:cntrl:]]'
  ) THEN
    RAISE EXCEPTION 'Pastas ou categorias documentais inválidas.' USING ERRCODE = '22023';
  END IF;

  SELECT public.expand_pastas_documentos_paths(COALESCE(array_agg(pasta ORDER BY ordem), '{}'::text[]))
  INTO v_pastas
  FROM (
    SELECT DISTINCT ON (lower(pasta)) pasta, ordem
    FROM (
      SELECT pg_catalog.regexp_replace(pg_catalog.btrim(valor), '[[:space:]]+', ' ', 'g') AS pasta, ordem
      FROM unnest(COALESCE(p_pastas, '{}'::text[])) WITH ORDINALITY AS item(valor, ordem)
    ) normalizadas
    ORDER BY lower(pasta), ordem
  ) distintas;
  SELECT COALESCE(array_agg(categoria ORDER BY ordem), '{}'::text[])
  INTO v_categorias
  FROM (
    SELECT DISTINCT ON (lower(categoria)) categoria, ordem
    FROM (
      SELECT pg_catalog.regexp_replace(pg_catalog.btrim(valor), '[[:space:]]+', ' ', 'g') AS categoria, ordem
      FROM unnest(COALESCE(p_categorias, '{}'::text[])) WITH ORDINALITY AS item(valor, ordem)
    ) normalizadas
    ORDER BY lower(categoria), ordem
  ) distintas;
  -- A UI apresenta categorias globais junto das específicas. Elas não devem
  -- ser materializadas novamente em cada parceiro ao salvar apenas uma pasta.
  SELECT COALESCE(array_agg(item.categoria ORDER BY item.ordem), '{}'::text[])
  INTO v_categorias
  FROM unnest(v_categorias) WITH ORDINALITY AS item(categoria, ordem)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.documentos_categorias global
    WHERE global.empresa_id = v_empresa_id AND global.cliente_id IS NULL AND global.ativo
      AND lower(pg_catalog.btrim(global.nome)) = lower(item.categoria)
  );
  IF EXISTS (
    SELECT 1 FROM unnest(v_categorias) AS item(categoria)
    JOIN public.documentos_categorias sistema
      ON sistema.empresa_id IS NULL AND sistema.cliente_id IS NULL AND sistema.sistema = true
     AND lower(pg_catalog.btrim(sistema.nome)) = lower(categoria)
  ) THEN
    RAISE EXCEPTION 'Categorias padrão não podem ser personalizadas.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_empresa_id::text, 913331));
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_empresa_id::text || ':' || p_cliente_id::text, 913334)
  );
  SELECT cliente.* INTO v_cliente
  FROM public.clientes cliente
  WHERE cliente.empresa_id = v_empresa_id AND cliente.id = p_cliente_id
  FOR UPDATE;
  IF NOT FOUND OR v_cliente.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Configuração alterada por outro usuário.' USING ERRCODE = '40001';
  END IF;
  v_updated_at := v_cliente.updated_at;
  PERFORM 1 FROM public.documentos_categorias categoria
  WHERE categoria.empresa_id = v_empresa_id AND categoria.cliente_id = p_cliente_id
  FOR UPDATE;

  WITH desejadas AS (
    SELECT categoria, ordem, lower(categoria) AS chave
    FROM unnest(v_categorias) WITH ORDINALITY AS item(categoria, ordem)
  )
  UPDATE public.documentos_categorias existente
  SET nome = desejadas.categoria, ativo = true, ordem = desejadas.ordem
  FROM desejadas
  WHERE existente.empresa_id = v_empresa_id AND existente.cliente_id = p_cliente_id
    AND existente.sistema = false AND lower(pg_catalog.btrim(existente.nome)) = desejadas.chave;
  INSERT INTO public.documentos_categorias (empresa_id, cliente_id, nome, ativo, sistema, ordem)
  SELECT v_empresa_id, p_cliente_id, desejadas.categoria, true, false, desejadas.ordem
  FROM unnest(v_categorias) WITH ORDINALITY AS desejadas(categoria, ordem)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.documentos_categorias existente
    WHERE existente.empresa_id = v_empresa_id AND existente.cliente_id = p_cliente_id
      AND existente.sistema = false
      AND lower(pg_catalog.btrim(existente.nome)) = lower(desejadas.categoria)
  )
  ON CONFLICT DO NOTHING;
  DELETE FROM public.documentos_categorias existente
  WHERE existente.empresa_id = v_empresa_id AND existente.cliente_id = p_cliente_id
    AND existente.sistema = false AND NOT EXISTS (
      SELECT 1 FROM unnest(v_categorias) desejada(categoria)
      WHERE lower(pg_catalog.btrim(desejada.categoria)) = lower(pg_catalog.btrim(existente.nome))
    );

  UPDATE public.clientes cliente
  SET pastas_documentos = v_pastas, categorias_documentos = v_categorias
  WHERE cliente.empresa_id = v_empresa_id AND cliente.id = p_cliente_id
    AND (cliente.pastas_documentos IS DISTINCT FROM v_pastas
      OR cliente.categorias_documentos IS DISTINCT FROM v_categorias)
  RETURNING cliente.updated_at INTO v_novo_updated_at;
  IF FOUND THEN v_updated_at := v_novo_updated_at; END IF;
  RETURN jsonb_build_object(
    'cliente_id', p_cliente_id,
    'pastas', COALESCE(to_jsonb(v_pastas), '[]'::jsonb),
    'categorias', COALESCE(to_jsonb(v_categorias), '[]'::jsonb),
    'updated_at', to_jsonb(v_updated_at)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_configuracao_documental_cliente_v1(uuid, text[], text[], timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_configuracao_documental_cliente_v1(uuid, text[], text[], timestamptz)
  TO authenticated;

COMMIT;
