-- Torna Protocolos e Conformidade projeções de registros operacionais reais.
-- A autoria e os horários de conclusão são derivados no servidor.

ALTER TABLE public.protocolos_entregas
  ADD COLUMN IF NOT EXISTS concluido_por_user_id uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS protocolos_entregas_policy ON public.protocolos_entregas;
DROP POLICY IF EXISTS protocolos_entregas_select ON public.protocolos_entregas;
CREATE POLICY protocolos_entregas_select
  ON public.protocolos_entregas
  FOR SELECT TO authenticated
  USING (
    public.current_user_can_access_client_row(empresa_id, cliente_id)
    AND (
      public.current_user_has_permission(empresa_id, 'protocolos:view')
      OR public.current_user_has_permission(empresa_id, 'protocolos:create')
      OR public.current_user_has_permission(empresa_id, 'protocolos:manage')
      OR public.current_user_has_permission(empresa_id, 'protocolos:view-own')
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.protocolos_entregas FROM authenticated;

DROP POLICY IF EXISTS configuracoes_protocolos_empresas_policy
  ON public.configuracoes_protocolos_empresas;
DROP POLICY IF EXISTS configuracoes_protocolos_empresas_select
  ON public.configuracoes_protocolos_empresas;
DROP POLICY IF EXISTS configuracoes_protocolos_empresas_insert
  ON public.configuracoes_protocolos_empresas;
DROP POLICY IF EXISTS configuracoes_protocolos_empresas_update
  ON public.configuracoes_protocolos_empresas;
DROP POLICY IF EXISTS configuracoes_protocolos_empresas_delete
  ON public.configuracoes_protocolos_empresas;

CREATE POLICY configuracoes_protocolos_empresas_select
  ON public.configuracoes_protocolos_empresas
  FOR SELECT TO authenticated
  USING (
    public.current_user_can_access_client_row(empresa_id, cliente_id)
    AND (
      public.current_user_has_permission(empresa_id, 'protocolos:view')
      OR public.current_user_has_permission(empresa_id, 'protocolos:create')
      OR public.current_user_has_permission(empresa_id, 'protocolos:manage')
      OR public.current_user_has_permission(empresa_id, 'protocolos:view-own')
    )
  );

CREATE POLICY configuracoes_protocolos_empresas_insert
  ON public.configuracoes_protocolos_empresas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_can_access_client_row(empresa_id, cliente_id)
    AND public.current_user_has_permission(empresa_id, 'protocolos:manage')
  );

CREATE POLICY configuracoes_protocolos_empresas_update
  ON public.configuracoes_protocolos_empresas
  FOR UPDATE TO authenticated
  USING (
    public.current_user_can_access_client_row(empresa_id, cliente_id)
    AND public.current_user_has_permission(empresa_id, 'protocolos:manage')
  )
  WITH CHECK (
    public.current_user_can_access_client_row(empresa_id, cliente_id)
    AND public.current_user_has_permission(empresa_id, 'protocolos:manage')
  );

CREATE POLICY configuracoes_protocolos_empresas_delete
  ON public.configuracoes_protocolos_empresas
  FOR DELETE TO authenticated
  USING (
    public.current_user_can_access_client_row(empresa_id, cliente_id)
    AND public.current_user_has_permission(empresa_id, 'protocolos:manage')
  );

CREATE OR REPLACE FUNCTION public.atualizar_protocolo_entrega(p_payload jsonb)
RETURNS public.protocolos_entregas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_cliente_id uuid;
  v_id text;
  v_entrega_id text;
  v_competencia text;
  v_periodo text;
  v_periodo_key text;
  v_status text;
  v_anotacao text;
  v_autor text;
  v_agora timestamptz := now();
  v_resultado public.protocolos_entregas%rowtype;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR p_payload = '{}'::jsonb
     OR octet_length(p_payload::text) > 16384 THEN
    RAISE EXCEPTION 'Solicitação de protocolo inválida' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_payload) campo(chave)
    WHERE campo.chave <> ALL(ARRAY[
      'id', 'cliente_id', 'entrega_id', 'competencia',
      'periodo_referencia', 'status', 'anotacao'
    ]::text[])
  ) THEN
    RAISE EXCEPTION 'Campo de protocolo não permitido' USING ERRCODE = '22023';
  END IF;

  IF NOT (
    public.current_user_has_permission(v_empresa_id, 'protocolos:manage')
    OR public.current_user_has_permission(v_empresa_id, 'protocolos:create')
  ) THEN
    RAISE EXCEPTION 'Protocolo não encontrado';
  END IF;

  BEGIN
    v_cliente_id := NULLIF(p_payload ->> 'cliente_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Cliente inválido' USING ERRCODE = '22023';
  END;

  v_id := btrim(coalesce(p_payload ->> 'id', ''));
  v_entrega_id := btrim(coalesce(p_payload ->> 'entrega_id', ''));
  v_competencia := btrim(coalesce(p_payload ->> 'competencia', ''));
  v_periodo := btrim(coalesce(p_payload ->> 'periodo_referencia', ''));
  v_status := NULLIF(btrim(p_payload ->> 'status'), '');
  v_anotacao := NULLIF(btrim(p_payload ->> 'anotacao'), '');

  IF v_cliente_id IS NULL OR v_id = '' OR octet_length(v_id) > 500
     OR v_entrega_id = '' OR octet_length(v_entrega_id) > 180
     OR v_competencia !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
     OR v_periodo NOT IN ('Mensal', '1ª quinzena', '2ª quinzena', 'Trimestral', 'Semestral')
     OR (v_status IS NOT NULL AND v_status NOT IN ('Pendente', 'Concluído'))
     OR (v_anotacao IS NOT NULL AND octet_length(v_anotacao) > 4000)
     OR (v_status IS NULL AND v_anotacao IS NULL) THEN
    RAISE EXCEPTION 'Dados de protocolo inválidos' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = v_cliente_id
      AND c.empresa_id = v_empresa_id
      AND public.current_user_can_access_client_row(c.empresa_id, c.id)
  ) THEN
    RAISE EXCEPTION 'Protocolo não encontrado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.configuracoes_protocolos_empresas cfg
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(cfg.configs) = 'array' THEN cfg.configs ELSE '[]'::jsonb END
    ) item
    WHERE cfg.empresa_id = v_empresa_id
      AND cfg.cliente_id = v_cliente_id
      AND item ->> 'entregaId' = v_entrega_id
      AND item ->> 'ativo' = 'true'
  ) THEN
    RAISE EXCEPTION 'Protocolo não configurado para o cliente';
  END IF;

  v_periodo_key := CASE v_periodo
    WHEN '1ª quinzena' THEN 'q1'
    WHEN '2ª quinzena' THEN 'q2'
    WHEN 'Trimestral' THEN 'trimestral'
    WHEN 'Semestral' THEN 'semestral'
    ELSE 'mensal'
  END;
  IF v_id <> v_cliente_id::text || '-' || v_competencia || '-' || v_entrega_id || '-' || v_periodo_key THEN
    RAISE EXCEPTION 'Identificador de protocolo inválido' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(
    (SELECT NULLIF(btrim(u.nome), '')
     FROM public.configuracoes_usuarios u
     WHERE u.empresa_id = v_empresa_id
       AND u.auth_user_id = auth.uid()
       AND u.status = 'Ativo'
     ORDER BY (u.perfil_id IS NOT NULL) DESC, u.created_at DESC
     LIMIT 1),
    (SELECT NULLIF(btrim(p.nome), '')
     FROM public.perfis p
     WHERE p.empresa_id = v_empresa_id
       AND p.user_id = auth.uid()
       AND p.ativo = true
     LIMIT 1),
    auth.uid()::text
  ) INTO v_autor;

  INSERT INTO public.protocolos_entregas (
    id, empresa_id, cliente_id, entrega_id, competencia, periodo_referencia,
    status, recebido_em, concluido_por, concluido_por_user_id,
    anotacoes_list, atualizado_em
  ) VALUES (
    v_id, v_empresa_id, v_cliente_id, v_entrega_id, v_competencia, v_periodo,
    coalesce(v_status, 'Pendente'),
    CASE WHEN v_status = 'Concluído' THEN v_agora ELSE NULL END,
    CASE WHEN v_status = 'Concluído' THEN v_autor ELSE NULL END,
    CASE WHEN v_status = 'Concluído' THEN auth.uid() ELSE NULL END,
    CASE WHEN v_anotacao IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'data', v_agora,
        'texto', v_anotacao,
        'autor', v_autor,
        'autorUserId', auth.uid()::text
      )
    ) END,
    v_agora
  )
  ON CONFLICT (id) DO UPDATE SET
    status = coalesce(v_status, protocolos_entregas.status),
    recebido_em = CASE
      WHEN v_status = 'Concluído' AND protocolos_entregas.status IS DISTINCT FROM 'Concluído' THEN v_agora
      WHEN v_status = 'Pendente' THEN NULL
      ELSE protocolos_entregas.recebido_em
    END,
    concluido_por = CASE
      WHEN v_status = 'Concluído' AND protocolos_entregas.status IS DISTINCT FROM 'Concluído' THEN v_autor
      WHEN v_status = 'Pendente' THEN NULL
      ELSE protocolos_entregas.concluido_por
    END,
    concluido_por_user_id = CASE
      WHEN v_status = 'Concluído' AND protocolos_entregas.status IS DISTINCT FROM 'Concluído' THEN auth.uid()
      WHEN v_status = 'Pendente' THEN NULL
      ELSE protocolos_entregas.concluido_por_user_id
    END,
    anotacoes_list = CASE WHEN v_anotacao IS NULL THEN protocolos_entregas.anotacoes_list ELSE
      CASE WHEN jsonb_typeof(protocolos_entregas.anotacoes_list) = 'array'
        THEN protocolos_entregas.anotacoes_list ELSE '[]'::jsonb END
      || jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid()::text,
        'data', v_agora,
        'texto', v_anotacao,
        'autor', v_autor,
        'autorUserId', auth.uid()::text
      ))
    END,
    atualizado_em = v_agora
  WHERE protocolos_entregas.empresa_id = v_empresa_id
    AND protocolos_entregas.cliente_id = v_cliente_id
    AND protocolos_entregas.entrega_id = v_entrega_id
    AND protocolos_entregas.competencia = v_competencia
    AND protocolos_entregas.periodo_referencia = v_periodo
  RETURNING * INTO v_resultado;

  IF v_resultado.id IS NULL THEN RAISE EXCEPTION 'Protocolo não encontrado'; END IF;
  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.atualizar_protocolo_entrega(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atualizar_protocolo_entrega(jsonb)
  TO authenticated, service_role;

-- O cache legado não pode mais criar uma segunda verdade sobre o checklist.
REVOKE INSERT, UPDATE, DELETE ON public.conformidade_obrigacoes FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_conformidade_operacional(p_cliente_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR NOT coalesce(public.current_user_has_permission(v_empresa_id, 'conformidade:view'), false) THEN
    RAISE EXCEPTION 'Conformidade não encontrada';
  END IF;

  IF p_cliente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = p_cliente_id
      AND c.empresa_id = v_empresa_id
      AND public.current_user_can_access_client_row(c.empresa_id, c.id)
  ) THEN
    RAISE EXCEPTION 'Conformidade não encontrada';
  END IF;

  SELECT coalesce(jsonb_agg(item ORDER BY item ->> 'vencimento', item ->> 'clienteNome'), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id', ai.id::text,
      'tipo', CASE tarefa.categoria
        WHEN 'Fiscal' THEN 'fiscal'
        WHEN 'Folha' THEN 'folha'
        WHEN 'Contábil' THEN 'contabil'
        WHEN 'Cliente' THEN 'atendimento'
        ELSE 'atividade'
      END,
      'clienteId', ai.cliente_id::text,
      'clienteNome', ai.cliente_nome,
      'cnpj', coalesce(c.cnpj, ''),
      'competencia', ai.competencia,
      'rotina', coalesce(nullif(am.nome, ''), ai.modelo_codigo),
      'descricao', coalesce(am.descricao, ''),
      'responsavel', coalesce(tarefa.responsavel_nome, ''),
      'vencimento', coalesce(tarefa.vencimento::text, ''),
      'prioridade', CASE
        WHEN tarefa.vencimento IS NULL THEN 'sem-prazo'
        WHEN ai.status <> 'Concluída' AND tarefa.vencimento < current_date THEN 'vermelho'
        WHEN tarefa.prioridade = 'Alta' THEN 'vermelho'
        WHEN ai.status <> 'Concluída' AND tarefa.vencimento <= current_date + 3 THEN 'amarelo'
        WHEN tarefa.prioridade = 'Média' THEN 'amarelo'
        ELSE 'verde'
      END,
      'status', CASE ai.status
        WHEN 'Concluída' THEN 'Concluído'
        WHEN 'Em andamento' THEN 'Em andamento'
        ELSE 'Pendente'
      END,
      'atrasoDias', CASE
        WHEN ai.status <> 'Concluída' AND tarefa.vencimento < current_date
          THEN current_date - tarefa.vencimento
        ELSE 0
      END,
      'regraContrato', null,
      'etapas', coalesce(etapas.lista, '[]'::jsonb),
      'criadoEm', ai.criado_em::text,
      'atualizadoEm', ai.atualizado_em::text
    ) AS item
    FROM public.atividades_instancias ai
    JOIN public.clientes c
      ON c.id = ai.cliente_id AND c.empresa_id = ai.empresa_id
    LEFT JOIN public.atividades_modelos am
      ON am.id = ai.modelo_id AND am.empresa_id = ai.empresa_id
    LEFT JOIN LATERAL (
      SELECT t.vencimento, t.responsavel_nome, t.categoria, t.prioridade
      FROM public.atividades_tarefas t
      WHERE t.empresa_id = ai.empresa_id
        AND t.cliente_id = ai.cliente_id
        AND t.modelo_id IS NOT DISTINCT FROM ai.modelo_id
        AND t.competencia = ai.competencia
        AND t.ativo = true
      ORDER BY t.vencimento NULLS LAST, t.id
      LIMIT 1
    ) tarefa ON true
    LEFT JOIN LATERAL (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', checklist.key,
        'label', checklist.key,
        'concluida', CASE
          WHEN jsonb_typeof(checklist.value) = 'boolean'
            THEN (checklist.value #>> '{}')::boolean
          ELSE false
        END,
        'concluidaEm', nullif(ai.checklist_dates ->> checklist.key, ''),
        'responsavel', nullif(ai.checklist_users ->> checklist.key, '')
      ) ORDER BY coalesce(modelo_etapa.ordem, 2147483647), checklist.key), '[]'::jsonb) AS lista
      FROM jsonb_each(
        CASE WHEN jsonb_typeof(ai.checklists) = 'object' THEN ai.checklists ELSE '{}'::jsonb END
      ) checklist
      LEFT JOIN LATERAL (
        SELECT etapa.ordem
        FROM jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(am.etapas) = 'array' THEN am.etapas ELSE '[]'::jsonb END
        ) WITH ORDINALITY etapa(nome, ordem)
        WHERE etapa.nome = checklist.key
        LIMIT 1
      ) modelo_etapa ON true
    ) etapas ON true
    WHERE ai.empresa_id = v_empresa_id
      AND ai.cliente_id IS NOT NULL
      AND ai.ativo = true
      AND public.current_user_can_access_client_row(ai.empresa_id, ai.cliente_id)
      AND (p_cliente_id IS NULL OR ai.cliente_id = p_cliente_id)
  ) source;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_conformidade_operacional(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_conformidade_operacional(uuid)
  TO authenticated, service_role;
