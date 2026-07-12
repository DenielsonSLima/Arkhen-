-- Integra cobranças financeiras reais com Asaas via Edge Function.

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS asaas_customer_ids jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.financeiro_cobrancas
  ADD COLUMN IF NOT EXISTS asaas_invoice_url text,
  ADD COLUMN IF NOT EXISTS asaas_bank_slip_url text,
  ADD COLUMN IF NOT EXISTS asaas_billing_type varchar(30),
  ADD COLUMN IF NOT EXISTS asaas_status varchar(40),
  ADD COLUMN IF NOT EXISTS asaas_ambiente text NOT NULL DEFAULT 'homologacao',
  ADD COLUMN IF NOT EXISTS asaas_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS asaas_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_financeiro_cobrancas_asaas_id
  ON public.financeiro_cobrancas(empresa_id, asaas_cobranca_id)
  WHERE asaas_cobranca_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.resolve_empresa_id_for_user(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.empresa_id
  FROM public.perfis p
  WHERE p.user_id = p_user_id
    AND p.ativo = true
  ORDER BY p.created_at
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.map_asaas_payment_status(p_status text, p_event text DEFAULT NULL)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN upper(coalesce(p_event, '')) IN ('PAYMENT_DELETED', 'PAYMENT_REFUNDED', 'PAYMENT_REFUND_IN_PROGRESS')
      OR upper(coalesce(p_status, '')) IN ('DELETED', 'REFUNDED', 'REFUND_IN_PROGRESS') THEN 'Cancelado'
    WHEN upper(coalesce(p_event, '')) IN ('PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED')
      OR upper(coalesce(p_status, '')) IN ('RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH') THEN 'Pago'
    WHEN upper(coalesce(p_event, '')) = 'PAYMENT_OVERDUE'
      OR upper(coalesce(p_status, '')) = 'OVERDUE' THEN 'Vencido'
    ELSE 'Pendente'
  END
$$;

CREATE OR REPLACE FUNCTION public.preparar_cobranca_asaas(
  p_user_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.resolve_empresa_id_for_user(p_user_id);
  v_cliente_id uuid := NULLIF(p_payload->>'cliente_empresa_id', '')::uuid;
  v_contrato_id uuid := NULLIF(p_payload->>'contrato_id', '')::uuid;
  v_cliente public.clientes;
  v_config jsonb;
  v_environment text;
  v_environment_config jsonb;
  v_api_key_secret_id uuid;
  v_api_key text;
  v_asaas_customer_id text;
  v_valor numeric := COALESCE((p_payload->>'valor')::numeric, 0);
  v_vencimento date := COALESCE((p_payload->>'data_vencimento')::date, CURRENT_DATE);
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Cliente obrigatorio para gerar cobranca.';
  END IF;

  IF v_valor <= 0 THEN
    RAISE EXCEPTION 'Valor da cobranca deve ser maior que zero.';
  END IF;

  SELECT *
    INTO v_cliente
  FROM public.clientes c
  WHERE c.id = v_cliente_id
    AND c.empresa_id = v_empresa_id
  LIMIT 1;

  IF v_cliente.id IS NULL THEN
    RAISE EXCEPTION 'Cliente nao encontrado para esta empresa.';
  END IF;

  IF v_contrato_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.financeiro_configuracoes fc
    WHERE fc.id = v_contrato_id
      AND fc.empresa_id = v_empresa_id
  ) THEN
    RAISE EXCEPTION 'Recorrencia financeira nao encontrada.';
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

  v_environment := public.normalize_asaas_environment(coalesce(v_config->>'activeEnvironment', 'homologacao'));
  v_environment_config := coalesce(v_config->'environments'->v_environment, '{}'::jsonb);
  v_api_key_secret_id := NULLIF(v_environment_config->>'api_key_secret_id', '')::uuid;

  IF v_api_key_secret_id IS NULL THEN
    RAISE EXCEPTION 'Chave de API Asaas nao configurada para o ambiente ativo.';
  END IF;

  SELECT ds.decrypted_secret
    INTO v_api_key
  FROM vault.decrypted_secrets ds
  WHERE ds.id = v_api_key_secret_id
  LIMIT 1;

  IF NULLIF(trim(coalesce(v_api_key, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Chave de API Asaas indisponivel no Vault.';
  END IF;

  v_asaas_customer_id := NULLIF(v_cliente.asaas_customer_ids->>v_environment, '');

  RETURN jsonb_build_object(
    'empresaId', v_empresa_id,
    'environment', v_environment,
    'baseUrl', CASE WHEN v_environment = 'producao' THEN 'https://api.asaas.com/v3' ELSE 'https://api-sandbox.asaas.com/v3' END,
    'apiKey', v_api_key,
    'cliente', jsonb_build_object(
      'id', v_cliente.id,
      'name', COALESCE(NULLIF(v_cliente.razao_social, ''), NULLIF(v_cliente.nome, ''), 'Cliente sem nome'),
      'cpfCnpj', regexp_replace(coalesce(v_cliente.cnpj, ''), '\D', '', 'g'),
      'email', NULLIF(v_cliente.email, ''),
      'phone', NULLIF(regexp_replace(coalesce(v_cliente.telefone, ''), '\D', '', 'g'), ''),
      'asaasCustomerId', v_asaas_customer_id
    ),
    'cobranca', jsonb_build_object(
      'clienteEmpresaId', v_cliente.id,
      'contratoId', v_contrato_id,
      'descricao', COALESCE(NULLIF(p_payload->>'descricao', ''), 'Cobranca avulsa'),
      'categoria', COALESCE(NULLIF(p_payload->>'categoria', ''), 'Faturamento'),
      'valor', v_valor,
      'dataVencimento', v_vencimento,
      'meioPagamento', COALESCE(NULLIF(p_payload->>'meio_pagamento', ''), 'Boleto')
    )
  );
END;
$$;

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
    v_payment,
    now()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.atualizar_cobranca_asaas_webhook(
  p_empresa_id uuid,
  p_ambiente text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_type text := COALESCE(p_payload->>'event', p_payload->>'type', 'UNKNOWN');
  v_payment jsonb := COALESCE(p_payload->'payment', '{}'::jsonb);
  v_payment_id text := COALESCE(NULLIF(v_payment->>'id', ''), NULLIF(p_payload->>'payment', ''));
  v_status text := public.map_asaas_payment_status(v_payment->>'status', v_event_type);
  v_cobranca public.financeiro_cobrancas;
BEGIN
  IF p_empresa_id IS NULL OR NULLIF(v_payment_id, '') IS NULL THEN
    RETURN jsonb_build_object('updated', false, 'reason', 'payment_id_absent');
  END IF;

  UPDATE public.financeiro_cobrancas
  SET status = v_status,
      asaas_status = COALESCE(NULLIF(v_payment->>'status', ''), asaas_status),
      asaas_invoice_url = COALESCE(NULLIF(v_payment->>'invoiceUrl', ''), asaas_invoice_url),
      asaas_bank_slip_url = COALESCE(NULLIF(v_payment->>'bankSlipUrl', ''), asaas_bank_slip_url),
      asaas_boleto_url = COALESCE(NULLIF(v_payment->>'bankSlipUrl', ''), NULLIF(v_payment->>'invoiceUrl', ''), asaas_boleto_url),
      asaas_billing_type = COALESCE(NULLIF(v_payment->>'billingType', ''), asaas_billing_type),
      asaas_payload = p_payload,
      asaas_synced_at = now(),
      data_pagamento = CASE WHEN v_status = 'Pago' THEN COALESCE(data_pagamento, now()) ELSE data_pagamento END,
      data_cancelamento = CASE WHEN v_status = 'Cancelado' THEN COALESCE(data_cancelamento, now()) ELSE data_cancelamento END,
      updated_at = now()
  WHERE empresa_id = p_empresa_id
    AND asaas_ambiente = public.normalize_asaas_environment(p_ambiente)
    AND asaas_cobranca_id = v_payment_id
  RETURNING * INTO v_cobranca;

  IF v_cobranca.id IS NULL THEN
    RETURN jsonb_build_object('updated', false, 'reason', 'charge_not_found', 'paymentId', v_payment_id);
  END IF;

  IF v_status = 'Pago' THEN
    INSERT INTO public.financeiro_lancamentos (
      empresa_id, cliente_empresa_id, tipo, origem, descricao, categoria, valor,
      data_competencia, data_pagamento, status, referencia_id, metadados
    )
    SELECT
      v_cobranca.empresa_id, v_cobranca.cliente_empresa_id, 'receita', 'cobranca',
      v_cobranca.descricao, v_cobranca.categoria, v_cobranca.valor,
      v_cobranca.data_vencimento, CURRENT_DATE, 'Pago', v_cobranca.id,
      jsonb_build_object('asaasPaymentId', v_payment_id, 'asaasEvent', v_event_type)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.financeiro_lancamentos fl
      WHERE fl.empresa_id = v_cobranca.empresa_id
        AND fl.origem = 'cobranca'
        AND fl.referencia_id = v_cobranca.id
    );
  END IF;

  RETURN jsonb_build_object(
    'updated', true,
    'cobrancaId', v_cobranca.id,
    'paymentId', v_payment_id,
    'status', v_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_empresa_id_for_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.preparar_cobranca_asaas(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_cobranca_asaas(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atualizar_cobranca_asaas_webhook(uuid, text, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.preparar_cobranca_asaas(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_cobranca_asaas(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.atualizar_cobranca_asaas_webhook(uuid, text, jsonb) TO service_role;
