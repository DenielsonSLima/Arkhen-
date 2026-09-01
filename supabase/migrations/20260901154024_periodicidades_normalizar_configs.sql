CREATE OR REPLACE FUNCTION app_private.normalizar_configs_protocolos_cliente(
  p_empresa_id uuid,
  p_cliente_id uuid,
  p_configs jsonb,
  p_referencia date DEFAULT (
    CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'
  )::date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_regime text;
  v_cliente_ancora date;
  v_item record;
  v_config jsonb;
  v_rotina public.atividades_rotinas%rowtype;
  v_periodicidade text;
  v_frequencia text;
  v_ativa boolean;
  v_data_inicial date;
  v_data_vencimento date;
  v_dia_mes integer;
  v_dia_semana integer;
  v_mes_vencimento integer;
  v_intervalo integer;
  v_intervalo_efetivo integer;
  v_finais boolean;
  v_proxima_base date;
  v_proxima date;
  v_ano_ancora integer;
  v_resultado jsonb := '[]'::jsonb;
BEGIN
  SELECT cliente.tipo,
    COALESCE(
      (cliente.created_at AT TIME ZONE 'America/Sao_Paulo')::date,
      p_referencia
    )
  INTO v_regime, v_cliente_ancora
  FROM public.clientes cliente
  WHERE cliente.id = p_cliente_id
    AND cliente.empresa_id = p_empresa_id
    AND cliente.status = 'Ativa';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configuração de protocolos não encontrada.'
      USING ERRCODE = '42501';
  END IF;

  FOR v_item IN
    SELECT
      tipo.codigo,
      tipo.categoria,
      tipo.nome,
      tipo.dia_limite,
      COALESCE(
        nullif(btrim(prazo.fechamento), ''),
        nullif(btrim(tipo.periodicidade_padrao), ''),
        'mensal'
      ) AS periodicidade_padrao,
      COALESCE(prazo.dia_vencimento, tipo.dia_limite) AS dia_vencimento,
      COALESCE(prazo.dia_semana_iso, tipo.dia_semana_iso) AS dia_semana_iso,
      COALESCE(prazo.mes_vencimento, tipo.mes_vencimento) AS mes_vencimento,
      COALESCE(prazo.data_vencimento, tipo.data_vencimento) AS data_vencimento
    FROM public.parametrizacao_protocolos_tipos tipo
    LEFT JOIN public.parametrizacao_prazos_entrega prazo
      ON prazo.empresa_id = tipo.empresa_id
     AND prazo.regime = v_regime
     AND prazo.entrega_id = tipo.codigo
     AND prazo.ativo = true
    WHERE tipo.empresa_id = p_empresa_id
      AND tipo.ativo = true
      AND v_regime = ANY(tipo.regimes)
    ORDER BY tipo.categoria, tipo.nome, tipo.codigo
  LOOP
    v_config := NULL;
    IF jsonb_typeof(p_configs) = 'array' THEN
      SELECT entrada.valor INTO v_config
      FROM jsonb_array_elements(p_configs) entrada(valor)
      WHERE entrada.valor ->> 'entregaId' = v_item.codigo
      LIMIT 1;
    END IF;

    v_rotina := NULL;
    SELECT rotina.* INTO v_rotina
    FROM public.atividades_rotinas rotina
    WHERE rotina.empresa_id = p_empresa_id
      AND rotina.cliente_id = p_cliente_id
      AND rotina.protocolo_codigo = v_item.codigo
    LIMIT 1;

    v_ativa := CASE WHEN jsonb_typeof(v_config -> 'ativo') = 'boolean'
      THEN (v_config ->> 'ativo')::boolean ELSE false END;
    -- Agenda é propriedade da obrigação. O JSON do parceiro só conserva o
    -- estado ativo; campos antigos de periodicidade/prazo não têm precedência.
    v_periodicidade := CASE
      WHEN v_item.periodicidade_padrao IN (
        'diaria', 'unica', 'semanal', 'quinzenal', 'mensal',
        'trimestral', 'semestral', 'anual', 'personalizada'
      ) THEN v_item.periodicidade_padrao
      ELSE 'mensal'
    END;

    -- Nenhuma agenda vem do parceiro: somente entregaId/ativo são lidos de
    -- p_configs. A âncora estável nasce do cadastro do cliente e do card.
    v_data_vencimento := CASE WHEN v_periodicidade = 'unica'
      THEN v_item.data_vencimento ELSE NULL END;
    v_dia_mes := COALESCE(
      CASE WHEN v_item.dia_vencimento BETWEEN 1 AND 31
        THEN v_item.dia_vencimento END,
      CASE WHEN v_item.dia_limite BETWEEN 1 AND 31 THEN v_item.dia_limite END,
      20
    );
    v_dia_semana := v_item.dia_semana_iso;
    v_mes_vencimento := v_item.mes_vencimento;

    IF v_periodicidade = 'unica' THEN
      v_data_inicial := v_data_vencimento;
    ELSIF v_periodicidade = 'anual' THEN
      v_ano_ancora := extract(year FROM v_cliente_ancora)::integer;
      v_data_inicial := app_private.data_mes_ancorada(
        make_date(v_ano_ancora, v_mes_vencimento, 1), v_dia_mes
      );
      IF v_data_inicial < v_cliente_ancora THEN
        v_data_inicial := app_private.data_mes_ancorada(
          make_date(v_ano_ancora + 1, v_mes_vencimento, 1), v_dia_mes
        );
      END IF;
    ELSIF v_periodicidade = 'mensal' THEN
      v_data_inicial := app_private.data_mes_ancorada(
        date_trunc('month', v_cliente_ancora::timestamp)::date, v_dia_mes
      );
      IF v_data_inicial < v_cliente_ancora THEN
        v_data_inicial := app_private.data_mes_ancorada(
          (date_trunc('month', v_cliente_ancora::timestamp)
            + interval '1 month')::date,
          v_dia_mes
        );
      END IF;
    ELSIF v_periodicidade = 'trimestral' THEN
      v_data_inicial := app_private.data_mes_ancorada(
        make_date(
          extract(year FROM v_cliente_ancora)::integer,
          ((extract(month FROM v_cliente_ancora)::integer + 2) / 3) * 3,
          1
        ),
        v_dia_mes
      );
      IF v_data_inicial < v_cliente_ancora THEN
        v_data_inicial := app_private.data_mes_ancorada(
          (date_trunc('month', v_data_inicial::timestamp)
            + interval '3 months')::date,
          v_dia_mes
        );
      END IF;
    ELSIF v_periodicidade = 'semestral' THEN
      v_data_inicial := app_private.data_mes_ancorada(
        make_date(
          extract(year FROM v_cliente_ancora)::integer,
          CASE WHEN extract(month FROM v_cliente_ancora)::integer <= 6
            THEN 6 ELSE 12 END,
          1
        ),
        v_dia_mes
      );
      IF v_data_inicial < v_cliente_ancora THEN
        v_data_inicial := app_private.data_mes_ancorada(
          (date_trunc('month', v_data_inicial::timestamp)
            + interval '6 months')::date,
          v_dia_mes
        );
      END IF;
    ELSE
      v_data_inicial := v_cliente_ancora;
    END IF;

    v_intervalo := COALESCE(
      CASE WHEN v_rotina.intervalo_dias BETWEEN 1 AND 366
        THEN v_rotina.intervalo_dias END,
      30
    );
    v_intervalo_efetivo := CASE v_periodicidade
      WHEN 'diaria' THEN 1
      WHEN 'unica' THEN 1
      WHEN 'semanal' THEN 7
      WHEN 'quinzenal' THEN 15
      WHEN 'mensal' THEN 30
      WHEN 'trimestral' THEN 90
      WHEN 'semestral' THEN 180
      WHEN 'anual' THEN 365
      ELSE v_intervalo
    END;
    v_finais := false;
    v_frequencia := CASE v_periodicidade
      WHEN 'diaria' THEN 'Diária'
      WHEN 'unica' THEN 'Única'
      WHEN 'semanal' THEN 'Semanal'
      WHEN 'quinzenal' THEN 'Quinzenal'
      WHEN 'mensal' THEN 'Mensal'
      WHEN 'trimestral' THEN 'Trimestral'
      WHEN 'semestral' THEN 'Semestral'
      ELSE 'Personalizada'
    END;

    IF v_data_inicial IS NULL
       OR (v_periodicidade = 'semanal' AND v_dia_semana IS NULL)
       OR (v_periodicidade = 'anual' AND v_mes_vencimento IS NULL) THEN
      RAISE EXCEPTION 'Agenda canônica incompleta para a obrigação %.', v_item.codigo
        USING ERRCODE = '22023';
    END IF;

    IF v_rotina.id IS NOT NULL
       AND v_rotina.frequencia = v_frequencia
       AND v_rotina.intervalo_dias = v_intervalo_efetivo
       AND v_rotina.data_ancora = v_data_inicial
       AND v_rotina.dia_mes IS NOT DISTINCT FROM (CASE
         WHEN v_periodicidade IN (
           'mensal', 'trimestral', 'semestral', 'anual'
         ) THEN v_dia_mes ELSE NULL END)
       AND v_rotina.dia_semana_iso IS NOT DISTINCT FROM (CASE
         WHEN v_periodicidade = 'semanal' THEN v_dia_semana ELSE NULL END)
       AND v_rotina.incluir_finais_de_semana = v_finais THEN
      v_proxima := v_rotina.proxima_execucao;
    ELSE
      v_proxima_base := app_private.primeira_data_base_rotina(
        p_referencia,
        v_frequencia,
        v_intervalo_efetivo,
        v_data_inicial,
        CASE WHEN v_periodicidade IN (
          'mensal', 'trimestral', 'semestral', 'anual'
        ) THEN v_dia_mes ELSE NULL END,
        CASE WHEN v_periodicidade = 'semanal' THEN v_dia_semana ELSE NULL END,
        v_finais
      );
      v_proxima := app_private.ajustar_data_rotina(v_proxima_base, v_finais);
    END IF;

    v_resultado := v_resultado || jsonb_build_array(
      jsonb_build_object(
        'entregaId', v_item.codigo,
        'ativo', v_ativa,
        'periodicidade', v_periodicidade,
        'dataInicial', to_char(v_data_inicial, 'YYYY-MM-DD'),
        'proximaExecucao', to_char(v_proxima, 'YYYY-MM-DD'),
        'incluirFinaisDeSemana', v_finais
      )
      || CASE WHEN v_periodicidade IN (
        'mensal', 'trimestral', 'semestral', 'anual'
      ) THEN jsonb_build_object('diaMes', v_dia_mes) ELSE '{}'::jsonb END
      || CASE WHEN v_periodicidade = 'semanal'
        THEN jsonb_build_object('diaSemana', v_dia_semana) ELSE '{}'::jsonb END
      || CASE WHEN v_periodicidade = 'anual'
        THEN jsonb_build_object('mesVencimento', v_mes_vencimento)
        ELSE '{}'::jsonb END
      || CASE WHEN v_periodicidade = 'unica'
        THEN jsonb_build_object(
          'dataVencimento', to_char(v_data_vencimento, 'YYYY-MM-DD')
        ) ELSE '{}'::jsonb END
      || CASE WHEN v_periodicidade = 'personalizada'
        THEN jsonb_build_object('intervaloDias', v_intervalo)
        ELSE '{}'::jsonb END
    );
  END LOOP;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION app_private.normalizar_configs_protocolos_cliente(
  uuid, uuid, jsonb, date
) FROM PUBLIC, anon, authenticated;
