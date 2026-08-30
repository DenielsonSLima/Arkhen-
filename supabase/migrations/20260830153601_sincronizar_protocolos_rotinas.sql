BEGIN;
ALTER TABLE public.parametrizacao_prazos_entrega
  DROP CONSTRAINT IF EXISTS parametrizacao_prazos_entrega_fechamento_check,
  ADD CONSTRAINT parametrizacao_prazos_entrega_fechamento_check
  CHECK (fechamento IN (
    'diaria', 'semanal', 'quinzenal', 'mensal',
    'trimestral', 'semestral', 'personalizada'
  ));
ALTER TABLE public.parametrizacao_protocolos_tipos
  DROP CONSTRAINT IF EXISTS parametrizacao_protocolos_tipos_periodicidade_padrao_check,
  ADD CONSTRAINT parametrizacao_protocolos_tipos_periodicidade_padrao_check
  CHECK (periodicidade_padrao IN (
    'diaria', 'semanal', 'quinzenal', 'mensal',
    'trimestral', 'semestral', 'personalizada'
  ));
ALTER TABLE public.atividades_rotinas
  ADD COLUMN IF NOT EXISTS protocolo_codigo text;
ALTER TABLE public.atividades_rotinas
  DROP CONSTRAINT IF EXISTS atividades_rotinas_protocolo_catalogo_tenant_fkey;
ALTER TABLE public.atividades_rotinas
  ADD CONSTRAINT atividades_rotinas_protocolo_catalogo_tenant_fkey
  FOREIGN KEY (empresa_id, protocolo_codigo)
  REFERENCES public.parametrizacao_protocolos_tipos (empresa_id, codigo)
  ON UPDATE RESTRICT
  ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS atividades_rotinas_protocolo_cliente_uidx
  ON public.atividades_rotinas (empresa_id, cliente_id, protocolo_codigo)
  WHERE protocolo_codigo IS NOT NULL;
CREATE OR REPLACE FUNCTION public.validar_configs_protocolos_operacionais(
  p_empresa_id uuid,
  p_cliente_id uuid,
  p_configs jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_regime text;
BEGIN
  SELECT cliente.tipo
  INTO v_regime
  FROM public.clientes cliente
  WHERE cliente.empresa_id = p_empresa_id
    AND cliente.id = p_cliente_id;

  IF NOT FOUND
     OR jsonb_typeof(p_configs) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_configs) > 200
     OR octet_length(p_configs::text) > 65536 THEN
    RAISE EXCEPTION 'Configuração de protocolos inválida.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_configs) item(valor)
    WHERE jsonb_typeof(item.valor) IS DISTINCT FROM 'object'
       OR jsonb_typeof(item.valor -> 'entregaId') IS DISTINCT FROM 'string'
       OR char_length(btrim(item.valor ->> 'entregaId')) NOT BETWEEN 1 AND 180
       OR jsonb_typeof(item.valor -> 'ativo') IS DISTINCT FROM 'boolean'
       OR (
         item.valor ? 'periodicidade'
         AND (
           jsonb_typeof(item.valor -> 'periodicidade') IS DISTINCT FROM 'string'
           OR item.valor ->> 'periodicidade' NOT IN (
             'diaria', 'semanal', 'quinzenal', 'mensal',
             'trimestral', 'semestral', 'personalizada'
           )
         )
       )
       OR (
         item.valor ? 'intervaloDias'
         AND (
           item.valor ->> 'periodicidade' IS DISTINCT FROM 'personalizada'
           OR jsonb_typeof(item.valor -> 'intervaloDias') IS DISTINCT FROM 'number'
           OR (item.valor ->> 'intervaloDias') !~ '^[1-9][0-9]{0,2}$'
           OR (item.valor ->> 'intervaloDias')::integer > 366
         )
       )
       OR (
         item.valor ->> 'periodicidade' = 'personalizada'
         AND NOT (item.valor ? 'intervaloDias')
       )
       OR EXISTS (
         SELECT 1
         FROM jsonb_object_keys(item.valor) chave
         WHERE chave NOT IN ('entregaId', 'ativo', 'periodicidade', 'intervaloDias')
       )
       OR NOT EXISTS (
         SELECT 1
         FROM public.parametrizacao_protocolos_tipos tipo
         WHERE tipo.empresa_id = p_empresa_id
           AND tipo.codigo = btrim(item.valor ->> 'entregaId')
           AND (
             item.valor ->> 'ativo' = 'false'
             OR (tipo.ativo = true AND v_regime = ANY(tipo.regimes))
           )
       )
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_configs) item(valor)
    GROUP BY btrim(item.valor ->> 'entregaId')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'A configuração contém obrigação ausente, inativa ou incompatível com o regime.'
      USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.validar_configs_protocolos_operacionais(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validar_catalogo_configuracao_protocolo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.validar_configs_protocolos_operacionais(
    NEW.empresa_id,
    NEW.cliente_id,
    NEW.configs
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validar_catalogo_configuracao_protocolo()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sincronizar_rotinas_protocolos_cliente(
  p_empresa_id uuid,
  p_cliente_id uuid,
  p_configs jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_regime text;
  v_cliente_nome text;
  v_hoje date := (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_item record;
  v_periodicidade text;
  v_frequencia text;
  v_intervalo_dias integer;
BEGIN
  SELECT cliente.tipo, cliente.nome
  INTO v_regime, v_cliente_nome
  FROM public.clientes cliente
  WHERE cliente.empresa_id = p_empresa_id
    AND cliente.id = p_cliente_id
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado para sincronizar obrigações.'
      USING ERRCODE = '42501';
  END IF;

  FOR v_item IN
    SELECT
      item.valor AS config,
      tipo.codigo,
      tipo.nome,
      tipo.categoria,
      tipo.descricao,
      tipo.periodicidade_padrao,
      prazo.fechamento AS prazo_fechamento
    FROM jsonb_array_elements(p_configs) item(valor)
    JOIN public.parametrizacao_protocolos_tipos tipo
      ON tipo.empresa_id = p_empresa_id
     AND tipo.codigo = btrim(item.valor ->> 'entregaId')
     AND tipo.ativo = true
     AND v_regime = ANY(tipo.regimes)
    LEFT JOIN public.parametrizacao_prazos_entrega prazo
      ON prazo.empresa_id = p_empresa_id
     AND prazo.regime = v_regime
     AND prazo.entrega_id = tipo.codigo
     AND prazo.ativo = true
    WHERE item.valor ->> 'ativo' = 'true'
  LOOP
    v_periodicidade := COALESCE(
      NULLIF(btrim(v_item.config ->> 'periodicidade'), ''),
      v_item.prazo_fechamento,
      v_item.periodicidade_padrao,
      'mensal'
    );

    v_frequencia := CASE v_periodicidade
      WHEN 'diaria' THEN 'Diária'
      WHEN 'semanal' THEN 'Semanal'
      WHEN 'quinzenal' THEN 'Quinzenal'
      WHEN 'mensal' THEN 'Mensal'
      ELSE 'Personalizada'
    END;

    v_intervalo_dias := CASE v_periodicidade
      WHEN 'diaria' THEN 1
      WHEN 'semanal' THEN 7
      WHEN 'quinzenal' THEN 15
      WHEN 'mensal' THEN 30
      WHEN 'trimestral' THEN 90
      WHEN 'semestral' THEN 180
      WHEN 'personalizada' THEN (v_item.config ->> 'intervaloDias')::integer
      ELSE 30
    END;

    INSERT INTO public.atividades_rotinas AS rotina (
      empresa_id,
      cliente_id,
      protocolo_codigo,
      nome,
      categoria,
      frequencia,
      intervalo_dias,
      responsavel_nome,
      cliente_nome,
      proxima_execucao,
      prioridade,
      checklist,
      observacoes,
      incluir_finais_de_semana,
      ativa
    ) VALUES (
      p_empresa_id,
      p_cliente_id,
      v_item.codigo,
      v_item.nome,
      CASE v_item.categoria
        WHEN 'Fiscal' THEN 'Fiscal'
        WHEN 'Trabalhista' THEN 'Folha'
        WHEN 'Financeiro' THEN 'Contábil'
        ELSE 'Cliente'
      END,
      v_frequencia,
      v_intervalo_dias,
      '',
      v_cliente_nome,
      v_hoje,
      'Média',
      jsonb_build_array(v_item.nome),
      COALESCE(NULLIF(btrim(v_item.descricao), ''), 'Rotina gerada pela configuração de obrigações.'),
      false,
      true
    )
    ON CONFLICT (empresa_id, cliente_id, protocolo_codigo)
      WHERE protocolo_codigo IS NOT NULL
    DO UPDATE SET
      nome = EXCLUDED.nome,
      categoria = EXCLUDED.categoria,
      frequencia = EXCLUDED.frequencia,
      intervalo_dias = EXCLUDED.intervalo_dias,
      cliente_nome = EXCLUDED.cliente_nome,
      checklist = EXCLUDED.checklist,
      observacoes = EXCLUDED.observacoes,
      ativa = true,
      proxima_execucao = CASE
        WHEN rotina.ativa IS DISTINCT FROM true
          OR rotina.frequencia IS DISTINCT FROM EXCLUDED.frequencia
          OR rotina.intervalo_dias IS DISTINCT FROM EXCLUDED.intervalo_dias
          THEN v_hoje
        ELSE rotina.proxima_execucao
      END,
      atualizado_em = now();
  END LOOP;

  UPDATE public.atividades_rotinas rotina
  SET ativa = false,
      atualizado_em = now()
  WHERE rotina.empresa_id = p_empresa_id
    AND rotina.cliente_id = p_cliente_id
    AND rotina.protocolo_codigo IS NOT NULL
    AND rotina.ativa = true
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_configs) item(valor)
      WHERE btrim(item.valor ->> 'entregaId') = rotina.protocolo_codigo
        AND item.valor ->> 'ativo' = 'true'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.sincronizar_rotinas_protocolos_cliente(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.atribuir_responsavel_rotina_protocolo(
  p_rotina_id uuid,
  p_responsavel_config_usuario_id uuid
)
RETURNS public.atividades_rotinas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_resultado public.atividades_rotinas%rowtype;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR p_rotina_id IS NULL
     OR p_responsavel_config_usuario_id IS NULL
     OR NOT coalesce(
       public.current_user_has_permission(v_empresa_id, 'atividades:manage'),
       false
     ) THEN
    RAISE EXCEPTION 'Rotina de protocolo não encontrada.' USING ERRCODE = '42501';
  END IF;

  PERFORM 1
  FROM public.atividades_rotinas rotina
  WHERE rotina.id = p_rotina_id
    AND rotina.empresa_id = v_empresa_id
    AND rotina.ativa = true
    AND rotina.protocolo_codigo IS NOT NULL
    AND public.current_user_can_access_client_row(rotina.empresa_id, rotina.cliente_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rotina de protocolo não encontrada.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.configuracoes_usuarios usuario
    WHERE usuario.id = p_responsavel_config_usuario_id
      AND usuario.empresa_id = v_empresa_id
      AND usuario.status = 'Ativo'
  ) THEN
    RAISE EXCEPTION 'Responsável não pertence à empresa ativa.' USING ERRCODE = '23503';
  END IF;

  -- O trigger tenant deriva nome/auth; nenhum dado operacional é regravado.
  UPDATE public.atividades_rotinas
  SET responsavel_config_usuario_id = p_responsavel_config_usuario_id,
      atualizado_em = now()
  WHERE id = p_rotina_id
    AND empresa_id = v_empresa_id
  RETURNING * INTO v_resultado;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.atribuir_responsavel_rotina_protocolo(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atribuir_responsavel_rotina_protocolo(uuid, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_fechamentos_operacionais()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_ver_todas boolean;
  v_ver_proprias boolean;
  v_resultado jsonb;
BEGIN
  v_ver_todas := coalesce(public.current_user_has_permission(v_empresa_id, 'atividades:view'), false)
    OR coalesce(public.current_user_has_permission(v_empresa_id, 'atividades:manage'), false);
  v_ver_proprias := coalesce(public.current_user_has_permission(v_empresa_id, 'atividades:view-own'), false);
  IF auth.uid() IS NULL OR v_empresa_id IS NULL OR NOT (v_ver_todas OR v_ver_proprias) THEN
    RAISE EXCEPTION 'Fechamentos não encontrados.' USING ERRCODE = '42501';
  END IF;

  WITH tarefas AS (
    SELECT tarefa.*, cliente.nome AS cliente_nome_atual, cliente.cnpj, cliente.tipo AS regime,
      cliente.tipo_estabelecimento, CASE tarefa.status
        WHEN 'Concluída' THEN 100 WHEN 'Em andamento' THEN 50 ELSE 0 END AS progresso
    FROM public.atividades_tarefas tarefa
    JOIN public.clientes cliente
      ON cliente.id = tarefa.cliente_id AND cliente.empresa_id = tarefa.empresa_id
    WHERE tarefa.empresa_id = v_empresa_id AND tarefa.ativo = true
      AND tarefa.competencia = to_char(clock_timestamp() AT TIME ZONE 'America/Sao_Paulo', 'MM/YYYY')
      AND public.current_user_can_access_client_row(tarefa.empresa_id, tarefa.cliente_id)
      AND (v_ver_todas OR tarefa.responsavel_user_id = auth.uid())
  ), grupos AS (
    SELECT cliente_id, cliente_nome_atual, cnpj, regime, tipo_estabelecimento, competencia,
      round(avg(progresso))::integer AS progresso_geral,
      CASE WHEN bool_and(progresso = 100) THEN 'Concluída'
        WHEN bool_or(progresso > 0) THEN 'Em andamento' ELSE 'Pendente' END AS status_geral,
      coalesce(string_agg(DISTINCT nullif(responsavel_nome, ''), ', '), '') AS responsavel,
      jsonb_agg(jsonb_build_object(
        'id', id, 'titulo', titulo, 'categoria', categoria, 'frequencia', frequencia,
        'responsavel', coalesce(responsavel_nome, ''),
        'responsavelConfigUsuarioId', responsavel_config_usuario_id,
        'vencimento', vencimento, 'prioridade', prioridade, 'status', status,
        'checklist', coalesce(checklist, '[]'::jsonb), 'notas', coalesce(notas, ''),
        'progresso', progresso
      ) ORDER BY vencimento, id) AS tarefas
    FROM tarefas
    GROUP BY cliente_id, cliente_nome_atual, cnpj, regime, tipo_estabelecimento, competencia
  )
  SELECT jsonb_build_object(
    'grupos', coalesce(jsonb_agg(jsonb_build_object(
      'id', cliente_id::text || '-' || replace(competencia, '/', '-'),
      'clienteId', cliente_id, 'clienteNome', cliente_nome_atual, 'cnpj', coalesce(cnpj, ''),
      'regime', coalesce(regime, ''), 'tipoEstabelecimento', coalesce(tipo_estabelecimento, ''),
      'competencia', competencia, 'responsavel', responsavel,
      'progressoGeral', progresso_geral, 'statusGeral', status_geral, 'tarefas', tarefas
    ) ORDER BY cliente_nome_atual, competencia), '[]'::jsonb),
    'metricas', jsonb_build_object(
      'total', count(*),
      'completed', count(*) FILTER (WHERE status_geral = 'Concluída'),
      'inProgress', count(*) FILTER (WHERE status_geral = 'Em andamento'),
      'pending', count(*) FILTER (WHERE status_geral = 'Pendente')
    )
  )
  INTO v_resultado FROM grupos;
  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.get_fechamentos_operacionais()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_fechamentos_operacionais() TO authenticated;

CREATE OR REPLACE FUNCTION public.salvar_configuracoes_protocolos_cliente(
  p_cliente_id uuid,
  p_configs jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_resultado jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR NOT coalesce(
       public.current_user_has_permission(v_empresa_id, 'protocolos:manage'),
       false
     ) THEN
    RAISE EXCEPTION 'Configuração de protocolos não encontrada.' USING ERRCODE = '42501';
  END IF;

  IF p_cliente_id IS NULL OR NOT coalesce(
    public.current_user_can_access_client_row(v_empresa_id, p_cliente_id), false
  ) THEN
    RAISE EXCEPTION 'Configuração de protocolos não encontrada.' USING ERRCODE = '42501';
  END IF;

  -- A última configuração confirmada é a única a projetar/desativar rotinas.
  PERFORM 1
  FROM public.clientes cliente
  WHERE cliente.empresa_id = v_empresa_id
    AND cliente.id = p_cliente_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configuração de protocolos não encontrada.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.validar_configs_protocolos_operacionais(
    v_empresa_id,
    p_cliente_id,
    p_configs
  );

  INSERT INTO public.configuracoes_protocolos_empresas (
    empresa_id,
    cliente_id,
    configs
  ) VALUES (
    v_empresa_id,
    p_cliente_id,
    p_configs
  )
  ON CONFLICT (empresa_id, cliente_id) DO UPDATE
  SET configs = EXCLUDED.configs
  RETURNING configs INTO v_resultado;

  PERFORM public.sincronizar_rotinas_protocolos_cliente(
    v_empresa_id,
    p_cliente_id,
    p_configs
  );
  PERFORM public.materializar_atividades_rotinas(
    (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date
  );

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_configuracoes_protocolos_cliente(uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.salvar_configuracoes_protocolos_cliente(uuid, jsonb)
  TO authenticated;

COMMIT;
