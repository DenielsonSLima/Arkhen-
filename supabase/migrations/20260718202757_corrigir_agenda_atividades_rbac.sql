-- Corrige os gatilhos das tabelas operacionais e aplica RBAC por usuário.

CREATE OR REPLACE FUNCTION public.set_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_atualizado_em() FROM PUBLIC;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'agenda_responsaveis',
    'agenda_eventos',
    'atividades_rotinas',
    'atividades_tarefas'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at_%I ON public.%I', v_table, v_table);
    EXECUTE format('DROP TRIGGER IF EXISTS set_%I_updated_at ON public.%I', v_table, v_table);
    EXECUTE format(
      'CREATE TRIGGER set_%I_atualizado_em BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em()',
      v_table,
      v_table
    );
  END LOOP;
END;
$$;

ALTER TABLE public.atividades_rotinas
  ADD COLUMN IF NOT EXISTS responsavel_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.atividades_tarefas
  ADD COLUMN IF NOT EXISTS responsavel_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_atividades_rotinas_empresa_responsavel_user
  ON public.atividades_rotinas(empresa_id, responsavel_user_id)
  WHERE ativa = true;

CREATE INDEX IF NOT EXISTS idx_atividades_tarefas_empresa_responsavel_user
  ON public.atividades_tarefas(empresa_id, responsavel_user_id)
  WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_agenda_responsaveis_empresa_user
  ON public.agenda_responsaveis(empresa_id, user_id)
  WHERE ativo = true;

CREATE OR REPLACE FUNCTION public.current_user_has_permission(
  p_empresa_id uuid,
  p_permission text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.is_empresa_member(p_empresa_id)
    AND (
      EXISTS (
        SELECT 1
        FROM public.perfis p
        WHERE p.user_id = auth.uid()
          AND p.empresa_id = p_empresa_id
          AND p.ativo = true
          AND p.papel = 'admin'
      )
      OR EXISTS (
        SELECT 1
        FROM public.configuracoes_usuarios u
        JOIN public.configuracoes_perfis_acesso pa
          ON pa.empresa_id = u.empresa_id
         AND pa.ativo = true
         AND (
           pa.id = u.perfil_id
           OR (u.perfil_id IS NULL AND lower(pa.nome) = lower(u.perfil))
         )
        WHERE u.empresa_id = p_empresa_id
          AND u.auth_user_id = auth.uid()
          AND u.status = 'Ativo'
          AND p_permission = ANY(pa.permissoes)
      )
    );
$$;

REVOKE ALL ON FUNCTION public.current_user_has_permission(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_permission(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_can_manage_empresa(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.current_user_has_permission(p_empresa_id, 'configuracoes:manage')
      OR public.current_user_has_permission(p_empresa_id, 'usuarios:manage');
$$;

REVOKE ALL ON FUNCTION public.current_user_can_manage_empresa(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_empresa(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.agenda_current_user_can_manage()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.current_user_has_permission(public.current_empresa_id(), 'agenda:manage');
$$;

REVOKE ALL ON FUNCTION public.agenda_current_user_can_manage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agenda_current_user_can_manage() TO authenticated;

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
    RETURN NEW;
  END IF;

  SELECT ar.id
    INTO v_responsavel_id
  FROM public.agenda_responsaveis ar
  WHERE ar.empresa_id = NEW.empresa_id
    AND (ar.user_id = NEW.auth_user_id OR lower(ar.nome) = lower(NEW.nome))
  ORDER BY (ar.user_id = NEW.auth_user_id) DESC, ar.criado_em
  LIMIT 1;

  IF v_responsavel_id IS NULL THEN
    INSERT INTO public.agenda_responsaveis (
      empresa_id, user_id, nome, perfil, status, cor, ativo, ordem
    ) VALUES (
      NEW.empresa_id,
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
    SET user_id = NEW.auth_user_id,
        nome = NEW.nome,
        perfil = NEW.perfil,
        status = NEW.status,
        ativo = true
    WHERE id = v_responsavel_id;
  END IF;

  UPDATE public.atividades_rotinas
  SET responsavel_user_id = NEW.auth_user_id
  WHERE empresa_id = NEW.empresa_id
    AND lower(responsavel_nome) = lower(NEW.nome)
    AND responsavel_user_id IS NULL;

  UPDATE public.atividades_tarefas
  SET responsavel_user_id = NEW.auth_user_id
  WHERE empresa_id = NEW.empresa_id
    AND lower(responsavel_nome) = lower(NEW.nome)
    AND responsavel_user_id IS NULL;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_operational_user_link() FROM PUBLIC;

DROP TRIGGER IF EXISTS sync_operational_user_link_trigger ON public.configuracoes_usuarios;
CREATE TRIGGER sync_operational_user_link_trigger
AFTER INSERT OR UPDATE OF auth_user_id, nome, perfil, status
ON public.configuracoes_usuarios
FOR EACH ROW
EXECUTE FUNCTION public.sync_operational_user_link();

WITH usuarios_vinculados AS (
  SELECT DISTINCT ON (u.empresa_id, u.auth_user_id)
    u.empresa_id,
    u.auth_user_id,
    u.nome,
    u.perfil,
    u.status
  FROM public.configuracoes_usuarios u
  WHERE u.auth_user_id IS NOT NULL
    AND u.status = 'Ativo'
  ORDER BY u.empresa_id, u.auth_user_id, (u.perfil_id IS NOT NULL) DESC, u.created_at DESC
)
UPDATE public.agenda_responsaveis ar
SET user_id = u.auth_user_id,
    perfil = u.perfil,
    status = u.status,
    ativo = true
FROM usuarios_vinculados u
WHERE ar.empresa_id = u.empresa_id
  AND lower(ar.nome) = lower(u.nome)
  AND (ar.user_id IS NULL OR ar.user_id = u.auth_user_id);

WITH usuarios_vinculados AS (
  SELECT DISTINCT ON (u.empresa_id, u.auth_user_id)
    u.empresa_id,
    u.auth_user_id,
    u.nome,
    u.perfil,
    u.status
  FROM public.configuracoes_usuarios u
  WHERE u.auth_user_id IS NOT NULL
    AND u.status = 'Ativo'
  ORDER BY u.empresa_id, u.auth_user_id, (u.perfil_id IS NOT NULL) DESC, u.created_at DESC
)
INSERT INTO public.agenda_responsaveis (
  empresa_id, user_id, nome, perfil, status, cor, ativo, ordem
)
SELECT
  u.empresa_id,
  u.auth_user_id,
  u.nome,
  u.perfil,
  u.status,
  '#2563eb',
  true,
  row_number() OVER (PARTITION BY u.empresa_id ORDER BY u.nome)
    + COALESCE((SELECT max(ar.ordem) FROM public.agenda_responsaveis ar WHERE ar.empresa_id = u.empresa_id), 0)
FROM usuarios_vinculados u
WHERE NOT EXISTS (
  SELECT 1
  FROM public.agenda_responsaveis ar
  WHERE ar.empresa_id = u.empresa_id
    AND (ar.user_id = u.auth_user_id OR lower(ar.nome) = lower(u.nome))
)
ON CONFLICT DO NOTHING;

UPDATE public.atividades_rotinas r
SET responsavel_user_id = u.auth_user_id
FROM public.configuracoes_usuarios u
WHERE u.empresa_id = r.empresa_id
  AND u.auth_user_id IS NOT NULL
  AND u.status = 'Ativo'
  AND lower(u.nome) = lower(r.responsavel_nome)
  AND r.responsavel_user_id IS NULL;

UPDATE public.atividades_tarefas t
SET responsavel_user_id = u.auth_user_id
FROM public.configuracoes_usuarios u
WHERE u.empresa_id = t.empresa_id
  AND u.auth_user_id IS NOT NULL
  AND u.status = 'Ativo'
  AND lower(u.nome) = lower(t.responsavel_nome)
  AND t.responsavel_user_id IS NULL;

-- Empresas e perfis de autenticação.
DROP POLICY IF EXISTS empresas_tenant_policy ON public.empresas;
CREATE POLICY empresas_select_member ON public.empresas
  FOR SELECT TO authenticated
  USING (public.is_empresa_member(id) OR public.is_empresa_member(parent_empresa_id));
CREATE POLICY empresas_insert_manager ON public.empresas
  FOR INSERT TO authenticated
  WITH CHECK (
    parent_empresa_id IS NOT NULL
    AND public.current_user_has_permission(parent_empresa_id, 'configuracoes:manage')
  );
CREATE POLICY empresas_update_manager ON public.empresas
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission(id, 'configuracoes:manage'))
  WITH CHECK (public.current_user_has_permission(id, 'configuracoes:manage'));
CREATE POLICY empresas_delete_manager ON public.empresas
  FOR DELETE TO authenticated
  USING (public.current_user_has_permission(id, 'configuracoes:manage'));

DROP POLICY IF EXISTS perfis_self_select_policy ON public.perfis;
DROP POLICY IF EXISTS perfis_admin_write_policy ON public.perfis;
CREATE POLICY perfis_select_self_or_manager ON public.perfis
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.current_user_has_permission(empresa_id, 'usuarios:manage')
  );
CREATE POLICY perfis_insert_manager ON public.perfis
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission(empresa_id, 'usuarios:manage'));
CREATE POLICY perfis_update_manager ON public.perfis
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission(empresa_id, 'usuarios:manage'))
  WITH CHECK (public.current_user_has_permission(empresa_id, 'usuarios:manage'));
CREATE POLICY perfis_delete_manager ON public.perfis
  FOR DELETE TO authenticated
  USING (public.current_user_has_permission(empresa_id, 'usuarios:manage'));

-- Clientes e configurações administrativas.
DROP POLICY IF EXISTS clientes_tenant_policy ON public.clientes;
CREATE POLICY clientes_select_permission ON public.clientes
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission(empresa_id, 'clientes:view'));
CREATE POLICY clientes_insert_permission ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission(empresa_id, 'clientes:create'));
CREATE POLICY clientes_update_permission ON public.clientes
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission(empresa_id, 'clientes:update'))
  WITH CHECK (public.current_user_has_permission(empresa_id, 'clientes:update'));
CREATE POLICY clientes_delete_permission ON public.clientes
  FOR DELETE TO authenticated
  USING (public.current_user_has_permission(empresa_id, 'clientes:delete'));

DROP POLICY IF EXISTS configuracoes_usuarios_policy ON public.configuracoes_usuarios;
CREATE POLICY configuracoes_usuarios_select_self_or_manager ON public.configuracoes_usuarios
  FOR SELECT TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR public.current_user_has_permission(empresa_id, 'usuarios:manage')
  );
CREATE POLICY configuracoes_usuarios_insert_manager ON public.configuracoes_usuarios
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission(empresa_id, 'usuarios:manage'));
CREATE POLICY configuracoes_usuarios_update_manager ON public.configuracoes_usuarios
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission(empresa_id, 'usuarios:manage'))
  WITH CHECK (public.current_user_has_permission(empresa_id, 'usuarios:manage'));
CREATE POLICY configuracoes_usuarios_delete_manager ON public.configuracoes_usuarios
  FOR DELETE TO authenticated
  USING (public.current_user_has_permission(empresa_id, 'usuarios:manage'));

DROP POLICY IF EXISTS configuracoes_perfis_acesso_policy ON public.configuracoes_perfis_acesso;
CREATE POLICY configuracoes_perfis_acesso_select_member ON public.configuracoes_perfis_acesso
  FOR SELECT TO authenticated
  USING (public.is_empresa_member(empresa_id));
CREATE POLICY configuracoes_perfis_acesso_insert_manager ON public.configuracoes_perfis_acesso
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission(empresa_id, 'perfis:manage'));
CREATE POLICY configuracoes_perfis_acesso_update_manager ON public.configuracoes_perfis_acesso
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission(empresa_id, 'perfis:manage'))
  WITH CHECK (public.current_user_has_permission(empresa_id, 'perfis:manage'));
CREATE POLICY configuracoes_perfis_acesso_delete_manager ON public.configuracoes_perfis_acesso
  FOR DELETE TO authenticated
  USING (public.current_user_has_permission(empresa_id, 'perfis:manage'));

-- Agenda: gestores veem a equipe; cada usuário comum vê e altera apenas os próprios eventos.
DROP POLICY IF EXISTS agenda_responsaveis_empresa_policy ON public.agenda_responsaveis;
CREATE POLICY agenda_responsaveis_select_scope ON public.agenda_responsaveis
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission(empresa_id, 'agenda:manage')
    OR (public.current_user_has_permission(empresa_id, 'agenda:view') AND user_id = auth.uid())
  );
CREATE POLICY agenda_responsaveis_insert_manager ON public.agenda_responsaveis
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission(empresa_id, 'agenda:manage'));
CREATE POLICY agenda_responsaveis_update_manager ON public.agenda_responsaveis
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission(empresa_id, 'agenda:manage'))
  WITH CHECK (public.current_user_has_permission(empresa_id, 'agenda:manage'));
CREATE POLICY agenda_responsaveis_delete_manager ON public.agenda_responsaveis
  FOR DELETE TO authenticated
  USING (public.current_user_has_permission(empresa_id, 'agenda:manage'));

DROP POLICY IF EXISTS agenda_eventos_empresa_policy ON public.agenda_eventos;
CREATE POLICY agenda_eventos_select_scope ON public.agenda_eventos
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission(empresa_id, 'agenda:manage')
    OR (
      public.current_user_has_permission(empresa_id, 'agenda:view')
      AND EXISTS (
        SELECT 1 FROM public.agenda_responsaveis ar
        WHERE ar.id = responsavel_id
          AND ar.empresa_id = agenda_eventos.empresa_id
          AND ar.user_id = auth.uid()
          AND ar.ativo = true
      )
    )
  );
CREATE POLICY agenda_eventos_insert_scope ON public.agenda_eventos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_has_permission(empresa_id, 'agenda:manage')
    OR (
      public.current_user_has_permission(empresa_id, 'agenda:view')
      AND EXISTS (
        SELECT 1 FROM public.agenda_responsaveis ar
        WHERE ar.id = responsavel_id
          AND ar.empresa_id = agenda_eventos.empresa_id
          AND ar.user_id = auth.uid()
          AND ar.ativo = true
      )
    )
  );
CREATE POLICY agenda_eventos_update_scope ON public.agenda_eventos
  FOR UPDATE TO authenticated
  USING (
    public.current_user_has_permission(empresa_id, 'agenda:manage')
    OR EXISTS (
      SELECT 1 FROM public.agenda_responsaveis ar
      WHERE ar.id = responsavel_id
        AND ar.empresa_id = agenda_eventos.empresa_id
        AND ar.user_id = auth.uid()
        AND ar.ativo = true
    )
  )
  WITH CHECK (
    public.current_user_has_permission(empresa_id, 'agenda:manage')
    OR (
      public.current_user_has_permission(empresa_id, 'agenda:view')
      AND EXISTS (
        SELECT 1 FROM public.agenda_responsaveis ar
        WHERE ar.id = responsavel_id
          AND ar.empresa_id = agenda_eventos.empresa_id
          AND ar.user_id = auth.uid()
          AND ar.ativo = true
      )
    )
  );
CREATE POLICY agenda_eventos_delete_scope ON public.agenda_eventos
  FOR DELETE TO authenticated
  USING (
    public.current_user_has_permission(empresa_id, 'agenda:manage')
    OR EXISTS (
      SELECT 1 FROM public.agenda_responsaveis ar
      WHERE ar.id = responsavel_id
        AND ar.empresa_id = agenda_eventos.empresa_id
        AND ar.user_id = auth.uid()
        AND ar.ativo = true
    )
  );

-- Atividades: gestores e perfis com manage veem a equipe; demais usuários apenas a própria fila.
DROP POLICY IF EXISTS atividades_rotinas_empresa_policy ON public.atividades_rotinas;
CREATE POLICY atividades_rotinas_select_scope ON public.atividades_rotinas
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission(empresa_id, 'atividades:manage')
    OR (
      public.current_user_has_permission(empresa_id, 'atividades:view')
      AND responsavel_user_id = auth.uid()
    )
  );
CREATE POLICY atividades_rotinas_insert_manager ON public.atividades_rotinas
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission(empresa_id, 'atividades:manage'));
CREATE POLICY atividades_rotinas_update_manager ON public.atividades_rotinas
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission(empresa_id, 'atividades:manage'))
  WITH CHECK (public.current_user_has_permission(empresa_id, 'atividades:manage'));
CREATE POLICY atividades_rotinas_delete_manager ON public.atividades_rotinas
  FOR DELETE TO authenticated
  USING (public.current_user_has_permission(empresa_id, 'atividades:manage'));

DROP POLICY IF EXISTS atividades_tarefas_empresa_policy ON public.atividades_tarefas;
CREATE POLICY atividades_tarefas_select_scope ON public.atividades_tarefas
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission(empresa_id, 'atividades:manage')
    OR (
      public.current_user_has_permission(empresa_id, 'atividades:view')
      AND responsavel_user_id = auth.uid()
    )
  );
CREATE POLICY atividades_tarefas_insert_scope ON public.atividades_tarefas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_has_permission(empresa_id, 'atividades:manage')
    OR (
      public.current_user_has_permission(empresa_id, 'atividades:update-own')
      AND responsavel_user_id = auth.uid()
    )
  );
CREATE POLICY atividades_tarefas_update_scope ON public.atividades_tarefas
  FOR UPDATE TO authenticated
  USING (
    public.current_user_has_permission(empresa_id, 'atividades:manage')
    OR (
      public.current_user_has_permission(empresa_id, 'atividades:update-own')
      AND responsavel_user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.current_user_has_permission(empresa_id, 'atividades:manage')
    OR (
      public.current_user_has_permission(empresa_id, 'atividades:update-own')
      AND responsavel_user_id = auth.uid()
    )
  );
CREATE POLICY atividades_tarefas_delete_manager ON public.atividades_tarefas
  FOR DELETE TO authenticated
  USING (public.current_user_has_permission(empresa_id, 'atividades:manage'));

-- Documentos continuam visíveis conforme o escopo, mas só o dono ou um gestor pode alterar/excluir.
DROP POLICY IF EXISTS documentos_select_policy ON public.documentos;
DROP POLICY IF EXISTS documentos_insert_policy ON public.documentos;
DROP POLICY IF EXISTS documentos_update_policy ON public.documentos;
DROP POLICY IF EXISTS documentos_delete_policy ON public.documentos;
CREATE POLICY documentos_select_permission ON public.documentos
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission(empresa_id, 'documentos:view')
    AND (scope = 'empresa' OR (scope = 'pessoal' AND owner_user_id = auth.uid()))
  );
CREATE POLICY documentos_insert_permission ON public.documentos
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND (
      public.current_user_has_permission(empresa_id, 'documentos:create')
      OR public.current_user_has_permission(empresa_id, 'documentos:manage')
    )
    AND (
      (scope = 'pessoal' AND cliente_id IS NULL)
      OR (
        scope = 'empresa'
        AND cliente_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.clientes c
          WHERE c.id::text = documentos.cliente_id
            AND c.empresa_id = documentos.empresa_id
        )
      )
    )
  );
CREATE POLICY documentos_update_owner_or_manager ON public.documentos
  FOR UPDATE TO authenticated
  USING (
    public.current_user_has_permission(empresa_id, 'documentos:manage')
    OR owner_user_id = auth.uid()
  )
  WITH CHECK (
    public.current_user_has_permission(empresa_id, 'documentos:manage')
    OR owner_user_id = auth.uid()
  );
CREATE POLICY documentos_delete_owner_or_manager ON public.documentos
  FOR DELETE TO authenticated
  USING (
    public.current_user_has_permission(empresa_id, 'documentos:manage')
    OR owner_user_id = auth.uid()
  );
