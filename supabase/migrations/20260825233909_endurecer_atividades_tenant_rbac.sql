-- Versiona o hardening multi-tenant/RBAC do modulo de Atividades sem incluir
-- identificadores ou dados de clientes. Casos ambiguos abortam sem alterar dados.
-- Versao registrada no Supabase de producao: 20260825233909.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.atividades_rotinas r
    JOIN (
      SELECT empresa_id, lower(btrim(nome)) AS nome_chave
      FROM public.clientes
      WHERE NULLIF(btrim(nome), '') IS NOT NULL
      GROUP BY empresa_id, lower(btrim(nome))
      HAVING count(*) > 1
    ) ambiguo
      ON ambiguo.empresa_id = r.empresa_id
     AND ambiguo.nome_chave = lower(btrim(r.cliente_nome))
    WHERE r.cliente_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Existem rotinas com nome de cliente ambiguo; revise os vinculos antes da migration.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.atividades_rotinas r
    WHERE r.cliente_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.clientes c
        WHERE c.id = r.cliente_id AND c.empresa_id = r.empresa_id
      )
  ) THEN
    RAISE EXCEPTION 'Existem rotinas vinculadas a cliente de outro tenant; corrija antes da migration.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.atividades_tarefas t
    WHERE t.rotina_id IS NOT NULL AND t.ativo = true
    GROUP BY t.empresa_id, t.rotina_id, t.vencimento
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Existem tarefas ativas duplicadas por rotina/vencimento; revise antes da migration.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS clientes_id_empresa_id_unq
  ON public.clientes (id, empresa_id);

DO $$
DECLARE
  v_constraint record;
BEGIN
  FOR v_constraint IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.atividades_rotinas'::regclass
      AND con.confrelid = 'public.clientes'::regclass
      AND con.contype = 'f'
      AND EXISTS (
        SELECT 1
        FROM unnest(con.conkey) AS k(attnum)
        JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
        WHERE a.attname = 'cliente_id'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.atividades_rotinas DROP CONSTRAINT %I', v_constraint.conname);
  END LOOP;

  ALTER TABLE public.atividades_rotinas
    ADD CONSTRAINT atividades_rotinas_cliente_tenant_fkey
    FOREIGN KEY (cliente_id, empresa_id)
    REFERENCES public.clientes (id, empresa_id)
    ON DELETE SET NULL (cliente_id);
END;
$$;

DROP INDEX IF EXISTS public.atividades_tarefas_rotina_vencimento_unq;
DROP INDEX IF EXISTS public.atividades_tarefas_rotina_vencimento_ativo_unq;
CREATE UNIQUE INDEX atividades_tarefas_rotina_vencimento_ativo_unq
  ON public.atividades_tarefas (empresa_id, rotina_id, vencimento)
  WHERE rotina_id IS NOT NULL AND ativo = true;

CREATE OR REPLACE FUNCTION public.materializar_atividades_rotinas(p_ate date DEFAULT current_date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_rotina public.atividades_rotinas%rowtype;
  v_execucao date;
  v_checklist jsonb;
  v_criadas integer := 0;
  v_passos integer;
BEGIN
  IF v_empresa_id IS NULL
     OR NOT coalesce(public.current_user_has_permission(v_empresa_id, 'atividades:manage'), false) THEN
    RAISE EXCEPTION 'Sem permissão para materializar rotinas' USING ERRCODE = '42501';
  END IF;
  IF p_ate IS NULL OR p_ate > current_date + 31 THEN
    RAISE EXCEPTION 'Data limite inválida';
  END IF;

  FOR v_rotina IN
    SELECT r.* FROM public.atividades_rotinas r
    WHERE r.empresa_id = v_empresa_id
      AND r.ativa = true
      AND r.proxima_execucao <= p_ate
      AND public.current_user_can_access_client_row(r.empresa_id, r.cliente_id)
    ORDER BY r.proxima_execucao, r.id FOR UPDATE SKIP LOCKED
  LOOP
    v_execucao := v_rotina.proxima_execucao;
    v_passos := 0;
    SELECT coalesce(jsonb_agg(
      CASE jsonb_typeof(item)
        WHEN 'string' THEN jsonb_build_object('titulo', item #>> '{}', 'concluida', false)
        WHEN 'object' THEN item || jsonb_build_object('concluida', false)
        ELSE jsonb_build_object('titulo', item::text, 'concluida', false)
      END
    ), '[]'::jsonb)
    INTO v_checklist
    FROM jsonb_array_elements(coalesce(v_rotina.checklist, '[]'::jsonb)) item;

    WHILE v_execucao <= p_ate AND v_passos < 120 LOOP
      INSERT INTO public.atividades_tarefas (
        empresa_id, rotina_id, modelo_id, cliente_id, titulo, categoria, frequencia,
        responsavel_nome, cliente_nome, competencia, vencimento, prioridade, status,
        origem, checklist, notas, ativo, responsavel_user_id, responsavel_config_usuario_id
      ) VALUES (
        v_rotina.empresa_id, v_rotina.id, v_rotina.modelo_id, v_rotina.cliente_id,
        v_rotina.nome, v_rotina.categoria, v_rotina.frequencia, v_rotina.responsavel_nome,
        v_rotina.cliente_nome, to_char(v_execucao, 'MM/YYYY'), v_execucao,
        v_rotina.prioridade, 'Pendente', 'Rotina', v_checklist, v_rotina.observacoes,
        true, v_rotina.responsavel_user_id, v_rotina.responsavel_config_usuario_id
      )
      ON CONFLICT (empresa_id, rotina_id, vencimento)
        WHERE rotina_id IS NOT NULL AND ativo = true
      DO NOTHING;
      IF FOUND THEN v_criadas := v_criadas + 1; END IF;
      v_execucao := public.proxima_data_rotina(
        v_execucao, v_rotina.frequencia, v_rotina.intervalo_dias,
        v_rotina.incluir_finais_de_semana
      );
      v_passos := v_passos + 1;
    END LOOP;

    UPDATE public.atividades_rotinas
    SET proxima_execucao = v_execucao, atualizado_em = now()
    WHERE id = v_rotina.id AND empresa_id = v_empresa_id;
  END LOOP;
  RETURN v_criadas;
END;
$$;
REVOKE ALL ON FUNCTION public.materializar_atividades_rotinas(date)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.materializar_atividades_rotinas(date)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ensure_atividades_instancias(p_competencia varchar)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_inserted integer := 0;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR NOT coalesce(public.current_user_has_permission(v_empresa_id, 'atividades:manage'), false) THEN
    RAISE EXCEPTION 'Sem permissão para materializar atividades' USING ERRCODE = '42501';
  END IF;
  IF p_competencia IS NULL OR p_competencia !~ '^(0[1-9]|1[0-2])/[0-9]{4}$' THEN
    RAISE EXCEPTION 'Competência inválida';
  END IF;

  UPDATE public.atividades_instancias ai
  SET cliente_nome = c.nome, modelo_codigo = am.codigo, atualizado_em = now()
  FROM public.clientes c, public.atividades_modelos am
  WHERE ai.empresa_id = v_empresa_id AND ai.cliente_id = c.id AND ai.modelo_id = am.id
    AND c.empresa_id = v_empresa_id AND am.empresa_id = v_empresa_id
    AND ai.ativo = true AND ai.competencia = p_competencia
    AND public.current_user_can_access_client_row(ai.empresa_id, ai.cliente_id)
    AND (ai.cliente_nome IS DISTINCT FROM c.nome OR ai.modelo_codigo IS DISTINCT FROM am.codigo);

  WITH inserted AS (
    INSERT INTO public.atividades_instancias (
      empresa_id, cliente_id, modelo_id, cliente_nome, modelo_codigo, competencia,
      status, checklists, checklist_dates, checklist_users, valores, ativo
    )
    SELECT c.empresa_id, c.id, am.id, c.nome, am.codigo, p_competencia, 'Pendente',
      checklist.checklists, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, true
    FROM public.clientes c
    JOIN public.atividades_modelos am
      ON am.empresa_id = c.empresa_id AND am.ativo = true
     AND am.id::text = ANY(c.modelos_ativos)
    CROSS JOIN LATERAL (
      SELECT coalesce(jsonb_object_agg(etapa.nome, false), '{}'::jsonb) AS checklists
      FROM jsonb_array_elements_text(am.etapas) AS etapa(nome)
    ) checklist
    WHERE c.empresa_id = v_empresa_id
      AND c.status = 'Ativa'
      AND public.current_user_can_access_client_row(c.empresa_id, c.id)
    ON CONFLICT (empresa_id, cliente_id, modelo_id, competencia)
      WHERE ativo = true AND cliente_id IS NOT NULL AND modelo_id IS NOT NULL
    DO NOTHING RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM inserted;
  RETURN v_inserted;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_atividades_instancias(varchar)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_atividades_instancias(varchar)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.atualizar_atividade_checklist(
  p_instancia_id uuid, p_etapa text, p_concluida boolean,
  p_data_hora timestamptz DEFAULT now()
)
RETURNS public.atividades_instancias
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_instancia public.atividades_instancias%rowtype;
  v_usuario text;
  v_checklists jsonb;
  v_status text;
  v_agora timestamptz := now();
  v_autorizado boolean;
BEGIN
  -- p_data_hora e mantido somente por compatibilidade; a auditoria usa v_agora.
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR NULLIF(btrim(p_etapa), '') IS NULL OR p_concluida IS NULL THEN
    RAISE EXCEPTION 'Solicitação inválida';
  END IF;

  SELECT i.* INTO v_instancia
  FROM public.atividades_instancias i
  WHERE i.id = p_instancia_id
    AND i.empresa_id = v_empresa_id
    AND i.ativo = true
    AND public.current_user_can_access_client_row(i.empresa_id, i.cliente_id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atividade não encontrada'; END IF;

  v_autorizado :=
    public.current_user_has_permission(v_empresa_id, 'atividades:manage')
    OR (
      public.current_user_has_permission(v_empresa_id, 'atividades:update-own')
      AND (
        (
          v_instancia.cliente_id IS NOT NULL
          AND public.current_user_has_client_access(v_empresa_id, v_instancia.cliente_id)
        )
        OR EXISTS (
          SELECT 1
          FROM public.atividades_tarefas t
          WHERE t.empresa_id = v_empresa_id
            AND t.cliente_id IS NOT DISTINCT FROM v_instancia.cliente_id
            AND t.modelo_id IS NOT DISTINCT FROM v_instancia.modelo_id
            AND t.competencia = v_instancia.competencia
            AND t.responsavel_user_id = auth.uid()
            AND t.ativo = true
        )
      )
    );
  IF NOT coalesce(v_autorizado, false) THEN RAISE EXCEPTION 'Atividade não encontrada'; END IF;

  IF jsonb_typeof(v_instancia.checklists) IS DISTINCT FROM 'object'
     OR NOT (v_instancia.checklists ? p_etapa) THEN
    RAISE EXCEPTION 'Etapa de checklist inválida';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each(v_instancia.checklists) item
    WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'boolean'
  ) THEN
    RAISE EXCEPTION 'Etapa de checklist inválida';
  END IF;

  SELECT coalesce(
    (SELECT NULLIF(btrim(u.nome), '') FROM public.configuracoes_usuarios u
     WHERE u.empresa_id = v_empresa_id AND u.auth_user_id = auth.uid()
       AND u.status = 'Ativo' LIMIT 1),
    (SELECT NULLIF(btrim(p.nome), '') FROM public.perfis p
     WHERE p.empresa_id = v_empresa_id AND p.user_id = auth.uid()
       AND p.ativo = true LIMIT 1),
    auth.uid()::text
  ) INTO v_usuario;

  v_checklists := jsonb_set(v_instancia.checklists, ARRAY[p_etapa], to_jsonb(p_concluida), false);
  SELECT CASE
    WHEN count(*) > 0 AND bool_and((item.value #>> '{}')::boolean) THEN 'Concluída'
    WHEN bool_or((item.value #>> '{}')::boolean) THEN 'Em andamento'
    ELSE 'Pendente'
  END INTO v_status FROM jsonb_each(v_checklists) item;

  UPDATE public.atividades_instancias
  SET checklists = v_checklists,
      checklist_dates = jsonb_set(
        CASE WHEN jsonb_typeof(checklist_dates) = 'object' THEN checklist_dates ELSE '{}'::jsonb END,
        ARRAY[p_etapa], CASE WHEN p_concluida THEN to_jsonb(v_agora) ELSE 'null'::jsonb END, true
      ),
      checklist_users = jsonb_set(
        CASE WHEN jsonb_typeof(checklist_users) = 'object' THEN checklist_users ELSE '{}'::jsonb END,
        ARRAY[p_etapa], CASE WHEN p_concluida THEN to_jsonb(v_usuario) ELSE 'null'::jsonb END, true
      ),
      status = v_status, atualizado_em = v_agora
  WHERE id = p_instancia_id AND empresa_id = v_empresa_id
  RETURNING * INTO v_instancia;
  RETURN v_instancia;
END;
$$;
REVOKE ALL ON FUNCTION public.atualizar_atividade_checklist(uuid, text, boolean, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atualizar_atividade_checklist(uuid, text, boolean, timestamptz)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.atualizar_atividade_valores(
  p_instancia_id uuid, p_valores jsonb
)
RETURNS public.atividades_instancias
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_instancia public.atividades_instancias%rowtype;
  v_normalizados jsonb;
  v_autorizado boolean;
  v_campos constant text[] := ARRAY[
    'valorInss','valorIrrf','valorReinf','valorPis','valorCofins','valorIrpj',
    'valorCsll','valorRetencao1708','valorRetencao3208','valorRetencao5952',
    'valorIssRetido','valorFunrural'
  ];
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Sem permissão para atualizar valores' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_valores) IS DISTINCT FROM 'object' OR p_valores = '{}'::jsonb THEN
    RAISE EXCEPTION 'Valores inválidos';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_valores) campo(chave)
    WHERE NOT (campo.chave = ANY(v_campos))
  ) THEN
    RAISE EXCEPTION 'Valores inválidos';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each(p_valores) item(chave, valor)
    WHERE CASE
      WHEN jsonb_typeof(item.valor) IS DISTINCT FROM 'number' THEN true
      ELSE (item.valor #>> '{}')::numeric < 0
        OR (item.valor #>> '{}')::numeric > 999999999999.99
    END
  ) THEN
    RAISE EXCEPTION 'Valores inválidos';
  END IF;

  SELECT i.* INTO v_instancia
  FROM public.atividades_instancias i
  WHERE i.id = p_instancia_id
    AND i.empresa_id = v_empresa_id
    AND i.ativo = true
    AND public.current_user_can_access_client_row(i.empresa_id, i.cliente_id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atividade não encontrada'; END IF;

  v_autorizado :=
    public.current_user_has_permission(v_empresa_id, 'atividades:manage')
    OR (
      public.current_user_has_permission(v_empresa_id, 'atividades:update-own')
      AND (
        (
          v_instancia.cliente_id IS NOT NULL
          AND public.current_user_has_client_access(v_empresa_id, v_instancia.cliente_id)
        )
        OR EXISTS (
          SELECT 1
          FROM public.atividades_tarefas t
          WHERE t.empresa_id = v_empresa_id
            AND t.cliente_id IS NOT DISTINCT FROM v_instancia.cliente_id
            AND t.modelo_id IS NOT DISTINCT FROM v_instancia.modelo_id
            AND t.competencia = v_instancia.competencia
            AND t.responsavel_user_id = auth.uid()
            AND t.ativo = true
        )
      )
    );
  IF NOT coalesce(v_autorizado, false) THEN RAISE EXCEPTION 'Atividade não encontrada'; END IF;

  SELECT coalesce(jsonb_object_agg(
    item.chave, to_jsonb(round((item.valor #>> '{}')::numeric, 2))
  ), '{}'::jsonb)
  INTO v_normalizados
  FROM jsonb_each(p_valores) item(chave, valor);

  UPDATE public.atividades_instancias
  SET valores = CASE WHEN jsonb_typeof(valores) = 'object' THEN valores ELSE '{}'::jsonb END
      || v_normalizados,
      atualizado_em = now()
  WHERE id = p_instancia_id AND empresa_id = v_empresa_id AND ativo = true
  RETURNING * INTO v_instancia;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atividade não encontrada'; END IF;
  RETURN v_instancia;
END;
$$;
REVOKE ALL ON FUNCTION public.atualizar_atividade_valores(uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atualizar_atividade_valores(uuid, jsonb)
  TO authenticated, service_role;

ALTER TABLE public.atividades_rotinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividades_tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividades_instancias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS atividades_rotinas_insert_manager ON public.atividades_rotinas;
DROP POLICY IF EXISTS atividades_rotinas_update_manager ON public.atividades_rotinas;
DROP POLICY IF EXISTS atividades_rotinas_delete_manager ON public.atividades_rotinas;
CREATE POLICY atividades_rotinas_insert_manager
ON public.atividades_rotinas FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_has_permission(empresa_id, 'atividades:manage')
  AND public.current_user_can_access_client_row(empresa_id, cliente_id)
);
CREATE POLICY atividades_rotinas_update_manager
ON public.atividades_rotinas FOR UPDATE TO authenticated
USING (
  public.current_user_has_permission(empresa_id, 'atividades:manage')
  AND public.current_user_can_access_client_row(empresa_id, cliente_id)
)
WITH CHECK (
  public.current_user_has_permission(empresa_id, 'atividades:manage')
  AND public.current_user_can_access_client_row(empresa_id, cliente_id)
);
CREATE POLICY atividades_rotinas_delete_manager
ON public.atividades_rotinas FOR DELETE TO authenticated
USING (
  public.current_user_has_permission(empresa_id, 'atividades:manage')
  AND public.current_user_can_access_client_row(empresa_id, cliente_id)
);

REVOKE ALL ON TABLE public.atividades_rotinas FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.atividades_tarefas FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.atividades_instancias FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atividades_rotinas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atividades_tarefas TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.atividades_instancias TO authenticated;

-- As policies de leitura existentes permanecem. A escrita direta de rotinas
-- exige permissao de gestor e respeita o cliente vinculado ao perfil.
