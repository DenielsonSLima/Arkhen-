CREATE OR REPLACE FUNCTION app_private.mesclar_configs_obrigacoes_legadas(
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
      'dataInicial', CASE tipo.periodicidade_padrao
        WHEN 'unica' THEN to_char(tipo.data_vencimento, 'YYYY-MM-DD')
        WHEN 'anual' THEN to_char(app_private.data_mes_ancorada(
          make_date(extract(year FROM p_referencia)::integer, tipo.mes_vencimento, 1),
          tipo.dia_limite
        ), 'YYYY-MM-DD')
        ELSE to_char(p_referencia, 'YYYY-MM-DD')
      END,
      'incluirFinaisDeSemana', false
    )
    || CASE WHEN tipo.periodicidade_padrao IN (
      'mensal', 'trimestral', 'semestral', 'anual'
    ) THEN jsonb_build_object('diaMes', tipo.dia_limite)
      ELSE '{}'::jsonb END
    || CASE WHEN tipo.periodicidade_padrao = 'semanal'
      THEN jsonb_build_object('diaSemana', tipo.dia_semana_iso)
      ELSE '{}'::jsonb END
    || CASE WHEN tipo.periodicidade_padrao = 'anual'
      THEN jsonb_build_object('mesVencimento', tipo.mes_vencimento)
      ELSE '{}'::jsonb END
    || CASE WHEN tipo.periodicidade_padrao = 'unica'
      THEN jsonb_build_object(
        'dataVencimento', to_char(tipo.data_vencimento, 'YYYY-MM-DD')
      ) ELSE '{}'::jsonb END
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
