-- A projeção legal preserva os IDs das periodicidades antigas. As novas usam
-- a data-base na chave, garantindo idempotência inclusive após ajuste de fim
-- de semana. Única permanece visível como uma ocorrência; anual projeta o ano
-- corrente (ou o primeiro ano aplicável ao cliente/âncora).
CREATE OR REPLACE FUNCTION public.get_protocolos_operacionais()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_hoje date := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;
  v_resultado jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL OR NOT COALESCE(
    public.current_user_has_permission(v_empresa_id, 'protocolos:view')
    OR public.current_user_has_permission(v_empresa_id, 'protocolos:create')
    OR public.current_user_has_permission(v_empresa_id, 'protocolos:manage')
    OR public.current_user_has_permission(v_empresa_id, 'protocolos:view-own'),
    false
  ) THEN
    RAISE EXCEPTION 'Protocolos não encontrados.' USING ERRCODE = '42501';
  END IF;

  WITH janela AS (
    SELECT
      (date_trunc('month', v_hoje::timestamp) - interval '2 months')::date AS inicio,
      (date_trunc('month', v_hoje::timestamp) + interval '1 month - 1 day')::date AS fim
  ), competencias AS (
    SELECT (
      date_trunc('month', v_hoje::timestamp)
      - make_interval(months => deslocamento)
    )::date AS competencia
    FROM generate_series(0, 2) deslocamento
  ), bases AS (
    SELECT
      cliente.id AS cliente_id,
      cliente.nome AS cliente_nome,
      COALESCE(cliente.cnpj, '') AS cliente_cnpj,
      cliente.status AS cliente_status,
      cliente.tipo AS cliente_tipo,
      cliente.tipo_estabelecimento,
      COALESCE(cliente.email, '') AS cliente_email,
      COALESCE(cliente.telefone, '') AS cliente_telefone,
      cliente.logo AS cliente_logo,
      (cliente.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS cliente_criado_em,
      tipo.codigo AS entrega_id,
      tipo.nome AS entrega_nome,
      tipo.categoria,
      tipo.orgao,
      tipo.origem_padrao,
      COALESCE(
        prazo.fechamento,
        tipo.periodicidade_padrao,
        'mensal'
      ) AS fechamento,
      COALESCE(prazo.referencia_mes_anterior, tipo.referencia_mes_anterior, true)
        AS referencia_mes_anterior,
      COALESCE(prazo.dia_vencimento, tipo.dia_limite) AS dia_vencimento,
      COALESCE(
        prazo.dia_vencimento_primeira_quinzena,
        tipo.dia_vencimento_primeira_quinzena,
        15
      ) AS dia_primeira,
      COALESCE(
        prazo.dia_vencimento_segunda_quinzena,
        tipo.dia_vencimento_segunda_quinzena,
        prazo.dia_vencimento,
        tipo.dia_limite
      ) AS dia_segunda,
      COALESCE(
        prazo.dia_semana_iso,
        tipo.dia_semana_iso
      ) AS dia_semana_iso,
      COALESCE(
        prazo.mes_vencimento,
        tipo.mes_vencimento
      ) AS mes_vencimento,
      COALESCE(
        prazo.data_vencimento,
        tipo.data_vencimento
      ) AS data_vencimento,
      false AS incluir_finais_de_semana
    FROM public.clientes cliente
    JOIN public.configuracoes_protocolos_empresas configuracao
      ON configuracao.empresa_id = cliente.empresa_id
     AND configuracao.cliente_id = cliente.id
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(configuracao.configs) = 'array'
        THEN configuracao.configs ELSE '[]'::jsonb END
    ) config_item(valor)
    JOIN public.parametrizacao_protocolos_tipos tipo
      ON tipo.empresa_id = cliente.empresa_id
     AND tipo.codigo = config_item.valor ->> 'entregaId'
     AND tipo.ativo = true
     AND tipo.tem_vencimento = true
     AND cliente.tipo = ANY(tipo.regimes)
    LEFT JOIN public.parametrizacao_prazos_entrega prazo
      ON prazo.empresa_id = cliente.empresa_id
     AND prazo.regime = cliente.tipo
     AND prazo.entrega_id = tipo.codigo
    WHERE cliente.empresa_id = v_empresa_id
      AND cliente.status = 'Ativa'
      AND config_item.valor ->> 'ativo' = 'true'
      AND (prazo.id IS NULL OR prazo.ativo = true)
      AND public.current_user_can_access_client_row(cliente.empresa_id, cliente.id)
  ), periodos_legados AS (
    SELECT
      base.*,
      competencia.competencia,
      periodo.periodo_referencia,
      periodo.periodo_key,
      periodo.dia
    FROM bases base
    CROSS JOIN competencias competencia
    CROSS JOIN LATERAL (
      SELECT 'Mensal'::text, 'mensal'::text, base.dia_vencimento
      WHERE base.fechamento = 'mensal'
      UNION ALL
      SELECT '1ª quinzena', 'q1', base.dia_primeira
      WHERE base.fechamento = 'quinzenal'
      UNION ALL
      SELECT '2ª quinzena', 'q2', base.dia_segunda
      WHERE base.fechamento = 'quinzenal'
      UNION ALL
      SELECT 'Trimestral', 'trimestral', base.dia_vencimento
      WHERE base.fechamento = 'trimestral'
        AND extract(month FROM competencia.competencia)::integer IN (3, 6, 9, 12)
      UNION ALL
      SELECT 'Semestral', 'semestral', base.dia_vencimento
      WHERE base.fechamento = 'semestral'
        AND extract(month FROM competencia.competencia)::integer IN (6, 12)
    ) periodo(periodo_referencia, periodo_key, dia)
    WHERE competencia.competencia >= date_trunc(
      'month', base.cliente_criado_em::timestamp
    )::date
  ), projetados_legados AS (
    SELECT
      periodo.cliente_id,
      periodo.cliente_nome,
      periodo.cliente_cnpj,
      periodo.cliente_status,
      periodo.cliente_tipo,
      periodo.tipo_estabelecimento,
      periodo.cliente_email,
      periodo.cliente_telefone,
      periodo.cliente_logo,
      periodo.entrega_id,
      periodo.entrega_nome,
      periodo.categoria,
      periodo.orgao,
      periodo.origem_padrao,
      periodo.competencia,
      periodo.periodo_referencia,
      periodo.cliente_id::text || '-' || to_char(periodo.competencia, 'YYYY-MM')
        || '-' || periodo.entrega_id || '-' || periodo.periodo_key AS protocolo_id,
      (
        date_trunc('month', periodo.competencia + CASE
          WHEN periodo.referencia_mes_anterior THEN interval '1 month'
          ELSE interval '0 month'
        END)
        + (least(
          periodo.dia,
          extract(day FROM (
            date_trunc('month', periodo.competencia + CASE
              WHEN periodo.referencia_mes_anterior THEN interval '2 months'
              ELSE interval '1 month'
            END) - interval '1 day'
          ))::integer
        ) - 1) * interval '1 day'
      )::date AS prazo
    FROM periodos_legados periodo
  ), calendario AS (
    SELECT dia::date AS data_base
    FROM janela
    CROSS JOIN LATERAL generate_series(
      janela.inicio::timestamp,
      janela.fim::timestamp,
      interval '1 day'
    ) dia
  ), projetados_diarios_semanais AS (
    SELECT
      base.cliente_id,
      base.cliente_nome,
      base.cliente_cnpj,
      base.cliente_status,
      base.cliente_tipo,
      base.tipo_estabelecimento,
      base.cliente_email,
      base.cliente_telefone,
      base.cliente_logo,
      base.entrega_id,
      base.entrega_nome,
      base.categoria,
      base.orgao,
      base.origem_padrao,
      date_trunc('month', calendario.data_base::timestamp)::date AS competencia,
      CASE base.fechamento WHEN 'diaria' THEN 'Diária' ELSE 'Semanal' END
        AS periodo_referencia,
      base.cliente_id::text || '-' || to_char(calendario.data_base, 'YYYY-MM-DD')
        || '-' || base.entrega_id || '-' || base.fechamento AS protocolo_id,
      app_private.ajustar_data_rotina(
        calendario.data_base, base.incluir_finais_de_semana
      ) AS prazo
    FROM bases base
    CROSS JOIN calendario
    CROSS JOIN janela
    WHERE base.fechamento IN ('diaria', 'semanal')
      AND calendario.data_base >= greatest(
        janela.inicio,
        base.cliente_criado_em
      )
      AND (
        (base.fechamento = 'diaria' AND (
          base.incluir_finais_de_semana
          OR extract(isodow FROM calendario.data_base)::integer NOT IN (6, 7)
        ))
        OR (base.fechamento = 'semanal'
          AND extract(isodow FROM calendario.data_base)::integer = base.dia_semana_iso)
      )
  ), projetados_unicos AS (
    SELECT
      base.cliente_id,
      base.cliente_nome,
      base.cliente_cnpj,
      base.cliente_status,
      base.cliente_tipo,
      base.tipo_estabelecimento,
      base.cliente_email,
      base.cliente_telefone,
      base.cliente_logo,
      base.entrega_id,
      base.entrega_nome,
      base.categoria,
      base.orgao,
      base.origem_padrao,
      date_trunc('month', unica.data_base::timestamp)::date AS competencia,
      'Única'::text AS periodo_referencia,
      base.cliente_id::text || '-' || to_char(unica.data_base, 'YYYY-MM-DD')
        || '-' || base.entrega_id || '-unica' AS protocolo_id,
      app_private.ajustar_data_rotina(
        unica.data_base, base.incluir_finais_de_semana
      ) AS prazo
    FROM bases base
    CROSS JOIN LATERAL (
      SELECT base.data_vencimento AS data_base
    ) unica
    WHERE base.fechamento = 'unica'
      AND unica.data_base IS NOT NULL
      AND unica.data_base >= base.cliente_criado_em
  ), anuais_preparados AS (
    SELECT
      base.*,
      greatest(
        extract(year FROM v_hoje)::integer,
        extract(year FROM base.cliente_criado_em)::integer
      ) AS ano_base
    FROM bases base
    WHERE base.fechamento = 'anual'
      AND base.mes_vencimento BETWEEN 1 AND 12
      AND base.dia_vencimento BETWEEN 1 AND 31
  ), projetados_anuais AS (
    SELECT
      base.cliente_id,
      base.cliente_nome,
      base.cliente_cnpj,
      base.cliente_status,
      base.cliente_tipo,
      base.tipo_estabelecimento,
      base.cliente_email,
      base.cliente_telefone,
      base.cliente_logo,
      base.entrega_id,
      base.entrega_nome,
      base.categoria,
      base.orgao,
      base.origem_padrao,
      date_trunc('month', anual.data_base::timestamp)::date AS competencia,
      'Anual'::text AS periodo_referencia,
      base.cliente_id::text || '-' || extract(year FROM anual.data_base)::integer::text
        || '-' || base.entrega_id || '-anual' AS protocolo_id,
      app_private.ajustar_data_rotina(
        anual.data_base, base.incluir_finais_de_semana
      ) AS prazo
    FROM anuais_preparados base
    CROSS JOIN LATERAL (
      SELECT app_private.data_mes_ancorada(
        make_date(base.ano_base, base.mes_vencimento, 1), base.dia_vencimento
      ) AS candidata
    ) inicial
    CROSS JOIN LATERAL (
      SELECT CASE WHEN inicial.candidata < base.cliente_criado_em
        THEN app_private.data_mes_ancorada(
        make_date(base.ano_base + 1, base.mes_vencimento, 1), base.dia_vencimento
      ) ELSE inicial.candidata END AS data_base
    ) anual
  ), projetados AS (
    SELECT * FROM projetados_legados
    UNION ALL
    SELECT * FROM projetados_diarios_semanais
    UNION ALL
    SELECT * FROM projetados_unicos
    UNION ALL
    SELECT * FROM projetados_anuais
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', projetado.protocolo_id,
    'empresaId', projetado.cliente_id::text,
    'empresaNome', projetado.cliente_nome,
    'empresaCnpj', projetado.cliente_cnpj,
    'empresaStatus', projetado.cliente_status,
    'empresaTipo', projetado.cliente_tipo,
    'empresaTipoEstabelecimento', projetado.tipo_estabelecimento,
    'empresaEmail', projetado.cliente_email,
    'empresaTelefone', projetado.cliente_telefone,
    'empresaLogo', projetado.cliente_logo,
    'competencia', to_char(projetado.competencia, 'YYYY-MM'),
    'periodoReferencia', projetado.periodo_referencia,
    'entregaId', projetado.entrega_id,
    'entregaNome', projetado.entrega_nome,
    'categoria', projetado.categoria,
    'orgao', projetado.orgao,
    'origemPadrao', COALESCE(projetado.origem_padrao, 'Ambos'),
    'prazo', projetado.prazo::text,
    'status', COALESCE(salvo.status, 'Pendente'),
    'atualizadoEm', COALESCE(salvo.atualizado_em::text, ''),
    'responsavel', '',
    'anotacoesList', COALESCE(salvo.anotacoes_list, '[]'::jsonb),
    'recebidoEm', COALESCE(salvo.recebido_em::text, ''),
    'concluidoPor', COALESCE(salvo.concluido_por, '')
  ) ORDER BY projetado.competencia DESC, projetado.prazo,
    projetado.cliente_nome, projetado.entrega_nome), '[]'::jsonb)
  INTO v_resultado
  FROM projetados projetado
  LEFT JOIN public.protocolos_entregas salvo
    ON salvo.id = projetado.protocolo_id
   AND salvo.empresa_id = v_empresa_id
   AND salvo.cliente_id = projetado.cliente_id
   AND salvo.entrega_id = projetado.entrega_id
   AND salvo.competencia = to_char(projetado.competencia, 'YYYY-MM')
   AND salvo.periodo_referencia = projetado.periodo_referencia;

  RETURN v_resultado;
END;
$$;
