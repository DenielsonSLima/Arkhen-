-- Persiste as regras enviadas na criacao da cobranca Asaas para auditoria local.

CREATE OR REPLACE FUNCTION public.registrar_cobranca_asaas(
  p_user_id uuid,
  p_payload jsonb
)
RETURNS public.financeiro_cobrancas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.resolve_empresa_id_for_user(p_user_id);
  v_cliente_id uuid := NULLIF(p_payload->>'cliente_empresa_id', '')::uuid;
  v_contrato_id uuid := NULLIF(p_payload->>'contrato_id', '')::uuid;
  v_asaas_customer_id text := NULLIF(p_payload->>'asaas_customer_id', '');
  v_environment text := public.normalize_asaas_environment(p_payload->>'ambiente');
  v_payment jsonb := coalesce(p_payload->'payment', '{}'::jsonb);
  v_request_rules jsonb := coalesce(p_payload->'regras', '{}'::jsonb);
  v_status text := public.map_asaas_payment_status(v_payment->>'status', NULL);
  v_row public.financeiro_cobrancas;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Cliente obrigatorio.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clientes c WHERE c.id = v_cliente_id AND c.empresa_id = v_empresa_id
  ) THEN
    RAISE EXCEPTION 'Cliente nao encontrado para esta empresa.';
  END IF;

  IF v_asaas_customer_id IS NOT NULL THEN
    UPDATE public.clientes
    SET asaas_customer_ids = jsonb_set(coalesce(asaas_customer_ids, '{}'::jsonb), ARRAY[v_environment], to_jsonb(v_asaas_customer_id), true),
        updated_at = now()
    WHERE id = v_cliente_id
      AND empresa_id = v_empresa_id;
  END IF;

  INSERT INTO public.financeiro_cobrancas (
    empresa_id, contrato_id, cliente_empresa_id, descricao, categoria, valor, data_vencimento,
    status, meio_pagamento, asaas_cobranca_id, asaas_boleto_url, asaas_invoice_url,
    asaas_bank_slip_url, asaas_billing_type, asaas_status, asaas_ambiente, asaas_payload,
    asaas_synced_at
  )
  VALUES (
    v_empresa_id,
    v_contrato_id,
    v_cliente_id,
    COALESCE(NULLIF(p_payload->>'descricao', ''), 'Cobranca avulsa'),
    COALESCE(NULLIF(p_payload->>'categoria', ''), 'Faturamento'),
    COALESCE((p_payload->>'valor')::numeric, 0),
    COALESCE((p_payload->>'data_vencimento')::date, CURRENT_DATE),
    v_status,
    COALESCE(NULLIF(p_payload->>'meio_pagamento', ''), 'Boleto'),
    NULLIF(v_payment->>'id', ''),
    COALESCE(NULLIF(v_payment->>'bankSlipUrl', ''), NULLIF(v_payment->>'invoiceUrl', '')),
    NULLIF(v_payment->>'invoiceUrl', ''),
    NULLIF(v_payment->>'bankSlipUrl', ''),
    NULLIF(v_payment->>'billingType', ''),
    NULLIF(v_payment->>'status', ''),
    v_environment,
    v_payment || jsonb_build_object('requestRules', v_request_rules),
    now()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_cobranca_asaas(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_cobranca_asaas(uuid, jsonb) TO service_role;
