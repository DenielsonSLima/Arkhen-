-- EXPAND: prepara tarefas canônicas, revisão opcional e auditoria append-only.
-- Compatível com o frontend anterior: nenhuma RPC legada é revogada neste passo.
BEGIN;

ALTER TABLE public.atividades_tarefas
  ADD COLUMN IF NOT EXISTS prazo_legal date,
  ADD COLUMN IF NOT EXISTS prazo_interno date,
  ADD COLUMN IF NOT EXISTS revisor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revisor_nome text,
  ADD COLUMN IF NOT EXISTS evidencia text,
  ADD COLUMN IF NOT EXISTS justificativa_conclusao text,
  ADD COLUMN IF NOT EXISTS conclusao_solicitada_por_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conclusao_solicitada_em timestamptz,
  ADD COLUMN IF NOT EXISTS revisao_status text NOT NULL DEFAULT 'Não necessária',
  ADD COLUMN IF NOT EXISTS revisado_por_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revisado_em timestamptz,
  ADD COLUMN IF NOT EXISTS concluido_por_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS concluido_em timestamptz;

-- Colunas históricas permanecem; os novos campos nunca são preenchidos por backfill
-- presumido. O ambiente validado não possui tarefas concluídas neste momento.
UPDATE public.atividades_tarefas
SET prazo_legal = coalesce(prazo_legal, vencimento),
    prazo_interno = coalesce(prazo_interno, vencimento),
    revisao_status = CASE
      WHEN revisor_user_id IS NULL THEN 'Não necessária'
      WHEN revisao_status = 'Não necessária' THEN 'Pendente'
      ELSE revisao_status
    END
WHERE prazo_legal IS NULL
   OR prazo_interno IS NULL
   OR (revisor_user_id IS NOT NULL AND revisao_status = 'Não necessária');

ALTER TABLE public.atividades_tarefas
  DROP CONSTRAINT IF EXISTS atividades_tarefas_status_check,
  DROP CONSTRAINT IF EXISTS atividades_tarefas_status_operacional_chk,
  ADD CONSTRAINT atividades_tarefas_status_operacional_chk
    CHECK (status IN (
      'Pendente', 'Em andamento', 'Aguardando revisão', 'Concluída', 'Cancelada'
    )),
  DROP CONSTRAINT IF EXISTS atividades_tarefas_revisao_status_chk,
  ADD CONSTRAINT atividades_tarefas_revisao_status_chk
    CHECK (revisao_status IN ('Não necessária', 'Pendente', 'Aprovada', 'Rejeitada')),
  DROP CONSTRAINT IF EXISTS atividades_tarefas_prazos_chk,
  ADD CONSTRAINT atividades_tarefas_prazos_chk
    CHECK (prazo_legal IS NULL OR prazo_interno IS NULL OR prazo_interno <= prazo_legal),
  DROP CONSTRAINT IF EXISTS atividades_tarefas_revisor_distinto_chk,
  ADD CONSTRAINT atividades_tarefas_revisor_distinto_chk
    CHECK (revisor_user_id IS NULL OR revisor_user_id IS DISTINCT FROM responsavel_user_id),
  DROP CONSTRAINT IF EXISTS atividades_tarefas_evidencia_tamanho_chk,
  ADD CONSTRAINT atividades_tarefas_evidencia_tamanho_chk
    CHECK (octet_length(coalesce(evidencia, '')) <= 10000),
  DROP CONSTRAINT IF EXISTS atividades_tarefas_justificativa_tamanho_chk,
  ADD CONSTRAINT atividades_tarefas_justificativa_tamanho_chk
    CHECK (octet_length(coalesce(justificativa_conclusao, '')) <= 4000);

CREATE INDEX IF NOT EXISTS idx_atividades_tarefas_fluxo_competencia
  ON public.atividades_tarefas (
    empresa_id, competencia, cliente_id, modelo_id, vencimento, id
  )
  WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_atividades_tarefas_revisor
  ON public.atividades_tarefas (empresa_id, revisor_user_id, revisao_status)
  WHERE ativo = true AND revisor_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS atividades_tarefas_id_empresa_id_unq
  ON public.atividades_tarefas (id, empresa_id);

CREATE OR REPLACE FUNCTION public.usuario_pode_revisar_atividade(
  p_empresa_id uuid,
  p_auth_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_empresa_id IS NOT NULL
    AND p_auth_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.configuracoes_usuarios usuario
      WHERE usuario.empresa_id = p_empresa_id
        AND usuario.auth_user_id = p_auth_user_id
        AND usuario.status = 'Ativo'
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.perfis membro
        WHERE membro.empresa_id = p_empresa_id
          AND membro.user_id = p_auth_user_id
          AND membro.ativo = true
          AND membro.papel = 'admin'
      )
      OR EXISTS (
        SELECT 1
        FROM public.configuracoes_usuarios usuario
        JOIN public.configuracoes_perfis_acesso perfil
          ON perfil.empresa_id = usuario.empresa_id
         AND perfil.ativo = true
         AND (
           perfil.id = usuario.perfil_id
           OR lower(perfil.nome) = lower(coalesce(usuario.perfil, ''))
         )
        WHERE usuario.empresa_id = p_empresa_id
          AND usuario.auth_user_id = p_auth_user_id
          AND usuario.status = 'Ativo'
          AND perfil.permissoes && ARRAY[
            'atividades:manage', 'atividades:update-own'
          ]::text[]
      )
    );
$$;

REVOKE ALL ON FUNCTION public.usuario_pode_revisar_atividade(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.listar_revisores_atividade()
RETURNS TABLE (config_usuario_id uuid, user_id uuid, nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT usuario.id, usuario.auth_user_id, usuario.nome
  FROM public.configuracoes_usuarios usuario
  WHERE usuario.empresa_id = public.current_empresa_id()
    AND usuario.status = 'Ativo'
    AND usuario.auth_user_id IS NOT NULL
    AND public.current_user_access_allowed(usuario.empresa_id)
    AND (
      public.current_user_has_permission(usuario.empresa_id, 'atividades:manage')
      OR public.current_user_has_permission(usuario.empresa_id, 'atividades:update-own')
    )
    AND public.usuario_pode_revisar_atividade(
      usuario.empresa_id, usuario.auth_user_id
    )
  ORDER BY usuario.nome, usuario.id;
$$;

REVOKE ALL ON FUNCTION public.listar_revisores_atividade()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.listar_revisores_atividade() TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.atividades_tarefas tarefa
    WHERE tarefa.modelo_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.atividades_modelos modelo
        WHERE modelo.id = tarefa.modelo_id
          AND modelo.empresa_id = tarefa.empresa_id
      )
  ) THEN
    RAISE EXCEPTION 'Existem tarefas com modelo de outro tenant.';
  END IF;
END;
$$;

ALTER TABLE public.atividades_tarefas
  DROP CONSTRAINT IF EXISTS atividades_tarefas_modelo_id_fkey,
  DROP CONSTRAINT IF EXISTS atividades_tarefas_modelo_tenant_fkey,
  ADD CONSTRAINT atividades_tarefas_modelo_tenant_fkey
    FOREIGN KEY (modelo_id, empresa_id)
    REFERENCES public.atividades_modelos (id, empresa_id)
    ON DELETE SET NULL (modelo_id);

CREATE OR REPLACE FUNCTION public.validar_revisor_tarefa_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_nome text;
BEGIN
  IF NEW.revisor_user_id IS NULL THEN
    NEW.revisor_nome := NULL;
    IF NEW.revisao_status IS NULL OR NEW.revisao_status = 'Pendente' THEN
      NEW.revisao_status := 'Não necessária';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.revisor_user_id = NEW.responsavel_user_id THEN
    RAISE EXCEPTION 'Responsável e revisor devem ser pessoas diferentes'
      USING ERRCODE = '23514';
  END IF;

  SELECT usuario.nome INTO v_nome
  FROM public.configuracoes_usuarios usuario
  WHERE usuario.empresa_id = NEW.empresa_id
    AND usuario.auth_user_id = NEW.revisor_user_id
    AND usuario.status = 'Ativo'
    AND public.usuario_pode_revisar_atividade(
      usuario.empresa_id, usuario.auth_user_id
    )
  ORDER BY (usuario.perfil_id IS NOT NULL) DESC, usuario.created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Revisor não pertence à empresa ativa'
      USING ERRCODE = '23514';
  END IF;
  NEW.revisor_nome := v_nome;
  IF NEW.revisao_status = 'Não necessária' THEN
    NEW.revisao_status := 'Pendente';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validar_revisor_tarefa_tenant()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS validar_revisor_tarefa_tenant
  ON public.atividades_tarefas;
CREATE TRIGGER validar_revisor_tarefa_tenant
BEFORE INSERT OR UPDATE OF empresa_id, responsavel_user_id, revisor_user_id,
  revisor_nome, revisao_status
ON public.atividades_tarefas
FOR EACH ROW EXECUTE FUNCTION public.validar_revisor_tarefa_tenant();

DROP POLICY IF EXISTS atividades_tarefas_select_scope
  ON public.atividades_tarefas;
CREATE POLICY atividades_tarefas_select_scope
ON public.atividades_tarefas FOR SELECT TO authenticated
USING (
  public.current_user_can_access_client_row(empresa_id, cliente_id)
  AND (
    public.current_user_has_permission(empresa_id, 'atividades:manage')
    OR (
      public.current_user_has_permission(empresa_id, 'atividades:view')
      AND (responsavel_user_id = auth.uid() OR revisor_user_id = auth.uid())
    )
    OR (
      revisor_user_id = auth.uid()
      AND public.current_user_has_permission(empresa_id, 'atividades:update-own')
    )
    OR (
      cliente_id IS NOT NULL
      AND public.current_user_has_permission(empresa_id, 'atividades:view-own')
      AND public.current_user_has_client_access(empresa_id, cliente_id)
    )
  )
);

CREATE OR REPLACE FUNCTION public.atividade_checklist_valido(p_checklist jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_total integer;
  v_titulos integer;
BEGIN
  IF jsonb_typeof(p_checklist) IS DISTINCT FROM 'array' THEN
    RETURN false;
  END IF;
  v_total := jsonb_array_length(p_checklist);
  IF v_total < 1 OR v_total > 100 THEN RETURN false; END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_checklist) item
    WHERE jsonb_typeof(item) IS DISTINCT FROM 'object'
       OR NULLIF(btrim(item ->> 'titulo'), '') IS NULL
       OR octet_length(item ->> 'titulo') > 500
       OR jsonb_typeof(item -> 'concluida') IS DISTINCT FROM 'boolean'
       OR EXISTS (
         SELECT 1 FROM jsonb_object_keys(item) chave
         WHERE chave NOT IN ('titulo', 'concluida')
       )
  ) THEN
    RETURN false;
  END IF;

  SELECT count(DISTINCT lower(btrim(item ->> 'titulo')))
  INTO v_titulos
  FROM jsonb_array_elements(p_checklist) item;
  RETURN v_titulos = v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.atividade_checklist_valido(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.atividades_tarefa_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  tarefa_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN (
    'criada', 'checklist', 'conclusao_solicitada', 'concluida', 'revisao_aprovada',
    'revisao_rejeitada', 'reaberta', 'arquivada', 'dados_atualizados'
  )),
  ator_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  ator_nome text NOT NULL,
  motivo text,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atividades_tarefa_eventos_tarefa_tenant_fkey
    FOREIGN KEY (tarefa_id, empresa_id)
    REFERENCES public.atividades_tarefas (id, empresa_id)
    ON DELETE CASCADE,
  CONSTRAINT atividades_tarefa_eventos_motivo_tamanho_chk
    CHECK (octet_length(coalesce(motivo, '')) <= 4000),
  CONSTRAINT atividades_tarefa_eventos_dados_objeto_chk
    CHECK (jsonb_typeof(dados) = 'object' AND octet_length(dados::text) <= 32768)
);

CREATE INDEX IF NOT EXISTS idx_atividades_tarefa_eventos_tarefa_data
  ON public.atividades_tarefa_eventos (empresa_id, tarefa_id, criado_em DESC, id);

ALTER TABLE public.atividades_tarefa_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS atividades_tarefa_eventos_select_scope
  ON public.atividades_tarefa_eventos;
CREATE POLICY atividades_tarefa_eventos_select_scope
ON public.atividades_tarefa_eventos FOR SELECT TO authenticated
USING (
  empresa_id = public.current_empresa_id()
  AND (
    public.current_user_has_permission(empresa_id, 'atividades:manage')
    OR EXISTS (
      SELECT 1
      FROM public.atividades_tarefas tarefa
      WHERE tarefa.id = atividades_tarefa_eventos.tarefa_id
        AND tarefa.empresa_id = atividades_tarefa_eventos.empresa_id
        AND public.current_user_can_access_client_row(tarefa.empresa_id, tarefa.cliente_id)
        AND (
          (
            (
              public.current_user_has_permission(tarefa.empresa_id, 'atividades:view')
              OR public.current_user_has_permission(tarefa.empresa_id, 'atividades:update-own')
            )
            AND (
              tarefa.responsavel_user_id = auth.uid()
              OR tarefa.revisor_user_id = auth.uid()
            )
          )
          OR (
            tarefa.cliente_id IS NOT NULL
            AND public.current_user_has_permission(tarefa.empresa_id, 'atividades:view-own')
            AND public.current_user_has_client_access(tarefa.empresa_id, tarefa.cliente_id)
          )
        )
    )
  )
);

REVOKE ALL ON TABLE public.atividades_tarefa_eventos
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.atividades_tarefa_eventos TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_evento_tarefa_operacional(
  p_empresa_id uuid,
  p_tarefa_id uuid,
  p_tipo text,
  p_motivo text DEFAULT NULL,
  p_dados jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_nome text;
BEGIN
  IF auth.uid() IS NULL OR p_empresa_id IS NULL OR p_tarefa_id IS NULL
     OR p_tipo IS NULL OR jsonb_typeof(p_dados) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Evento operacional inválido' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(
    (SELECT NULLIF(btrim(usuario.nome), '')
     FROM public.configuracoes_usuarios usuario
     WHERE usuario.empresa_id = p_empresa_id
       AND usuario.auth_user_id = auth.uid()
       AND usuario.status = 'Ativo'
     ORDER BY (usuario.perfil_id IS NOT NULL) DESC, usuario.created_at DESC
     LIMIT 1),
    auth.uid()::text
  ) INTO v_nome;

  INSERT INTO public.atividades_tarefa_eventos (
    empresa_id, tarefa_id, tipo, ator_user_id, ator_nome, motivo, dados
  ) VALUES (
    p_empresa_id, p_tarefa_id, p_tipo, auth.uid(), v_nome,
    NULLIF(btrim(p_motivo), ''), coalesce(p_dados, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_evento_tarefa_operacional(
  uuid, uuid, text, text, jsonb
) FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
