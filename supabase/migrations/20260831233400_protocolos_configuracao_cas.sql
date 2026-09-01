-- Evita que duas telas abertas sobrescrevam silenciosamente a configuração
-- completa de acompanhamento de uma empresa.

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
  WHERE cfg.empresa_id = v_empresa_id
    AND cfg.cliente_id = p_cliente_id;

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
    END
  ) ORDER BY tipo.categoria, tipo.nome), '[]'::jsonb)
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
    COALESCE(v_configs_salvas, '[]'::jsonb)
  );

  RETURN jsonb_build_object(
    'catalogo', v_catalogo,
    'configs', v_configs,
    'updatedAt', to_jsonb(v_updated_at)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.salvar_configuracoes_protocolos_cliente_v2(
  p_cliente_id uuid,
  p_configs jsonb,
  p_expected_updated_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_regime text;
  v_configs_normalizadas jsonb;
  v_updated_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR NOT COALESCE(
       public.current_user_has_permission(v_empresa_id, 'protocolos:manage'), false
     ) THEN
    RAISE EXCEPTION 'Configuração de acompanhamento não encontrada.'
      USING ERRCODE = '42501';
  END IF;
  IF p_cliente_id IS NULL OR NOT COALESCE(
    public.current_user_can_access_client_row(v_empresa_id, p_cliente_id), false
  ) THEN
    RAISE EXCEPTION 'Configuração de acompanhamento não encontrada.'
      USING ERRCODE = '42501';
  END IF;

  -- Todas as gravações do mesmo cliente obedecem à mesma ordem de bloqueio.
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
    )
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configuração de acompanhamento não encontrada.'
      USING ERRCODE = '42501';
  END IF;

  SELECT cfg.updated_at INTO v_updated_at
  FROM public.configuracoes_protocolos_empresas cfg
  WHERE cfg.empresa_id = v_empresa_id
    AND cfg.cliente_id = p_cliente_id
  FOR UPDATE;

  IF FOUND THEN
    IF p_expected_updated_at IS NULL
       OR v_updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'Configuração alterada por outro usuário.'
        USING ERRCODE = '40001';
    END IF;
  ELSIF p_expected_updated_at IS NOT NULL THEN
    RAISE EXCEPTION 'Configuração alterada por outro usuário.'
      USING ERRCODE = '40001';
  END IF;

  PERFORM app_private.validar_envelope_configs_protocolos_cliente(
    v_empresa_id,
    v_regime,
    p_configs
  );
  v_configs_normalizadas := app_private.normalizar_configs_protocolos_cliente(
    v_empresa_id,
    p_cliente_id,
    p_configs
  );
  PERFORM public.validar_configs_protocolos_operacionais(
    v_empresa_id,
    p_cliente_id,
    v_configs_normalizadas
  );

  INSERT INTO public.configuracoes_protocolos_empresas (
    empresa_id,
    cliente_id,
    configs
  ) VALUES (
    v_empresa_id,
    p_cliente_id,
    v_configs_normalizadas
  )
  ON CONFLICT (empresa_id, cliente_id) DO UPDATE
    SET configs = EXCLUDED.configs;

  PERFORM public.sincronizar_rotinas_protocolos_cliente(
    v_empresa_id,
    p_cliente_id,
    v_configs_normalizadas
  );

  RETURN public.obter_configuracao_protocolos_cliente(p_cliente_id);
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_configuracoes_protocolos_cliente(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.salvar_configuracoes_protocolos_cliente_v2(
  uuid, jsonb, timestamptz
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_configuracoes_protocolos_cliente_v2(
  uuid, jsonb, timestamptz
) TO authenticated;

REVOKE ALL ON FUNCTION public.obter_configuracao_protocolos_cliente(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_configuracao_protocolos_cliente(uuid)
  TO authenticated;
