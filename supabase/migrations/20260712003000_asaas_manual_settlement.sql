-- Baixa manual de contas a receber com cancelamento da cobranca aberta no Asaas.

CREATE OR REPLACE FUNCTION public.preparar_baixa_manual_asaas(
  p_user_id uuid,
  p_cobranca_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.resolve_empresa_id_for_user(p_user_id);
  v_cobranca public.financeiro_cobrancas;
  v_config jsonb;
  v_environment text;
  v_environment_config jsonb;
  v_api_key_secret_id uuid;
  v_api_key text;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  SELECT *
    INTO v_cobranca
  FROM public.financeiro_cobrancas c
  WHERE c.id = p_cobranca_id
    AND c.empresa_id = v_empresa_id
  LIMIT 1;

  IF v_cobranca.id IS NULL THEN
    RAISE EXCEPTION 'Cobranca nao encontrada para esta empresa.';
  END IF;

  IF v_cobranca.status IN ('Pago', 'Cancelado') THEN
    RAISE EXCEPTION 'Apenas cobrancas em aberto podem receber baixa manual.';
  END IF;

  IF NULLIF(v_cobranca.asaas_cobranca_id, '') IS NULL THEN
    RETURN jsonb_build_object(
      'empresaId', v_empresa_id,
      'cancelAsaas', false,
      'cobranca', jsonb_build_object(
        'id', v_cobranca.id,
        'valor', v_cobranca.valor,
        'descricao', v_cobranca.descricao
      )
    );
  END IF;

  SELECT c.configuracao
    INTO v_config
  FROM public.configuracoes_integracao_bancaria c
  WHERE c.empresa_id = v_empresa_id
    AND c.provedor = 'asaas'
  LIMIT 1;

  IF v_config IS NULL THEN
    RAISE EXCEPTION 'Integracao Asaas nao configurada.';
  END IF;

  v_environment := public.normalize_asaas_environment(coalesce(v_cobranca.asaas_ambiente, v_config->>'activeEnvironment', 'homologacao'));
  v_environment_config := coalesce(v_config->'environments'->v_environment, '{}'::jsonb);
  v_api_key_secret_id := NULLIF(v_environment_config->>'api_key_secret_id', '')::uuid;

  IF v_api_key_secret_id IS NULL THEN
    RAISE EXCEPTION 'Chave de API Asaas nao configurada para o ambiente da cobranca.';
  END IF;

  SELECT ds.decrypted_secret
    INTO v_api_key
  FROM vault.decrypted_secrets ds
  WHERE ds.id = v_api_key_secret_id
  LIMIT 1;

  IF NULLIF(trim(coalesce(v_api_key, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Chave de API Asaas indisponivel no Vault.';
  END IF;

  RETURN jsonb_build_object(
    'empresaId', v_empresa_id,
    'cancelAsaas', true,
    'environment', v_environment,
    'baseUrl', CASE WHEN v_environment = 'producao' THEN 'https://api.asaas.com/v3' ELSE 'https://api-sandbox.asaas.com/v3' END,
    'apiKey', v_api_key,
    'paymentId', v_cobranca.asaas_cobranca_id,
    'cobranca', jsonb_build_object(
      'id', v_cobranca.id,
      'valor', v_cobranca.valor,
      'descricao', v_cobranca.descricao
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_baixa_manual_financeira(
  p_user_id uuid,
  p_cobranca_id uuid,
  p_asaas_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS public.financeiro_cobrancas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.resolve_empresa_id_for_user(p_user_id);
  v_cobranca public.financeiro_cobrancas;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  UPDATE public.financeiro_cobrancas
  SET status = 'Pago',
      data_pagamento = now(),
      asaas_status = CASE
        WHEN NULLIF(asaas_cobranca_id, '') IS NOT NULL THEN 'MANUAL_SETTLEMENT_ASAAS_CANCELLED'
        ELSE asaas_status
      END,
      asaas_invoice_url = CASE WHEN NULLIF(asaas_cobranca_id, '') IS NOT NULL THEN NULL ELSE asaas_invoice_url END,
      asaas_bank_slip_url = CASE WHEN NULLIF(asaas_cobranca_id, '') IS NOT NULL THEN NULL ELSE asaas_bank_slip_url END,
      asaas_boleto_url = CASE WHEN NULLIF(asaas_cobranca_id, '') IS NOT NULL THEN NULL ELSE asaas_boleto_url END,
      asaas_payload = coalesce(asaas_payload, '{}'::jsonb) || jsonb_build_object('manualSettlement', coalesce(p_asaas_payload, '{}'::jsonb)),
      asaas_synced_at = now(),
      updated_at = now()
  WHERE id = p_cobranca_id
    AND empresa_id = v_empresa_id
    AND status NOT IN ('Pago', 'Cancelado')
  RETURNING * INTO v_cobranca;

  IF v_cobranca.id IS NULL THEN
    RAISE EXCEPTION 'Cobranca nao encontrada ou ja baixada.';
  END IF;

  INSERT INTO public.financeiro_lancamentos (
    empresa_id, cliente_empresa_id, tipo, origem, descricao, categoria, valor,
    data_competencia, data_pagamento, status, referencia_id, metadados
  )
  SELECT
    v_empresa_id, v_cobranca.cliente_empresa_id, 'receita', 'cobranca',
    v_cobranca.descricao, v_cobranca.categoria, v_cobranca.valor,
    v_cobranca.data_vencimento, CURRENT_DATE, 'Pago', v_cobranca.id,
    jsonb_build_object('baixaManual', true, 'asaasPaymentId', v_cobranca.asaas_cobranca_id)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.financeiro_lancamentos fl
    WHERE fl.empresa_id = v_empresa_id
      AND fl.origem = 'cobranca'
      AND fl.referencia_id = v_cobranca.id
  );

  RETURN v_cobranca;
END;
$$;

REVOKE ALL ON FUNCTION public.preparar_baixa_manual_asaas(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_baixa_manual_financeira(uuid, uuid, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.preparar_baixa_manual_asaas(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_baixa_manual_financeira(uuid, uuid, jsonb) TO service_role;
