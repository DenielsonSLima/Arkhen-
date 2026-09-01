CREATE OR REPLACE FUNCTION public.salvar_obrigacao_unificada(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_id uuid;
  v_codigo text;
  v_nome text := btrim(COALESCE(p_payload ->> 'nome', ''));
  v_categoria text := btrim(COALESCE(p_payload ->> 'categoria', ''));
  v_orgao text := btrim(COALESCE(p_payload ->> 'orgao', ''));
  v_descricao text := btrim(COALESCE(p_payload ->> 'descricao', ''));
  v_regimes text[];
  v_periodicidade text := p_payload ->> 'periodicidade';
  v_origem text := p_payload ->> 'origemPadrao';
  v_etapas jsonb;
  v_tem_vencimento boolean;
  v_dia integer;
  v_dia_semana integer;
  v_mes_vencimento integer;
  v_data_vencimento date;
  v_referencia_anterior boolean;
  v_dia_primeira integer;
  v_dia_segunda integer;
  v_ativo boolean;
  v_modelo_id uuid;
  v_atualizado_em timestamptz;
  v_resultado jsonb;
  v_cliente record;
  v_configs_normalizadas jsonb;
  v_guard_anterior text := COALESCE(
    current_setting('app.obrigacao_canonica_write', true), 'off'
  );
  v_ocorrencias_guard_anterior text := COALESCE(
    current_setting('app.obrigacao_preservar_ocorrencias', true), 'off'
  );
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR COALESCE(public.current_user_is_client_scoped(v_empresa_id), true)
     OR NOT COALESCE(
       public.current_user_has_permission(v_empresa_id, 'parametrizacao:manage'), false
     ) THEN
    RAISE EXCEPTION 'Obrigação não encontrada.' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR octet_length(p_payload::text) > 65536
     OR char_length(v_nome) NOT BETWEEN 2 AND 180
     OR char_length(v_categoria) NOT BETWEEN 2 AND 60
     OR char_length(v_orgao) > 80
     OR char_length(v_descricao) > 4000
     OR COALESCE(v_periodicidade, '') NOT IN (
       'diaria', 'unica', 'semanal', 'quinzenal',
       'mensal', 'trimestral', 'semestral', 'anual'
     )
     OR COALESCE(v_origem, '') NOT IN (
       'Cliente envia', 'Escritório envia', 'Ambos'
     )
     OR jsonb_typeof(p_payload -> 'regimes') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_payload -> 'regimes') NOT BETWEEN 1 AND 6
     OR jsonb_typeof(p_payload -> 'etapas') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_payload -> 'etapas') > 80
     OR jsonb_typeof(p_payload -> 'temVencimento') IS DISTINCT FROM 'boolean'
     OR jsonb_typeof(p_payload -> 'referenciaMesAnterior') IS DISTINCT FROM 'boolean'
     OR jsonb_typeof(p_payload -> 'ativo') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION 'Revise os dados da obrigação.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_payload -> 'regimes') item(valor)
       WHERE jsonb_typeof(item.valor) IS DISTINCT FROM 'string'
     ) OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_payload -> 'etapas') item(valor)
       WHERE jsonb_typeof(item.valor) IS DISTINCT FROM 'string'
     ) THEN
    RAISE EXCEPTION 'Regimes e etapas devem conter somente textos.'
      USING ERRCODE = '22023';
  END IF;

  SELECT array_agg(DISTINCT CASE WHEN valor = 'Isento' THEN 'Isenta' ELSE valor END)
  INTO v_regimes
  FROM jsonb_array_elements_text(p_payload -> 'regimes') regime(valor)
  WHERE valor IN (
    'PF', 'MEI', 'Simples Nacional', 'Lucro Presumido',
    'Lucro Real', 'Isenta', 'Isento'
  );
  IF cardinality(v_regimes) <> jsonb_array_length(p_payload -> 'regimes') THEN
    RAISE EXCEPTION 'Há um regime inválido ou repetido.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(btrim(valor)) ORDER BY ordem), '[]'::jsonb)
  INTO v_etapas
  FROM jsonb_array_elements_text(p_payload -> 'etapas') WITH ORDINALITY etapa(valor, ordem)
  WHERE char_length(btrim(valor)) BETWEEN 1 AND 240;
  v_ativo := (p_payload ->> 'ativo')::boolean;
  IF jsonb_array_length(v_etapas) <> jsonb_array_length(p_payload -> 'etapas')
     OR (v_ativo AND jsonb_array_length(v_etapas) = 0) THEN
    RAISE EXCEPTION 'Informe as etapas válidas do fluxo.' USING ERRCODE = '22023';
  END IF;

  v_tem_vencimento := (p_payload ->> 'temVencimento')::boolean;
  v_referencia_anterior := (p_payload ->> 'referenciaMesAnterior')::boolean;

  IF (p_payload ? 'diaVencimento'
        AND p_payload -> 'diaVencimento' <> 'null'::jsonb
        AND app_private.jsonb_inteiro_entre(p_payload -> 'diaVencimento', 1, 31) IS NULL)
     OR (p_payload ? 'diaPrimeiraQuinzena'
        AND p_payload -> 'diaPrimeiraQuinzena' <> 'null'::jsonb
        AND app_private.jsonb_inteiro_entre(
          p_payload -> 'diaPrimeiraQuinzena', 1, 31
        ) IS NULL)
     OR (p_payload ? 'diaSegundaQuinzena'
        AND p_payload -> 'diaSegundaQuinzena' <> 'null'::jsonb
        AND app_private.jsonb_inteiro_entre(
          p_payload -> 'diaSegundaQuinzena', 1, 31
        ) IS NULL)
     OR (p_payload ? 'diaSemana'
        AND p_payload -> 'diaSemana' <> 'null'::jsonb
        AND app_private.jsonb_inteiro_entre(p_payload -> 'diaSemana', 1, 7) IS NULL)
     OR (p_payload ? 'mesVencimento'
        AND p_payload -> 'mesVencimento' <> 'null'::jsonb
        AND app_private.jsonb_inteiro_entre(
          p_payload -> 'mesVencimento', 1, 12
        ) IS NULL)
     OR (p_payload ? 'dataVencimento'
        AND p_payload -> 'dataVencimento' <> 'null'::jsonb
        AND app_private.jsonb_data_iso(p_payload -> 'dataVencimento') IS NULL) THEN
    RAISE EXCEPTION 'Revise o prazo informado para a periodicidade.'
      USING ERRCODE = '22023';
  END IF;

  v_dia := COALESCE(
    app_private.jsonb_inteiro_entre(p_payload -> 'diaVencimento', 1, 31), 20
  );
  v_dia_primeira := COALESCE(app_private.jsonb_inteiro_entre(
    p_payload -> 'diaPrimeiraQuinzena', 1, 31
  ), 15);
  v_dia_segunda := COALESCE(app_private.jsonb_inteiro_entre(
    p_payload -> 'diaSegundaQuinzena', 1, 31
  ), 30);
  v_dia_semana := CASE WHEN v_periodicidade = 'semanal'
    THEN app_private.jsonb_inteiro_entre(p_payload -> 'diaSemana', 1, 7)
    ELSE NULL END;
  v_mes_vencimento := CASE WHEN v_periodicidade = 'anual'
    THEN app_private.jsonb_inteiro_entre(p_payload -> 'mesVencimento', 1, 12)
    ELSE NULL END;
  v_data_vencimento := CASE WHEN v_periodicidade = 'unica'
    THEN app_private.jsonb_data_iso(p_payload -> 'dataVencimento')
    ELSE NULL END;

  IF (v_periodicidade = 'semanal' AND v_dia_semana IS NULL)
     OR (v_periodicidade = 'anual' AND (
       v_mes_vencimento IS NULL
       OR app_private.jsonb_inteiro_entre(
         p_payload -> 'diaVencimento', 1, 31
       ) IS NULL
     ))
     OR (v_periodicidade = 'unica' AND v_data_vencimento IS NULL)
     OR (v_periodicidade <> 'semanal'
       AND p_payload -> 'diaSemana' IS NOT NULL
       AND p_payload -> 'diaSemana' <> 'null'::jsonb)
     OR (v_periodicidade <> 'anual'
       AND p_payload -> 'mesVencimento' IS NOT NULL
       AND p_payload -> 'mesVencimento' <> 'null'::jsonb)
     OR (v_periodicidade <> 'unica'
       AND p_payload -> 'dataVencimento' IS NOT NULL
       AND p_payload -> 'dataVencimento' <> 'null'::jsonb) THEN
    RAISE EXCEPTION 'O prazo não corresponde à periodicidade escolhida.'
      USING ERRCODE = '22023';
  END IF;

  IF v_tem_vencimento
     AND v_periodicidade = 'quinzenal'
     AND v_dia_primeira >= v_dia_segunda THEN
    RAISE EXCEPTION 'O vencimento da 1ª quinzena deve anteceder o da 2ª.'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_empresa_id::text, 913331)
  );

  IF NULLIF(p_payload ->> 'id', '') IS NOT NULL THEN
    BEGIN
      v_id := (p_payload ->> 'id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Identidade da obrigação inválida.' USING ERRCODE = '22023';
    END;
    SELECT tipo.codigo, tipo.modelo_atividade_id, tipo.atualizado_em
    INTO v_codigo, v_modelo_id, v_atualizado_em
    FROM public.parametrizacao_protocolos_tipos tipo
    WHERE tipo.id = v_id AND tipo.empresa_id = v_empresa_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Obrigação não encontrada.' USING ERRCODE = '42501';
    END IF;
    BEGIN
      IF NULLIF(p_payload ->> 'atualizadoEm', '') IS NULL
         OR v_atualizado_em IS DISTINCT FROM
           (p_payload ->> 'atualizadoEm')::timestamptz THEN
        RAISE EXCEPTION 'Obrigação alterada por outro usuário.' USING ERRCODE = '40001';
      END IF;
    EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN
      RAISE EXCEPTION 'Identidade da obrigação inválida.' USING ERRCODE = '22023';
    END;
  ELSE
    v_id := gen_random_uuid();
    v_codigo := left(regexp_replace(lower(translate(v_nome,
      'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')),
      '[^a-z0-9]+', '-', 'g'), 54);
    v_codigo := trim(both '-' from v_codigo);
    IF v_codigo = '' THEN v_codigo := 'obrigacao'; END IF;
    v_codigo := v_codigo || '-' || left(replace(v_id::text, '-', ''), 8);
  END IF;

  PERFORM set_config('app.obrigacao_canonica_write', 'on', true);

  INSERT INTO public.atividades_modelos AS modelo (
    id, empresa_id, codigo, nome, descricao, categoria, tipos, etapas,
    sistema, ativo, ordem
  ) VALUES (
    COALESCE(v_modelo_id, gen_random_uuid()), v_empresa_id, v_codigo, v_nome,
    v_descricao,
    CASE WHEN v_categoria = 'Trabalhista' THEN 'Folha'
      WHEN v_categoria IN ('Fiscal', 'Financeiro', 'Contábil') THEN v_categoria
      ELSE 'Controle' END,
    v_regimes, v_etapas, false, v_ativo, 100
  )
  ON CONFLICT (empresa_id, codigo) DO UPDATE SET
    nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    categoria = EXCLUDED.categoria,
    tipos = EXCLUDED.tipos,
    etapas = EXCLUDED.etapas,
    ativo = EXCLUDED.ativo,
    atualizado_em = now()
  RETURNING modelo.id INTO v_modelo_id;

  PERFORM set_config('app.obrigacao_canonica_write', v_guard_anterior, true);

  INSERT INTO public.parametrizacao_protocolos_tipos AS tipo (
    id, empresa_id, codigo, nome, categoria, orgao, dia_limite, descricao,
    regimes, periodicidade_padrao, origem_padrao, sistema, ativo, etapas,
    tem_vencimento, referencia_mes_anterior,
    dia_vencimento_primeira_quinzena, dia_vencimento_segunda_quinzena,
    dia_semana_iso, mes_vencimento, data_vencimento,
    ordem, modelo_atividade_id
  ) VALUES (
    v_id, v_empresa_id, v_codigo, v_nome, v_categoria, v_orgao, v_dia,
    v_descricao, v_regimes, v_periodicidade, v_origem, false, v_ativo,
    v_etapas, v_tem_vencimento, v_referencia_anterior,
    v_dia_primeira, v_dia_segunda, v_dia_semana, v_mes_vencimento,
    v_data_vencimento, 100, v_modelo_id
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    categoria = EXCLUDED.categoria,
    orgao = EXCLUDED.orgao,
    dia_limite = EXCLUDED.dia_limite,
    descricao = EXCLUDED.descricao,
    regimes = EXCLUDED.regimes,
    periodicidade_padrao = EXCLUDED.periodicidade_padrao,
    origem_padrao = EXCLUDED.origem_padrao,
    ativo = EXCLUDED.ativo,
    etapas = EXCLUDED.etapas,
    tem_vencimento = EXCLUDED.tem_vencimento,
    referencia_mes_anterior = EXCLUDED.referencia_mes_anterior,
    dia_vencimento_primeira_quinzena = EXCLUDED.dia_vencimento_primeira_quinzena,
    dia_vencimento_segunda_quinzena = EXCLUDED.dia_vencimento_segunda_quinzena,
    dia_semana_iso = EXCLUDED.dia_semana_iso,
    mes_vencimento = EXCLUDED.mes_vencimento,
    data_vencimento = EXCLUDED.data_vencimento,
    modelo_atividade_id = EXCLUDED.modelo_atividade_id,
    atualizado_em = now();

  INSERT INTO public.parametrizacao_prazos_entrega AS prazo (
    empresa_id, regime, entrega_id, entrega_nome, categoria, dia_vencimento,
    referencia_mes_anterior, fechamento, dia_vencimento_primeira_quinzena,
    dia_vencimento_segunda_quinzena, dia_semana_iso, mes_vencimento,
    data_vencimento, sistema, ativo
  )
  SELECT v_empresa_id, regime, v_codigo, v_nome, v_categoria, v_dia,
    v_referencia_anterior, v_periodicidade, v_dia_primeira, v_dia_segunda,
    v_dia_semana, v_mes_vencimento, v_data_vencimento,
    false, v_ativo AND v_tem_vencimento
  FROM unnest(v_regimes) regime
  ON CONFLICT (empresa_id, regime, entrega_id) DO UPDATE SET
    entrega_nome = EXCLUDED.entrega_nome,
    categoria = EXCLUDED.categoria,
    dia_vencimento = EXCLUDED.dia_vencimento,
    referencia_mes_anterior = EXCLUDED.referencia_mes_anterior,
    fechamento = EXCLUDED.fechamento,
    dia_vencimento_primeira_quinzena = EXCLUDED.dia_vencimento_primeira_quinzena,
    dia_vencimento_segunda_quinzena = EXCLUDED.dia_vencimento_segunda_quinzena,
    dia_semana_iso = EXCLUDED.dia_semana_iso,
    mes_vencimento = EXCLUDED.mes_vencimento,
    data_vencimento = EXCLUDED.data_vencimento,
    ativo = EXCLUDED.ativo,
    atualizado_em = now();

  UPDATE public.parametrizacao_prazos_entrega prazo
  SET ativo = false, atualizado_em = now()
  WHERE prazo.empresa_id = v_empresa_id
    AND prazo.entrega_id = v_codigo
    AND NOT (prazo.regime = ANY(v_regimes));

  -- O parceiro apenas ativa/desativa. Depois de editar o card global, cada
  -- configuração que já conhecia a obrigação é reserializada a partir do
  -- catálogo canônico e sua rotina é recalculada na mesma transação.
  FOR v_cliente IN
    SELECT cliente.id, cfg.configs
    FROM public.clientes cliente
    JOIN public.configuracoes_protocolos_empresas cfg
      ON cfg.empresa_id = cliente.empresa_id
     AND cfg.cliente_id = cliente.id
    WHERE cliente.empresa_id = v_empresa_id
      AND cliente.status = 'Ativa'
      AND EXISTS (
        SELECT 1
        FROM public.parametrizacao_catalogos tipo_parceiro
        WHERE tipo_parceiro.id = cliente.tipo_parceiro_id
          AND tipo_parceiro.empresa_id = cliente.empresa_id
          AND tipo_parceiro.tipo = 'tipos_parceiros'
          AND tipo_parceiro.codigo IN ('cliente_contabil', 'tp-1')
          AND tipo_parceiro.ativo = true
      )
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(cfg.configs) = 'array'
            THEN cfg.configs ELSE '[]'::jsonb END
        ) item(valor)
        WHERE item.valor ->> 'entregaId' = v_codigo
      )
    ORDER BY cliente.id
    FOR UPDATE OF cliente, cfg
  LOOP
    v_configs_normalizadas := app_private.normalizar_configs_protocolos_cliente(
      v_empresa_id,
      v_cliente.id,
      COALESCE(v_cliente.configs, '[]'::jsonb)
    );

    PERFORM public.validar_configs_protocolos_operacionais(
      v_empresa_id, v_cliente.id, v_configs_normalizadas
    );

    UPDATE public.configuracoes_protocolos_empresas cfg
    SET configs = v_configs_normalizadas
    WHERE cfg.empresa_id = v_empresa_id
      AND cfg.cliente_id = v_cliente.id;

    PERFORM public.sincronizar_rotinas_protocolos_cliente(
      v_empresa_id, v_cliente.id, v_configs_normalizadas
    );
  END LOOP;

  -- Esta projeção final atualiza metadados do card. A ocorrência operacional
  -- existente conserva ID, status e checklist; desativação explícita continua
  -- sendo tratada pelo trigger como cancelamento intencional.
  PERFORM set_config('app.obrigacao_preservar_ocorrencias', 'on', true);
  UPDATE public.atividades_rotinas rotina
  SET modelo_id = v_modelo_id,
      nome = v_nome,
      categoria = CASE v_categoria
        WHEN 'Fiscal' THEN 'Fiscal'
        WHEN 'Trabalhista' THEN 'Folha'
        WHEN 'Financeiro' THEN 'Contábil'
        WHEN 'Contábil' THEN 'Contábil'
        ELSE 'Cliente'
      END,
      checklist = v_etapas,
      observacoes = COALESCE(
        NULLIF(v_descricao, ''), 'Rotina gerada pela configuração de obrigações.'
      ),
      ativa = v_ativo
        AND cliente.status = 'Ativa'
        AND EXISTS (
          SELECT 1
          FROM public.parametrizacao_catalogos tipo_parceiro
          WHERE tipo_parceiro.id = cliente.tipo_parceiro_id
            AND tipo_parceiro.empresa_id = cliente.empresa_id
            AND tipo_parceiro.tipo = 'tipos_parceiros'
            AND tipo_parceiro.codigo IN ('cliente_contabil', 'tp-1')
            AND tipo_parceiro.ativo = true
        )
        AND cliente.tipo = ANY(v_regimes)
        AND EXISTS (
          SELECT 1
          FROM public.configuracoes_protocolos_empresas cfg
          CROSS JOIN LATERAL jsonb_array_elements(
            CASE WHEN jsonb_typeof(cfg.configs) = 'array'
              THEN cfg.configs ELSE '[]'::jsonb END
          ) item(valor)
          WHERE cfg.empresa_id = v_empresa_id
            AND cfg.cliente_id = cliente.id
            AND item.valor ->> 'entregaId' = v_codigo
            AND item.valor ->> 'ativo' = 'true'
        ),
      atualizado_em = now()
    FROM public.configuracoes_protocolos_empresas cfg
    JOIN public.clientes cliente
      ON cliente.empresa_id = cfg.empresa_id
     AND cliente.id = cfg.cliente_id
  WHERE rotina.empresa_id = v_empresa_id
    AND rotina.cliente_id = cliente.id
    AND rotina.protocolo_codigo = v_codigo
    -- Uma ocorrência Única já materializada é histórica. Se o card continuar
    -- aplicável/ativo, não a reative nem dispare o cancelamento de sua tarefa.
    AND NOT (
      rotina.frequencia = 'Única'
      AND rotina.ativa = false
      AND v_ativo
      AND cliente.status = 'Ativa'
      AND cliente.tipo = ANY(v_regimes)
      AND EXISTS (
        SELECT 1 FROM public.parametrizacao_catalogos tipo_parceiro
        WHERE tipo_parceiro.id = cliente.tipo_parceiro_id
          AND tipo_parceiro.empresa_id = cliente.empresa_id
          AND tipo_parceiro.tipo = 'tipos_parceiros'
          AND tipo_parceiro.codigo IN ('cliente_contabil', 'tp-1')
          AND tipo_parceiro.ativo = true
      )
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(cfg.configs) = 'array'
          THEN cfg.configs ELSE '[]'::jsonb END) item(valor)
        WHERE item.valor ->> 'entregaId' = v_codigo
          AND item.valor ->> 'ativo' = 'true'
      )
      AND EXISTS (
        SELECT 1 FROM public.atividades_tarefas tarefa
        WHERE tarefa.empresa_id = rotina.empresa_id
          AND tarefa.rotina_id = rotina.id
          AND tarefa.origem = 'Rotina'
      )
    );
  PERFORM set_config(
    'app.obrigacao_preservar_ocorrencias',
    v_ocorrencias_guard_anterior,
    true
  );

  SELECT jsonb_build_object(
    'id', tipo.id::text,
    'codigo', tipo.codigo,
    'nome', tipo.nome,
    'categoria', tipo.categoria,
    'orgao', COALESCE(tipo.orgao, ''),
    'descricao', COALESCE(tipo.descricao, ''),
    'regimes', to_jsonb(tipo.regimes),
    'periodicidade', tipo.periodicidade_padrao,
    'origemPadrao', CASE tipo.origem_padrao
      WHEN 'cliente' THEN 'Cliente envia'
      WHEN 'escritorio' THEN 'Escritório envia'
      WHEN 'ambos' THEN 'Ambos'
      ELSE tipo.origem_padrao
    END,
    'temVencimento', tipo.tem_vencimento,
    'diaVencimento', tipo.dia_limite,
    'diaSemana', tipo.dia_semana_iso,
    'mesVencimento', tipo.mes_vencimento,
    'dataVencimento', to_char(tipo.data_vencimento, 'YYYY-MM-DD'),
    'referenciaMesAnterior', tipo.referencia_mes_anterior,
    'diaPrimeiraQuinzena', tipo.dia_vencimento_primeira_quinzena,
    'diaSegundaQuinzena', tipo.dia_vencimento_segunda_quinzena,
    'etapas', tipo.etapas,
    'ativo', tipo.ativo,
    'ordem', tipo.ordem,
    'atualizadoEm', tipo.atualizado_em::text
  ) INTO v_resultado
  FROM public.parametrizacao_protocolos_tipos tipo
  WHERE tipo.id = v_id AND tipo.empresa_id = v_empresa_id;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_obrigacao_unificada(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_obrigacao_unificada(jsonb) TO authenticated;
