-- Preserva a âncora canônica ao editar regras de uma rotina já existente.
-- A data só é reancorada quando o frontend sinaliza uma edição explícita.

-- Rotinas criadas pelo gestor pertencem à empresa e podem ter checklist livre.
-- Um modelo existente é apenas um atalho opcional para preencher o formulário.

CREATE OR REPLACE FUNCTION public.salvar_rotina_programada(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_hoje date := (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_id uuid;
  v_modelo_id uuid;
  v_modelo_codigo text;
  v_responsavel_config_id uuid;
  v_responsavel_user_id uuid;
  v_responsavel_nome text;
  v_cliente_id uuid;
  v_cliente_nome text := 'Escritório';
  v_nome text;
  v_categoria text;
  v_frequencia text;
  v_intervalo integer;
  v_primeira date;
  v_prioridade text;
  v_checklist jsonb;
  v_observacoes text;
  v_finais boolean;
  v_ativa boolean;
  v_dia_mes integer;
  v_dia_semana integer;
  v_base date;
  v_execucao date;
  v_agenda_alterada boolean := true;
  v_reancorar_agenda boolean;
  v_referencia date;
  v_anterior public.atividades_rotinas%rowtype;
  v_resultado public.atividades_rotinas%rowtype;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR COALESCE(public.current_user_is_client_scoped(v_empresa_id), true)
     OR NOT COALESCE(
       public.current_user_has_permission(v_empresa_id, 'atividades:manage'), false
     )
     OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR octet_length(COALESCE(p_payload::text, '')) > 65536 THEN
    RAISE EXCEPTION 'Solicitação de rotina inválida' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_payload) campo(chave)
    WHERE campo.chave NOT IN (
      'id', 'modeloId', 'nome', 'categoria', 'frequencia', 'intervaloDias',
      'responsavelConfigUsuarioId', 'clienteId', 'primeiraExecucao',
      'reancorarAgenda', 'prioridade', 'checklist', 'observacoes',
      'incluirFinaisDeSemana', 'ativa'
    )
  ) OR NOT (p_payload ?& ARRAY[
    'nome', 'categoria', 'frequencia',
    'responsavelConfigUsuarioId', 'clienteId', 'primeiraExecucao',
    'prioridade', 'checklist', 'observacoes', 'incluirFinaisDeSemana', 'ativa'
  ]) THEN
    RAISE EXCEPTION 'Contrato de rotina inválido' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_payload -> 'nome') <> 'string'
     OR jsonb_typeof(p_payload -> 'categoria') <> 'string'
     OR jsonb_typeof(p_payload -> 'frequencia') <> 'string'
     OR jsonb_typeof(p_payload -> 'responsavelConfigUsuarioId') <> 'string'
     OR jsonb_typeof(p_payload -> 'primeiraExecucao') <> 'string'
     OR (p_payload ? 'reancorarAgenda'
       AND jsonb_typeof(p_payload -> 'reancorarAgenda') <> 'boolean')
     OR jsonb_typeof(p_payload -> 'prioridade') <> 'string'
     OR jsonb_typeof(p_payload -> 'checklist') <> 'array'
     OR jsonb_typeof(p_payload -> 'observacoes') <> 'string'
     OR jsonb_typeof(p_payload -> 'incluirFinaisDeSemana') <> 'boolean'
     OR jsonb_typeof(p_payload -> 'ativa') <> 'boolean'
     OR jsonb_typeof(p_payload -> 'clienteId') NOT IN ('string', 'null')
     OR (p_payload ? 'modeloId'
       AND jsonb_typeof(p_payload -> 'modeloId') NOT IN ('string', 'null'))
     OR (p_payload ? 'id' AND jsonb_typeof(p_payload -> 'id') <> 'string') THEN
    RAISE EXCEPTION 'Tipos do contrato de rotina inválidos' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_id := CASE WHEN p_payload ? 'id' THEN (p_payload ->> 'id')::uuid END;
    v_modelo_id := CASE
      WHEN jsonb_typeof(p_payload -> 'modeloId') = 'string'
      THEN (p_payload ->> 'modeloId')::uuid
      ELSE NULL
    END;
    v_responsavel_config_id := (p_payload ->> 'responsavelConfigUsuarioId')::uuid;
    v_cliente_id := CASE WHEN jsonb_typeof(p_payload -> 'clienteId') = 'string'
      THEN (p_payload ->> 'clienteId')::uuid ELSE NULL END;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Identificador de rotina inválido' USING ERRCODE = '22023';
  END;

  v_nome := btrim(p_payload ->> 'nome');
  v_categoria := p_payload ->> 'categoria';
  v_frequencia := p_payload ->> 'frequencia';
  v_primeira := app_private.jsonb_data_iso(p_payload -> 'primeiraExecucao');
  v_prioridade := p_payload ->> 'prioridade';
  v_checklist := p_payload -> 'checklist';
  v_observacoes := COALESCE(p_payload ->> 'observacoes', '');
  v_finais := (p_payload ->> 'incluirFinaisDeSemana')::boolean;
  v_ativa := (p_payload ->> 'ativa')::boolean;
  v_reancorar_agenda := COALESCE((p_payload ->> 'reancorarAgenda')::boolean, false);
  v_intervalo := CASE v_frequencia
    WHEN 'Diária' THEN 1 WHEN 'Semanal' THEN 7 WHEN 'Quinzenal' THEN 15
    WHEN 'Mensal' THEN 30 WHEN 'Trimestral' THEN 90 WHEN 'Semestral' THEN 180
    WHEN 'Personalizada' THEN app_private.jsonb_inteiro_entre(
      p_payload -> 'intervaloDias', 1, 366
    )
    ELSE NULL
  END;

  IF nullif(v_nome, '') IS NULL OR octet_length(v_nome) > 240
     OR v_categoria NOT IN ('Interna', 'Cliente', 'Fiscal', 'Folha', 'Contábil', 'Controle')
     OR v_frequencia NOT IN (
       'Diária', 'Semanal', 'Quinzenal', 'Mensal',
       'Trimestral', 'Semestral', 'Personalizada'
     )
     OR v_intervalo IS NULL
     OR (v_frequencia <> 'Personalizada' AND (p_payload ? 'intervaloDias'))
     OR v_primeira IS NULL
     OR v_prioridade NOT IN ('Baixa', 'Média', 'Alta')
     OR octet_length(v_observacoes) > 10000
     OR jsonb_array_length(v_checklist) NOT BETWEEN 1 AND 100
     OR octet_length(v_checklist::text) > 52000
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(v_checklist) etapa(valor)
       WHERE jsonb_typeof(etapa.valor) <> 'string'
          OR nullif(btrim(etapa.valor #>> '{}'), '') IS NULL
          OR octet_length(etapa.valor #>> '{}') > 500
     )
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements_text(v_checklist) etapa(valor)
       GROUP BY lower(btrim(etapa.valor)) HAVING count(*) > 1
     ) THEN
    RAISE EXCEPTION 'Dados da rotina inválidos' USING ERRCODE = '22023';
  END IF;
  IF v_id IS NULL AND v_primeira < v_hoje THEN
    RAISE EXCEPTION 'A primeira execução não pode estar no passado.'
      USING ERRCODE = '22023';
  END IF;

  IF v_modelo_id IS NOT NULL THEN
    SELECT modelo.codigo INTO v_modelo_codigo
    FROM public.atividades_modelos modelo
    WHERE modelo.id = v_modelo_id
      AND modelo.empresa_id = v_empresa_id
      AND modelo.ativo = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Modelo ativo não encontrado' USING ERRCODE = '23503';
    END IF;
  END IF;

  SELECT usuario.auth_user_id, usuario.nome
  INTO v_responsavel_user_id, v_responsavel_nome
  FROM public.configuracoes_usuarios usuario
  WHERE usuario.id = v_responsavel_config_id
    AND usuario.empresa_id = v_empresa_id
    AND usuario.status = 'Ativo'
    AND usuario.auth_user_id IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Responsável ativo não encontrado' USING ERRCODE = '23503';
  END IF;

  IF v_cliente_id IS NOT NULL THEN
    SELECT cliente.nome INTO v_cliente_nome
    FROM public.clientes cliente
    WHERE cliente.id = v_cliente_id
      AND cliente.empresa_id = v_empresa_id
      AND cliente.status = 'Ativa'
      AND public.current_user_can_access_client_row(cliente.empresa_id, cliente.id)
      AND (
        v_modelo_id IS NULL
        OR v_modelo_id::text = ANY(COALESCE(cliente.modelos_ativos, '{}'::text[]))
        OR v_modelo_codigo = ANY(COALESCE(cliente.modelos_ativos, '{}'::text[]))
      )
      AND EXISTS (
        SELECT 1
        FROM public.parametrizacao_catalogos tipo_parceiro
        WHERE tipo_parceiro.id = cliente.tipo_parceiro_id
          AND tipo_parceiro.empresa_id = cliente.empresa_id
          AND tipo_parceiro.tipo = 'tipos_parceiros'
          AND tipo_parceiro.codigo IN ('cliente_contabil', 'tp-1')
          AND tipo_parceiro.ativo = true
      );
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Empresa contábil ou modelo não encontrado' USING ERRCODE = '23503';
    END IF;
  END IF;

  IF v_id IS NOT NULL THEN
    SELECT rotina.* INTO v_anterior
    FROM public.atividades_rotinas rotina
    WHERE rotina.id = v_id
      AND rotina.empresa_id = v_empresa_id
      AND rotina.protocolo_codigo IS NULL
      AND public.current_user_can_access_client_row(rotina.empresa_id, rotina.cliente_id)
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Rotina programada não encontrada' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_id IS NULL THEN
    v_reancorar_agenda := true;
  ELSIF NOT (p_payload ? 'reancorarAgenda') THEN
    -- Compatibilidade durante o deploy: clientes antigos não enviam a flag.
    v_reancorar_agenda := v_primeira IS DISTINCT FROM v_anterior.proxima_execucao
      AND v_primeira IS DISTINCT FROM v_anterior.proxima_execucao_base;
  END IF;

  IF v_id IS NOT NULL AND NOT v_reancorar_agenda THEN
    -- O valor exibido pode ser uma ocorrência truncada/ajustada. A âncora canônica
    -- só muda quando o gestor alterou explicitamente o campo de data.
    v_primeira := COALESCE(
      v_anterior.data_ancora,
      v_anterior.proxima_execucao_base,
      v_anterior.proxima_execucao
    );
  END IF;

  v_dia_mes := CASE WHEN v_frequencia IN ('Mensal', 'Trimestral', 'Semestral')
      OR (v_frequencia = 'Personalizada' AND v_intervalo IN (60, 365))
    THEN extract(day FROM v_primeira)::integer ELSE NULL END;
  v_dia_semana := CASE WHEN v_frequencia = 'Semanal'
    THEN extract(isodow FROM v_primeira)::integer ELSE NULL END;
  IF v_id IS NOT NULL THEN
    v_agenda_alterada := v_anterior.frequencia IS DISTINCT FROM v_frequencia
      OR v_anterior.intervalo_dias IS DISTINCT FROM v_intervalo
      OR v_anterior.incluir_finais_de_semana IS DISTINCT FROM v_finais
      OR v_reancorar_agenda;
  END IF;
  IF v_id IS NOT NULL AND v_reancorar_agenda AND v_primeira < v_hoje THEN
    RAISE EXCEPTION 'A primeira execução não pode estar no passado.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT v_agenda_alterada THEN
    v_primeira := v_anterior.data_ancora;
    v_dia_mes := v_anterior.dia_mes;
    v_dia_semana := v_anterior.dia_semana_iso;
    IF v_anterior.ativa = false AND v_ativa = true THEN
      v_base := app_private.primeira_data_base_rotina(
        v_hoje, v_frequencia, v_intervalo, v_primeira,
        v_dia_mes, v_dia_semana, v_finais
      );
      v_execucao := app_private.ajustar_data_rotina(v_base, v_finais);
    ELSE
      v_base := v_anterior.proxima_execucao_base;
      v_execucao := v_anterior.proxima_execucao;
    END IF;
  ELSE
    IF v_id IS NULL OR v_reancorar_agenda THEN
      v_referencia := v_primeira;
    ELSIF v_anterior.proxima_execucao >= v_hoje THEN
      v_referencia := COALESCE(
        v_anterior.proxima_execucao_base,
        v_anterior.proxima_execucao
      );
    ELSE
      v_referencia := v_hoje;
    END IF;
    v_base := app_private.primeira_data_base_rotina(
      v_referencia, v_frequencia, v_intervalo, v_primeira,
      v_dia_mes, v_dia_semana, v_finais
    );
    v_execucao := app_private.ajustar_data_rotina(v_base, v_finais);
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.atividades_rotinas (
      empresa_id, modelo_id, nome, categoria, frequencia, intervalo_dias,
      responsavel_nome, responsavel_user_id, responsavel_config_usuario_id,
      cliente_id, cliente_nome, proxima_execucao, data_ancora, dia_mes,
      dia_semana_iso, proxima_execucao_base, prioridade, checklist,
      observacoes, incluir_finais_de_semana, ativa
    ) VALUES (
      v_empresa_id, v_modelo_id, v_nome, v_categoria, v_frequencia, v_intervalo,
      v_responsavel_nome, v_responsavel_user_id, v_responsavel_config_id,
      v_cliente_id, v_cliente_nome, v_execucao, v_primeira, v_dia_mes,
      v_dia_semana, v_base, v_prioridade, v_checklist,
      v_observacoes, v_finais, v_ativa
    ) RETURNING * INTO v_resultado;
  ELSE
    UPDATE public.atividades_rotinas
    SET modelo_id = v_modelo_id,
        nome = v_nome,
        categoria = v_categoria,
        frequencia = v_frequencia,
        intervalo_dias = v_intervalo,
        responsavel_nome = v_responsavel_nome,
        responsavel_user_id = v_responsavel_user_id,
        responsavel_config_usuario_id = v_responsavel_config_id,
        cliente_id = v_cliente_id,
        cliente_nome = v_cliente_nome,
        proxima_execucao = v_execucao,
        data_ancora = v_primeira,
        dia_mes = v_dia_mes,
        dia_semana_iso = v_dia_semana,
        proxima_execucao_base = v_base,
        prioridade = v_prioridade,
        checklist = v_checklist,
        observacoes = v_observacoes,
        incluir_finais_de_semana = v_finais,
        ativa = v_ativa,
        atualizado_em = now()
    WHERE id = v_id AND empresa_id = v_empresa_id
    RETURNING * INTO v_resultado;
  END IF;

  IF v_resultado.ativa AND v_resultado.proxima_execucao <= v_hoje THEN
    PERFORM app_private.materializar_rotinas_empresa(
      v_empresa_id, v_hoje, 'usuario', auth.uid(), true, v_resultado.id
    );
    SELECT rotina.* INTO v_resultado
    FROM public.atividades_rotinas rotina
    WHERE rotina.id = v_resultado.id
      AND rotina.empresa_id = v_empresa_id;
  END IF;

  RETURN jsonb_build_object(
    'id', v_resultado.id,
    'modeloId', v_resultado.modelo_id,
    'nome', v_resultado.nome,
    'categoria', v_resultado.categoria,
    'frequencia', v_resultado.frequencia,
    'intervaloDias', v_resultado.intervalo_dias,
    'responsavelConfigUsuarioId', v_resultado.responsavel_config_usuario_id,
    'responsavelUserId', v_resultado.responsavel_user_id,
    'responsavelNome', v_resultado.responsavel_nome,
    'clienteId', v_resultado.cliente_id,
    'clienteNome', v_resultado.cliente_nome,
    'dataAncora', v_resultado.data_ancora,
    'diaMes', v_resultado.dia_mes,
    'diaSemana', v_resultado.dia_semana_iso,
    'proximaExecucaoBase', v_resultado.proxima_execucao_base,
    'proximaExecucao', v_resultado.proxima_execucao,
    'prioridade', v_resultado.prioridade,
    'checklist', v_resultado.checklist,
    'observacoes', v_resultado.observacoes,
    'incluirFinaisDeSemana', v_resultado.incluir_finais_de_semana,
    'ativa', v_resultado.ativa
  );
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_rotina_programada(jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_rotina_programada(jsonb)
  TO authenticated;
