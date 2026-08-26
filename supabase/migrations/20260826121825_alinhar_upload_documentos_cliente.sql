-- Permite ao perfil Cliente Externo enviar e reler somente os próprios
-- documentos do cliente ao qual ele está explicitamente vinculado.
BEGIN;

-- Consulta o vinculo sem depender das policies de leitura de clientes. O
-- resultado continua limitado ao tenant ativo e, para perfis Cliente Externo,
-- ao cliente explicitamente atribuido ao usuario autenticado.
CREATE OR REPLACE FUNCTION public.documento_cliente_acessivel(
  p_empresa_id uuid,
  p_cliente_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND p_empresa_id = (SELECT public.current_empresa_id())
    AND public.documento_cliente_belongs_to_empresa(p_cliente_id, p_empresa_id)
    AND public.current_user_can_access_client_row(p_empresa_id, p_cliente_id);
$$;

REVOKE ALL ON FUNCTION public.documento_cliente_acessivel(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.documento_cliente_acessivel(uuid, text)
  TO authenticated;

-- O registro logico so pode apontar para um objeto que o proprio usuario
-- acabou de enviar ao caminho canonico do mesmo tenant/escopo/cliente.
CREATE OR REPLACE FUNCTION public.documento_storage_cadastro_consistente(
  p_empresa_id uuid,
  p_owner_user_id uuid,
  p_scope text,
  p_cliente_id text,
  p_storage_bucket text,
  p_storage_path text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND p_empresa_id = (SELECT public.current_empresa_id())
    AND p_owner_user_id = (SELECT auth.uid())
    AND p_storage_bucket = 'documentos'
    AND (storage.foldername(p_storage_path))[1] = p_empresa_id::text
    AND (
      (
        p_scope = 'pessoal'
        AND NULLIF(btrim(p_cliente_id), '') IS NULL
        AND (storage.foldername(p_storage_path))[2] = 'pessoal'
        AND (storage.foldername(p_storage_path))[3] = p_owner_user_id::text
      )
      OR (
        p_scope = 'empresa'
        AND NULLIF(btrim(p_cliente_id), '') IS NOT NULL
        AND (storage.foldername(p_storage_path))[2] = 'clientes'
        AND (storage.foldername(p_storage_path))[3] = NULLIF(btrim(p_cliente_id), '')
        AND public.documento_cliente_acessivel(p_empresa_id, p_cliente_id)
      )
    )
    AND EXISTS (
      SELECT 1
      FROM storage.objects objeto
      WHERE objeto.bucket_id = p_storage_bucket
        AND objeto.name = p_storage_path
        AND objeto.owner = (SELECT auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.documento_storage_cadastro_consistente(
  uuid, uuid, text, text, text, text
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.documento_storage_cadastro_consistente(
  uuid, uuid, text, text, text, text
) TO authenticated;

-- O teste de orfandade ignora RLS para que um objeto ja associado a qualquer
-- metadado nunca pareca livre por falta de visibilidade do usuario atual.
CREATE OR REPLACE FUNCTION public.documento_storage_objeto_orfao(
  p_storage_bucket text,
  p_storage_path text,
  p_owner_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND p_owner_user_id = (SELECT auth.uid())
    AND p_storage_bucket = 'documentos'
    AND (storage.foldername(p_storage_path))[1]
      = (SELECT public.current_empresa_id())::text
    AND NOT EXISTS (
      SELECT 1
      FROM public.documentos documento
      WHERE documento.storage_bucket = p_storage_bucket
        AND documento.storage_path = p_storage_path
    );
$$;

REVOKE ALL ON FUNCTION public.documento_storage_objeto_orfao(text, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.documento_storage_objeto_orfao(text, text, uuid)
  TO authenticated;

-- As policies restritivas sao combinadas com AND. A excecao do portal precisa
-- existir tambem na barreira restritiva, sempre limitada ao proprio usuario e
-- ao cliente explicitamente atribuido dentro do tenant ativo.
DROP POLICY IF EXISTS isolamento_cliente_insert ON public.documentos;
CREATE POLICY isolamento_cliente_insert ON public.documentos
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = (SELECT public.current_empresa_id())
    AND (
      NOT public.current_user_is_client_scoped(empresa_id)
      OR (
        owner_user_id = (SELECT auth.uid())
        AND public.current_user_has_permission(empresa_id, 'documentos:create-own')
        AND scope = 'empresa'
        AND cliente_id IS NOT NULL
        AND public.documento_cliente_acessivel(empresa_id, cliente_id)
      )
    )
  );

DROP POLICY IF EXISTS isolamento_cliente_select ON public.documentos;
CREATE POLICY isolamento_cliente_select ON public.documentos
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    empresa_id = (SELECT public.current_empresa_id())
    AND (
      NOT public.current_user_is_client_scoped(empresa_id)
      OR (
        public.documento_cliente_acessivel(empresa_id, cliente_id)
        AND (
          public.current_user_has_permission(empresa_id, 'documentos:view-own')
          OR (
            public.current_user_has_permission(empresa_id, 'documentos:create-own')
            AND owner_user_id = (SELECT auth.uid())
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS documentos_insert_permission ON public.documentos;
CREATE POLICY documentos_insert_permission ON public.documentos
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = (SELECT public.current_empresa_id())
    AND owner_user_id = (SELECT auth.uid())
    AND public.documento_storage_cadastro_consistente(
      empresa_id,
      owner_user_id,
      scope,
      cliente_id,
      storage_bucket,
      storage_path
    )
    AND (
      (
        (
          public.current_user_has_permission(empresa_id, 'documentos:create')
          OR public.current_user_has_permission(empresa_id, 'documentos:manage')
        )
        AND (
          (scope = 'pessoal' AND cliente_id IS NULL)
          OR (
            scope = 'empresa'
            AND cliente_id IS NOT NULL
            AND public.documento_cliente_acessivel(empresa_id, cliente_id)
          )
        )
      )
      OR (
        public.current_user_has_permission(empresa_id, 'documentos:create-own')
        AND scope = 'empresa'
        AND cliente_id IS NOT NULL
        AND public.current_user_is_client_scoped(empresa_id)
        AND public.documento_cliente_acessivel(empresa_id, cliente_id)
      )
    )
  );

DROP POLICY IF EXISTS documentos_select_permission ON public.documentos;
CREATE POLICY documentos_select_permission ON public.documentos
  FOR SELECT TO authenticated
  USING (
    empresa_id = (SELECT public.current_empresa_id())
    AND (
      (
        (
          public.current_user_has_permission(empresa_id, 'documentos:view')
          OR public.current_user_has_permission(empresa_id, 'documentos:manage')
        )
        AND (
          (scope = 'pessoal' AND owner_user_id = (SELECT auth.uid()))
          OR (
            scope = 'empresa'
            AND cliente_id IS NOT NULL
            AND public.documento_cliente_acessivel(empresa_id, cliente_id)
          )
        )
      )
      OR (
        public.current_user_has_permission(empresa_id, 'documentos:view-own')
        AND (
          (scope = 'pessoal' AND owner_user_id = (SELECT auth.uid()))
          OR (
            scope = 'empresa'
            AND cliente_id IS NOT NULL
            AND public.current_user_is_client_scoped(empresa_id)
            AND public.documento_cliente_acessivel(empresa_id, cliente_id)
          )
        )
      )
      OR (
        public.current_user_has_permission(empresa_id, 'documentos:create')
        AND owner_user_id = (SELECT auth.uid())
        AND (
          scope = 'pessoal'
          OR (
            scope = 'empresa'
            AND cliente_id IS NOT NULL
            AND public.documento_cliente_acessivel(empresa_id, cliente_id)
          )
        )
      )
      OR (
        public.current_user_has_permission(empresa_id, 'documentos:create-own')
        AND owner_user_id = (SELECT auth.uid())
        AND scope = 'empresa'
        AND cliente_id IS NOT NULL
        AND public.current_user_is_client_scoped(empresa_id)
        AND public.documento_cliente_acessivel(empresa_id, cliente_id)
      )
    )
  );

DROP POLICY IF EXISTS documentos_storage_select_policy ON storage.objects;
CREATE POLICY documentos_storage_select_policy ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos'
    AND EXISTS (
      SELECT 1
      FROM public.documentos documento
      WHERE documento.storage_bucket = storage.objects.bucket_id
        AND documento.storage_path = storage.objects.name
        AND (
          (
            (
              public.current_user_has_permission(documento.empresa_id, 'documentos:view')
              OR public.current_user_has_permission(documento.empresa_id, 'documentos:view-own')
              OR public.current_user_has_permission(documento.empresa_id, 'documentos:manage')
            )
            AND (
              (
                documento.scope = 'pessoal'
                AND documento.owner_user_id = (SELECT auth.uid())
              )
              OR (
                documento.scope = 'empresa'
                AND documento.cliente_id IS NOT NULL
                AND public.documento_cliente_acessivel(
                  documento.empresa_id,
                  documento.cliente_id
                )
              )
            )
          )
          OR (
            public.current_user_has_permission(documento.empresa_id, 'documentos:create')
            AND documento.owner_user_id = (SELECT auth.uid())
            AND (
              documento.scope = 'pessoal'
              OR (
                documento.scope = 'empresa'
                AND documento.cliente_id IS NOT NULL
                AND public.documento_cliente_acessivel(
                  documento.empresa_id,
                  documento.cliente_id
                )
              )
            )
          )
          OR (
            public.current_user_has_permission(documento.empresa_id, 'documentos:create-own')
            AND documento.owner_user_id = (SELECT auth.uid())
            AND documento.scope = 'empresa'
            AND documento.cliente_id IS NOT NULL
            AND public.current_user_is_client_scoped(documento.empresa_id)
            AND public.documento_cliente_acessivel(
              documento.empresa_id,
              documento.cliente_id
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS documentos_storage_insert_policy ON storage.objects;
CREATE POLICY documentos_storage_insert_policy ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos'
    AND owner = (SELECT auth.uid())
    AND (storage.foldername(name))[1] = public.current_empresa_id()::text
    AND (
      (
        (
          public.current_user_has_permission(
            public.current_empresa_id(),
            'documentos:create'
          )
          OR public.current_user_has_permission(
            public.current_empresa_id(),
            'documentos:manage'
          )
        )
        AND (
          (
            (storage.foldername(name))[2] = 'pessoal'
            AND (storage.foldername(name))[3] = (SELECT auth.uid())::text
          )
          OR (
            (storage.foldername(name))[2] = 'clientes'
            AND public.documento_cliente_acessivel(
              public.current_empresa_id(),
              (storage.foldername(name))[3]
            )
          )
        )
      )
      OR (
        public.current_user_has_permission(
          public.current_empresa_id(),
          'documentos:create-own'
        )
        AND public.current_user_is_client_scoped(public.current_empresa_id())
        AND (storage.foldername(name))[2] = 'clientes'
        AND public.documento_cliente_acessivel(
          public.current_empresa_id(),
          (storage.foldername(name))[3]
        )
      )
    )
  );

-- O dono pode apagar o proprio upload no caminho permitido mesmo se a criacao
-- do metadado falhar. Isso evita objetos orfaos sem ampliar o acesso ao tenant.
DROP POLICY IF EXISTS documentos_storage_delete_policy ON storage.objects;
CREATE POLICY documentos_storage_delete_policy ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (
      (
        owner = (SELECT auth.uid())
        AND (storage.foldername(name))[1] = public.current_empresa_id()::text
        AND public.documento_storage_objeto_orfao(bucket_id, name, owner)
        AND (
          (
            (storage.foldername(name))[2] = 'pessoal'
            AND (storage.foldername(name))[3] = (SELECT auth.uid())::text
          )
          OR (
            (storage.foldername(name))[2] = 'clientes'
            AND public.documento_cliente_acessivel(
              public.current_empresa_id(),
              (storage.foldername(name))[3]
            )
          )
        )
      )
      OR EXISTS (
        SELECT 1
        FROM public.documentos documento
        WHERE documento.storage_bucket = storage.objects.bucket_id
          AND documento.storage_path = storage.objects.name
          AND (
            (
              documento.scope = 'pessoal'
              AND documento.owner_user_id = (SELECT auth.uid())
            )
            OR (
              documento.scope = 'empresa'
              AND public.current_user_has_permission(
                documento.empresa_id,
                'documentos:manage'
              )
              AND public.documento_cliente_acessivel(
                documento.empresa_id,
                documento.cliente_id
              )
            )
          )
      )
    )
  );

COMMIT;
