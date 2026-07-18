-- Usa IDs estáveis nos vínculos operacionais e restringe o Storage por tenant.
ALTER TABLE public.agenda_responsaveis
  ADD COLUMN IF NOT EXISTS config_usuario_id uuid
  REFERENCES public.configuracoes_usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.atividades_rotinas
  ADD COLUMN IF NOT EXISTS responsavel_config_usuario_id uuid
  REFERENCES public.configuracoes_usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.atividades_tarefas
  ADD COLUMN IF NOT EXISTS responsavel_config_usuario_id uuid
  REFERENCES public.configuracoes_usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.agenda_responsaveis
  DROP CONSTRAINT IF EXISTS agenda_responsaveis_nome_unq;

CREATE UNIQUE INDEX IF NOT EXISTS agenda_responsaveis_config_usuario_unq
  ON public.agenda_responsaveis(empresa_id, config_usuario_id)
  WHERE config_usuario_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_atividades_rotinas_responsavel_config
  ON public.atividades_rotinas(empresa_id, responsavel_config_usuario_id)
  WHERE ativa = true;

CREATE INDEX IF NOT EXISTS idx_atividades_tarefas_responsavel_config
  ON public.atividades_tarefas(empresa_id, responsavel_config_usuario_id)
  WHERE ativo = true;

WITH usuarios_nome_unico AS (
  SELECT
    empresa_id,
    lower(trim(nome)) AS nome_key,
    (array_agg(id ORDER BY created_at))[1] AS config_usuario_id,
    (array_agg(auth_user_id ORDER BY created_at) FILTER (WHERE auth_user_id IS NOT NULL))[1] AS auth_user_id
  FROM public.configuracoes_usuarios
  GROUP BY empresa_id, lower(trim(nome))
  HAVING count(*) = 1
)
UPDATE public.agenda_responsaveis ar
SET config_usuario_id = u.config_usuario_id,
    user_id = COALESCE(ar.user_id, u.auth_user_id)
FROM usuarios_nome_unico u
WHERE ar.empresa_id = u.empresa_id
  AND lower(trim(ar.nome)) = u.nome_key
  AND ar.config_usuario_id IS NULL;

WITH usuarios_nome_unico AS (
  SELECT
    empresa_id,
    lower(trim(nome)) AS nome_key,
    (array_agg(id ORDER BY created_at))[1] AS config_usuario_id,
    (array_agg(auth_user_id ORDER BY created_at) FILTER (WHERE auth_user_id IS NOT NULL))[1] AS auth_user_id
  FROM public.configuracoes_usuarios
  GROUP BY empresa_id, lower(trim(nome))
  HAVING count(*) = 1
)
UPDATE public.atividades_rotinas r
SET responsavel_config_usuario_id = u.config_usuario_id,
    responsavel_user_id = COALESCE(r.responsavel_user_id, u.auth_user_id)
FROM usuarios_nome_unico u
WHERE r.empresa_id = u.empresa_id
  AND lower(trim(r.responsavel_nome)) = u.nome_key
  AND r.responsavel_config_usuario_id IS NULL;

WITH usuarios_nome_unico AS (
  SELECT
    empresa_id,
    lower(trim(nome)) AS nome_key,
    (array_agg(id ORDER BY created_at))[1] AS config_usuario_id,
    (array_agg(auth_user_id ORDER BY created_at) FILTER (WHERE auth_user_id IS NOT NULL))[1] AS auth_user_id
  FROM public.configuracoes_usuarios
  GROUP BY empresa_id, lower(trim(nome))
  HAVING count(*) = 1
)
UPDATE public.atividades_tarefas t
SET responsavel_config_usuario_id = u.config_usuario_id,
    responsavel_user_id = COALESCE(t.responsavel_user_id, u.auth_user_id)
FROM usuarios_nome_unico u
WHERE t.empresa_id = u.empresa_id
  AND lower(trim(t.responsavel_nome)) = u.nome_key
  AND t.responsavel_config_usuario_id IS NULL;

CREATE OR REPLACE FUNCTION public.sync_operational_user_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_responsavel_id uuid;
BEGIN
  IF NEW.auth_user_id IS NULL OR NEW.status <> 'Ativo' THEN
    UPDATE public.agenda_responsaveis
    SET nome = NEW.nome,
        perfil = NEW.perfil,
        status = NEW.status,
        ativo = false
    WHERE empresa_id = NEW.empresa_id
      AND config_usuario_id = NEW.id;
    RETURN NEW;
  END IF;

  SELECT ar.id
    INTO v_responsavel_id
  FROM public.agenda_responsaveis ar
  WHERE ar.empresa_id = NEW.empresa_id
    AND (ar.config_usuario_id = NEW.id OR ar.user_id = NEW.auth_user_id)
  ORDER BY (ar.config_usuario_id = NEW.id) DESC, ar.criado_em
  LIMIT 1;

  IF v_responsavel_id IS NULL THEN
    INSERT INTO public.agenda_responsaveis (
      empresa_id, config_usuario_id, user_id, nome, perfil, status, cor, ativo, ordem
    ) VALUES (
      NEW.empresa_id,
      NEW.id,
      NEW.auth_user_id,
      NEW.nome,
      NEW.perfil,
      NEW.status,
      '#2563eb',
      true,
      COALESCE((SELECT max(ar.ordem) + 1 FROM public.agenda_responsaveis ar WHERE ar.empresa_id = NEW.empresa_id), 1)
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_responsavel_id;
  ELSE
    UPDATE public.agenda_responsaveis
    SET config_usuario_id = NEW.id,
        user_id = NEW.auth_user_id,
        nome = NEW.nome,
        perfil = NEW.perfil,
        status = NEW.status,
        ativo = true
    WHERE id = v_responsavel_id
      AND (config_usuario_id IS NULL OR config_usuario_id = NEW.id)
      AND (user_id IS NULL OR user_id = NEW.auth_user_id);
  END IF;

  UPDATE public.atividades_rotinas
  SET responsavel_user_id = NEW.auth_user_id,
      responsavel_nome = NEW.nome
  WHERE empresa_id = NEW.empresa_id
    AND responsavel_config_usuario_id = NEW.id;

  UPDATE public.atividades_tarefas
  SET responsavel_user_id = NEW.auth_user_id,
      responsavel_nome = NEW.nome
  WHERE empresa_id = NEW.empresa_id
    AND responsavel_config_usuario_id = NEW.id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_operational_user_link() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_operational_user_link() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.current_user_permissions()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.perfis p
      WHERE p.user_id = auth.uid()
        AND p.empresa_id = public.current_empresa_id()
        AND p.ativo = true
        AND p.papel = 'admin'
    ) THEN ARRAY['*']::text[]
    ELSE COALESCE((
      SELECT array_agg(DISTINCT permissao ORDER BY permissao)
      FROM public.configuracoes_usuarios u
      JOIN public.configuracoes_perfis_acesso pa
        ON pa.empresa_id = u.empresa_id
       AND pa.ativo = true
       AND lower(pa.nome) = lower(u.perfil)
      CROSS JOIN LATERAL unnest(pa.permissoes) permissao
      WHERE u.empresa_id = public.current_empresa_id()
        AND u.auth_user_id = auth.uid()
        AND u.status = 'Ativo'
    ), ARRAY[]::text[])
  END;
$$;

REVOKE ALL ON FUNCTION public.current_user_permissions() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_permissions() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_user_permissions() TO authenticated;

DROP POLICY IF EXISTS documentos_storage_insert_policy ON storage.objects;
CREATE POLICY documentos_storage_insert_policy ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos'
    AND owner = auth.uid()
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

DROP POLICY IF EXISTS documentos_storage_update_policy ON storage.objects;
CREATE POLICY documentos_storage_update_policy ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (
      (
        owner = auth.uid()
        AND (storage.foldername(name))[1] = public.current_empresa_id()::text
      )
      OR EXISTS (
        SELECT 1
        FROM public.documentos d
        WHERE d.storage_bucket = objects.bucket_id
          AND d.storage_path = objects.name
          AND public.current_user_has_permission(d.empresa_id, 'documentos:manage')
      )
    )
  )
  WITH CHECK (
    bucket_id = 'documentos'
    AND (
      (
        owner = auth.uid()
        AND (storage.foldername(name))[1] = public.current_empresa_id()::text
      )
      OR EXISTS (
        SELECT 1
        FROM public.documentos d
        WHERE d.storage_bucket = objects.bucket_id
          AND d.storage_path = objects.name
          AND public.current_user_has_permission(d.empresa_id, 'documentos:manage')
      )
    )
  );

DROP POLICY IF EXISTS documentos_storage_delete_policy ON storage.objects;
CREATE POLICY documentos_storage_delete_policy ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (
      (
        owner = auth.uid()
        AND (storage.foldername(name))[1] = public.current_empresa_id()::text
      )
      OR EXISTS (
        SELECT 1
        FROM public.documentos d
        WHERE d.storage_bucket = objects.bucket_id
          AND d.storage_path = objects.name
          AND public.current_user_has_permission(d.empresa_id, 'documentos:manage')
      )
    )
  );
