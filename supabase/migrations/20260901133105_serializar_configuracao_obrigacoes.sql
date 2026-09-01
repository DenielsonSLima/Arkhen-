-- Serializa a edição das obrigações e da configuração das empresas pelo mesmo
-- tenant lock, antes dos row locks usados pelo CAS.

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

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_empresa_id::text, 913331)
  );

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
    v_empresa_id, v_regime, p_configs
  );
  v_configs_normalizadas := app_private.normalizar_configs_protocolos_cliente(
    v_empresa_id, p_cliente_id, p_configs
  );
  PERFORM public.validar_configs_protocolos_operacionais(
    v_empresa_id, p_cliente_id, v_configs_normalizadas
  );

  INSERT INTO public.configuracoes_protocolos_empresas (
    empresa_id, cliente_id, configs
  ) VALUES (
    v_empresa_id, p_cliente_id, v_configs_normalizadas
  )
  ON CONFLICT (empresa_id, cliente_id) DO UPDATE
    SET configs = EXCLUDED.configs;

  PERFORM public.sincronizar_rotinas_protocolos_cliente(
    v_empresa_id, p_cliente_id, v_configs_normalizadas
  );

  RETURN public.obter_configuracao_protocolos_cliente(p_cliente_id);
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_configuracoes_protocolos_cliente_v2(
  uuid, jsonb, timestamptz
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_configuracoes_protocolos_cliente_v2(
  uuid, jsonb, timestamptz
) TO authenticated;
