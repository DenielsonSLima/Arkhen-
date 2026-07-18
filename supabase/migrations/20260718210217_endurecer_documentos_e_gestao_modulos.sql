-- Centraliza a autorização da parametrização de módulos no RBAC vigente.
CREATE OR REPLACE FUNCTION public.configuracoes_modulos_can_manage()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.current_user_has_permission(
    public.current_empresa_id(),
    'configuracoes:manage'
  );
$$;

REVOKE ALL ON FUNCTION public.configuracoes_modulos_can_manage() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.configuracoes_modulos_can_manage() FROM anon;
GRANT EXECUTE ON FUNCTION public.configuracoes_modulos_can_manage() TO authenticated;

-- Cada conta autenticada possui apenas um cadastro operacional por empresa.
-- Cadastros duplicados são preservados como inativos e seus vínculos migram
-- para o cadastro ativo atualizado mais recentemente.
CREATE TEMP TABLE configuracoes_usuarios_duplicados ON COMMIT DROP AS
WITH ranqueados AS (
  SELECT
    id,
    empresa_id,
    auth_user_id,
    first_value(id) OVER (
      PARTITION BY empresa_id, auth_user_id
      ORDER BY (status = 'Ativo') DESC, updated_at DESC, created_at DESC, id
    ) AS canonical_id,
    row_number() OVER (
      PARTITION BY empresa_id, auth_user_id
      ORDER BY (status = 'Ativo') DESC, updated_at DESC, created_at DESC, id
    ) AS posicao
  FROM public.configuracoes_usuarios
  WHERE auth_user_id IS NOT NULL
)
SELECT id AS duplicate_id, canonical_id, empresa_id
FROM ranqueados
WHERE posicao > 1;

UPDATE public.atividades_rotinas r
SET responsavel_config_usuario_id = d.canonical_id
FROM configuracoes_usuarios_duplicados d
WHERE r.empresa_id = d.empresa_id
  AND r.responsavel_config_usuario_id = d.duplicate_id;

UPDATE public.atividades_tarefas t
SET responsavel_config_usuario_id = d.canonical_id
FROM configuracoes_usuarios_duplicados d
WHERE t.empresa_id = d.empresa_id
  AND t.responsavel_config_usuario_id = d.duplicate_id;

UPDATE public.agenda_eventos e
SET responsavel_id = canonical.id
FROM public.agenda_responsaveis duplicate,
     configuracoes_usuarios_duplicados d,
     public.agenda_responsaveis canonical
WHERE duplicate.config_usuario_id = d.duplicate_id
  AND canonical.empresa_id = d.empresa_id
  AND canonical.config_usuario_id = d.canonical_id
  AND e.responsavel_id = duplicate.id;

DELETE FROM public.agenda_responsaveis duplicate
USING configuracoes_usuarios_duplicados d
WHERE duplicate.config_usuario_id = d.duplicate_id
  AND EXISTS (
    SELECT 1
    FROM public.agenda_responsaveis canonical
    WHERE canonical.empresa_id = d.empresa_id
      AND canonical.config_usuario_id = d.canonical_id
  );

UPDATE public.agenda_responsaveis ar
SET config_usuario_id = d.canonical_id
FROM configuracoes_usuarios_duplicados d
WHERE ar.empresa_id = d.empresa_id
  AND ar.config_usuario_id = d.duplicate_id;

UPDATE public.configuracoes_usuarios u
SET auth_user_id = NULL,
    status = 'Inativo'
FROM configuracoes_usuarios_duplicados d
WHERE u.id = d.duplicate_id;

CREATE UNIQUE INDEX IF NOT EXISTS configuracoes_usuarios_auth_user_unq
  ON public.configuracoes_usuarios(empresa_id, auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- Evita que atualizações de metadados movam um documento entre usuários,
-- tenants, escopos ou objetos físicos do Storage.
CREATE OR REPLACE FUNCTION public.documentos_preservar_identidade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
    OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
    OR NEW.scope IS DISTINCT FROM OLD.scope
    OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
    OR NEW.storage_bucket IS DISTINCT FROM OLD.storage_bucket
    OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
  THEN
    RAISE EXCEPTION 'A identidade e o destino do documento não podem ser alterados';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.documentos_preservar_identidade() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.documentos_preservar_identidade() FROM anon, authenticated;

DROP TRIGGER IF EXISTS documentos_preservar_identidade_trg ON public.documentos;
CREATE TRIGGER documentos_preservar_identidade_trg
BEFORE UPDATE ON public.documentos
FOR EACH ROW
EXECUTE FUNCTION public.documentos_preservar_identidade();

DROP POLICY IF EXISTS documentos_update_owner_or_manager ON public.documentos;
CREATE POLICY documentos_update_owner_or_manager ON public.documentos
  FOR UPDATE TO authenticated
  USING (
    public.current_user_has_permission(empresa_id, 'documentos:manage')
    OR (
      owner_user_id = auth.uid()
      AND public.is_empresa_member(empresa_id)
    )
  )
  WITH CHECK (
    (
      public.current_user_has_permission(empresa_id, 'documentos:manage')
      OR (
        owner_user_id = auth.uid()
        AND public.is_empresa_member(empresa_id)
      )
    )
    AND (
      (scope = 'pessoal' AND cliente_id IS NULL)
      OR (
        scope = 'empresa'
        AND cliente_id IS NOT NULL
        AND public.documento_cliente_belongs_to_empresa(cliente_id, empresa_id)
      )
    )
  );

-- O upload físico exige a mesma permissão usada na criação do registro.
DROP POLICY IF EXISTS documentos_storage_insert_policy ON storage.objects;
CREATE POLICY documentos_storage_insert_policy ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos'
    AND owner = auth.uid()
    AND (
      public.current_user_has_permission(public.current_empresa_id(), 'documentos:create')
      OR public.current_user_has_permission(public.current_empresa_id(), 'documentos:manage')
    )
    AND (storage.foldername(name))[1] = public.current_empresa_id()::text
    AND (
      (
        (storage.foldername(name))[2] = 'pessoal'
        AND (storage.foldername(name))[3] = auth.uid()::text
      )
      OR (
        (storage.foldername(name))[2] = 'clientes'
        AND public.documento_cliente_belongs_to_empresa(
          (storage.foldername(name))[3],
          public.current_empresa_id()
        )
      )
    )
  );

-- Garantia idempotente caso instalações antigas tenham criado o nome como índice.
DROP INDEX IF EXISTS public.agenda_responsaveis_nome_unq;
