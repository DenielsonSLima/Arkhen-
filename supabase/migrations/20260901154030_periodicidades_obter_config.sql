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
    'diaSemana', COALESCE(prazo.dia_semana_iso, tipo.dia_semana_iso),
    'mesVencimento', COALESCE(prazo.mes_vencimento, tipo.mes_vencimento),
    'dataVencimento', to_char(
      COALESCE(prazo.data_vencimento, tipo.data_vencimento), 'YYYY-MM-DD'
    ),
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
