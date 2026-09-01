-- Expõe o fluxo unificado para a ativação por parceiro e usa as etapas do card
-- ao projetar uma rotina. As assinaturas públicas existentes são preservadas.

-- Enquanto uma configuração explícita ainda não foi salva, converte de forma
-- preguiçosa os vínculos legados de modelos. Isso preserva clientes inativos na
-- reativação e mantém o provisionamento de novos clientes retrocompatível.
CREATE OR REPLACE FUNCTION app_private.mesclar_configs_obrigacoes_legadas(
  p_empresa_id uuid,
  p_cliente_id uuid,
  p_configs jsonb,
  p_referencia date DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_regime text;
  v_modelos_ativos text[];
  v_configs jsonb := CASE
    WHEN jsonb_typeof(p_configs) = 'array' THEN p_configs
    ELSE '[]'::jsonb
  END;
  v_legados jsonb;
BEGIN
  SELECT cliente.tipo, cliente.modelos_ativos
  INTO v_regime, v_modelos_ativos
  FROM public.clientes cliente
  WHERE cliente.empresa_id = p_empresa_id
    AND cliente.id = p_cliente_id;

  IF NOT FOUND OR COALESCE(cardinality(v_modelos_ativos), 0) = 0 THEN
    RETURN v_configs;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'entregaId', tipo.codigo,
      'ativo', true,
      'periodicidade', tipo.periodicidade_padrao,
      'dataInicial', to_char(p_referencia, 'YYYY-MM-DD'),
      'incluirFinaisDeSemana', false
    ) || CASE WHEN tipo.periodicidade_padrao IN ('mensal', 'trimestral', 'semestral')
      THEN jsonb_build_object('diaMes', tipo.dia_limite)
      ELSE '{}'::jsonb
    END
    ORDER BY tipo.ordem, tipo.nome, tipo.codigo
  ), '[]'::jsonb)
  INTO v_legados
  FROM public.parametrizacao_protocolos_tipos tipo
  WHERE tipo.empresa_id = p_empresa_id
    AND tipo.ativo = true
    AND v_regime = ANY(tipo.regimes)
    AND (
      tipo.modelo_atividade_id::text = ANY(v_modelos_ativos)
      OR tipo.codigo = ANY(v_modelos_ativos)
    )
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_configs) atual(valor)
      WHERE atual.valor ->> 'entregaId' = tipo.codigo
    );

  RETURN v_configs || v_legados;
END;
$$;

REVOKE ALL ON FUNCTION app_private.mesclar_configs_obrigacoes_legadas(
  uuid, uuid, jsonb, date
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.obter_configuracao_protocolos_cliente(
  p_cliente_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_regime text;
  v_catalogo jsonb;
  v_configs_salvas jsonb;
  v_configs jsonb;
  v_updated_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL OR p_cliente_id IS NULL
     OR NOT COALESCE(
       public.current_user_has_permission(v_empresa_id, 'protocolos:view')
       OR public.current_user_has_permission(v_empresa_id, 'protocolos:create')
       OR public.current_user_has_permission(v_empresa_id, 'protocolos:manage')
       OR public.current_user_has_permission(v_empresa_id, 'protocolos:view-own'),
       false
     )
     OR NOT COALESCE(
       public.current_user_can_access_client_row(v_empresa_id, p_cliente_id), false
     ) THEN
    RAISE EXCEPTION 'Configuração de acompanhamento não encontrada.'
      USING ERRCODE = '42501';
  END IF;

  SELECT cliente.tipo INTO v_regime
  FROM public.clientes cliente
  WHERE cliente.empresa_id = v_empresa_id
    AND cliente.id = p_cliente_id
    AND cliente.status = 'Ativa'
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
    RAISE EXCEPTION 'Configuração de acompanhamento não encontrada.'
      USING ERRCODE = '42501';
  END IF;

  SELECT cfg.configs, cfg.updated_at
  INTO v_configs_salvas, v_updated_at
  FROM public.configuracoes_protocolos_empresas cfg
  WHERE cfg.empresa_id = v_empresa_id AND cfg.cliente_id = p_cliente_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', tipo.codigo,
    'nome', tipo.nome,
    'categoria', tipo.categoria,
    'orgao', nullif(btrim(tipo.orgao), ''),
    'diaLimite', COALESCE(prazo.dia_vencimento, tipo.dia_limite),
    'descricao', COALESCE(tipo.descricao, ''),
    'status', 'Ativo',
    'regimes', to_jsonb(tipo.regimes),
    'periodicidadePadrao', COALESCE(
      nullif(btrim(prazo.fechamento), ''),
      nullif(btrim(tipo.periodicidade_padrao), ''),
      'mensal'
    ),
    'origemPadrao', CASE tipo.origem_padrao
      WHEN 'cliente' THEN 'Cliente envia'
      WHEN 'escritorio' THEN 'Escritório envia'
      WHEN 'ambos' THEN 'Ambos'
      ELSE tipo.origem_padrao
    END,
    'temVencimento', tipo.tem_vencimento,
    'referenciaMesAnterior', tipo.referencia_mes_anterior,
    'diaPrimeiraQuinzena', tipo.dia_vencimento_primeira_quinzena,
    'diaSegundaQuinzena', tipo.dia_vencimento_segunda_quinzena,
    'etapas', tipo.etapas
  ) ORDER BY tipo.categoria, tipo.nome, tipo.codigo), '[]'::jsonb)
  INTO v_catalogo
  FROM public.parametrizacao_protocolos_tipos tipo
  LEFT JOIN public.parametrizacao_prazos_entrega prazo
    ON prazo.empresa_id = tipo.empresa_id
   AND prazo.regime = v_regime
   AND prazo.entrega_id = tipo.codigo
   AND prazo.ativo = true
  WHERE tipo.empresa_id = v_empresa_id
    AND tipo.ativo = true
    AND v_regime = ANY(tipo.regimes);

  v_configs := app_private.normalizar_configs_protocolos_cliente(
    v_empresa_id,
    p_cliente_id,
    app_private.mesclar_configs_obrigacoes_legadas(
      v_empresa_id, p_cliente_id, COALESCE(v_configs_salvas, '[]'::jsonb)
    )
  );

  RETURN jsonb_build_object(
    'catalogo', v_catalogo,
    'configs', v_configs,
    'updatedAt', to_jsonb(v_updated_at)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.obter_configuracao_protocolos_cliente(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_configuracao_protocolos_cliente(uuid)
  TO authenticated;

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
  v_hoje date := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;
  v_item record;
  v_periodicidade text;
  v_frequencia text;
  v_intervalo integer;
  v_ancora date;
  v_dia_mes integer;
  v_dia_semana integer;
  v_finais boolean;
  v_base date;
  v_execucao date;
BEGIN
  SELECT cliente.tipo, cliente.nome INTO v_regime, v_cliente_nome
  FROM public.clientes cliente
  WHERE cliente.empresa_id = p_empresa_id
    AND cliente.id = p_cliente_id
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
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado para sincronizar obrigações.'
      USING ERRCODE = '42501';
  END IF;

  PERFORM public.validar_configs_protocolos_operacionais(
    p_empresa_id, p_cliente_id, p_configs
  );

  FOR v_item IN
    SELECT
      item.valor AS config,
      tipo.codigo,
      tipo.nome,
      tipo.categoria,
      tipo.descricao,
      tipo.etapas,
      tipo.modelo_atividade_id
    FROM jsonb_array_elements(p_configs) item(valor)
    JOIN public.parametrizacao_protocolos_tipos tipo
      ON tipo.empresa_id = p_empresa_id
     AND tipo.codigo = btrim(item.valor ->> 'entregaId')
     AND tipo.ativo = true
     AND v_regime = ANY(tipo.regimes)
    WHERE item.valor ->> 'ativo' = 'true'
  LOOP
    v_periodicidade := v_item.config ->> 'periodicidade';
    v_frequencia := CASE v_periodicidade
      WHEN 'diaria' THEN 'Diária'
      WHEN 'semanal' THEN 'Semanal'
      WHEN 'quinzenal' THEN 'Quinzenal'
      WHEN 'mensal' THEN 'Mensal'
      WHEN 'trimestral' THEN 'Trimestral'
      WHEN 'semestral' THEN 'Semestral'
      ELSE 'Personalizada'
    END;
    v_intervalo := CASE v_periodicidade
      WHEN 'diaria' THEN 1 WHEN 'semanal' THEN 7 WHEN 'quinzenal' THEN 15
      WHEN 'mensal' THEN 30 WHEN 'trimestral' THEN 90 WHEN 'semestral' THEN 180
      ELSE (v_item.config ->> 'intervaloDias')::integer
    END;
    v_ancora := (v_item.config ->> 'dataInicial')::date;
    v_dia_mes := CASE WHEN v_periodicidade IN ('mensal', 'trimestral', 'semestral')
      THEN (v_item.config ->> 'diaMes')::integer ELSE NULL END;
    v_dia_semana := CASE WHEN v_periodicidade = 'semanal'
      THEN (v_item.config ->> 'diaSemana')::integer ELSE NULL END;
    v_finais := COALESCE((v_item.config ->> 'incluirFinaisDeSemana')::boolean, false);
    v_base := app_private.primeira_data_base_rotina(
      v_hoje, v_frequencia, v_intervalo, v_ancora,
      v_dia_mes, v_dia_semana, v_finais
    );
    v_execucao := app_private.ajustar_data_rotina(v_base, v_finais);

    INSERT INTO public.atividades_rotinas AS rotina (
      empresa_id, modelo_id, cliente_id, protocolo_codigo, nome, categoria, frequencia,
      intervalo_dias, responsavel_nome, cliente_nome, proxima_execucao,
      data_ancora, dia_mes, dia_semana_iso, proxima_execucao_base,
      prioridade, checklist, observacoes, incluir_finais_de_semana, ativa
    ) VALUES (
      p_empresa_id, v_item.modelo_atividade_id, p_cliente_id, v_item.codigo, v_item.nome,
      CASE v_item.categoria
        WHEN 'Fiscal' THEN 'Fiscal' WHEN 'Trabalhista' THEN 'Folha'
        WHEN 'Financeiro' THEN 'Contábil' WHEN 'Contábil' THEN 'Contábil'
        ELSE 'Cliente' END,
      v_frequencia, v_intervalo, '', v_cliente_nome, v_execucao,
      v_ancora, v_dia_mes, v_dia_semana, v_base,
      'Média', CASE
        WHEN jsonb_typeof(v_item.etapas) = 'array'
             AND jsonb_array_length(v_item.etapas) > 0 THEN v_item.etapas
        ELSE jsonb_build_array(v_item.nome)
      END,
      COALESCE(nullif(btrim(v_item.descricao), ''),
        'Rotina gerada pela configuração de obrigações.'),
      v_finais, true
    )
    ON CONFLICT (empresa_id, cliente_id, protocolo_codigo)
      WHERE protocolo_codigo IS NOT NULL
    DO UPDATE SET
      modelo_id = EXCLUDED.modelo_id,
      nome = EXCLUDED.nome,
      categoria = EXCLUDED.categoria,
      frequencia = EXCLUDED.frequencia,
      intervalo_dias = EXCLUDED.intervalo_dias,
      cliente_nome = EXCLUDED.cliente_nome,
      checklist = EXCLUDED.checklist,
      observacoes = EXCLUDED.observacoes,
      incluir_finais_de_semana = EXCLUDED.incluir_finais_de_semana,
      ativa = true,
      data_ancora = EXCLUDED.data_ancora,
      dia_mes = EXCLUDED.dia_mes,
      dia_semana_iso = EXCLUDED.dia_semana_iso,
      proxima_execucao_base = CASE WHEN
        rotina.ativa IS DISTINCT FROM true
        OR rotina.frequencia IS DISTINCT FROM EXCLUDED.frequencia
        OR rotina.intervalo_dias IS DISTINCT FROM EXCLUDED.intervalo_dias
        OR rotina.data_ancora IS DISTINCT FROM EXCLUDED.data_ancora
        OR rotina.dia_mes IS DISTINCT FROM EXCLUDED.dia_mes
        OR rotina.dia_semana_iso IS DISTINCT FROM EXCLUDED.dia_semana_iso
        OR rotina.incluir_finais_de_semana IS DISTINCT FROM EXCLUDED.incluir_finais_de_semana
        THEN EXCLUDED.proxima_execucao_base ELSE rotina.proxima_execucao_base END,
      proxima_execucao = CASE WHEN
        rotina.ativa IS DISTINCT FROM true
        OR rotina.frequencia IS DISTINCT FROM EXCLUDED.frequencia
        OR rotina.intervalo_dias IS DISTINCT FROM EXCLUDED.intervalo_dias
        OR rotina.data_ancora IS DISTINCT FROM EXCLUDED.data_ancora
        OR rotina.dia_mes IS DISTINCT FROM EXCLUDED.dia_mes
        OR rotina.dia_semana_iso IS DISTINCT FROM EXCLUDED.dia_semana_iso
        OR rotina.incluir_finais_de_semana IS DISTINCT FROM EXCLUDED.incluir_finais_de_semana
        THEN EXCLUDED.proxima_execucao ELSE rotina.proxima_execucao END,
      atualizado_em = now();
  END LOOP;

  UPDATE public.atividades_rotinas rotina
  SET ativa = false, atualizado_em = now()
  WHERE rotina.empresa_id = p_empresa_id
    AND rotina.cliente_id = p_cliente_id
    AND rotina.protocolo_codigo IS NOT NULL
    AND rotina.ativa = true
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_configs) item(valor)
      WHERE btrim(item.valor ->> 'entregaId') = rotina.protocolo_codigo
        AND item.valor ->> 'ativo' = 'true'
    );

  -- O array legado continua coerente, mas modelos internos não vinculados a uma
  -- obrigação (por exemplo tarefas-internas) são preservados.
  UPDATE public.clientes cliente
  SET modelos_ativos = ARRAY(
    SELECT DISTINCT modelo_id
    FROM (
      SELECT existente AS modelo_id
      FROM unnest(cliente.modelos_ativos) existente
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.parametrizacao_protocolos_tipos tipo_legado
        WHERE tipo_legado.empresa_id = p_empresa_id
          AND (
            tipo_legado.modelo_atividade_id::text = existente
            OR tipo_legado.codigo = existente
          )
      )
      UNION ALL
      SELECT tipo_ativo.modelo_atividade_id::text
      FROM jsonb_array_elements(p_configs) item(valor)
      JOIN public.parametrizacao_protocolos_tipos tipo_ativo
        ON tipo_ativo.empresa_id = p_empresa_id
       AND tipo_ativo.codigo = btrim(item.valor ->> 'entregaId')
      WHERE item.valor ->> 'ativo' = 'true'
        AND tipo_ativo.modelo_atividade_id IS NOT NULL
    ) modelos
    WHERE modelo_id IS NOT NULL
  ), updated_at = now()
  WHERE cliente.empresa_id = p_empresa_id AND cliente.id = p_cliente_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sincronizar_rotinas_protocolos_cliente(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
