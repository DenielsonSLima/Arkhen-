-- Limpeza definitiva do provedor legado no ambiente de homologacao.

DELETE FROM public.financeiro_cobrancas_integracoes WHERE provedor = 'asaas';
DELETE FROM public.configuracoes_integracao_bancaria WHERE provedor = 'asaas';

DO $$
DECLARE v_function record;
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname ILIKE '%asaas%'
  LOOP
    EXECUTE format('DROP FUNCTION %s CASCADE', v_function.signature);
  END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS public.cancelar_boleto_financeiro(uuid);
DROP FUNCTION IF EXISTS public.gerar_cobranca_manual_financeira(jsonb);

CREATE OR REPLACE FUNCTION public.baixar_manual_cobranca_custom(
  p_cobranca_id uuid, p_data_pagamento date, p_forma_pagamento text,
  p_valor_recebido numeric, p_desconto numeric, p_juros numeric,
  p_observacao text, p_baixar_parcial boolean, p_conta_bancaria_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_cobranca public.financeiro_cobrancas;
  v_valor_abatido numeric;
  v_novo_valor numeric;
  v_novo_status text;
  v_lancamento_id uuid;
BEGIN
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuario sem empresa vinculada.'; END IF;
  SELECT * INTO v_cobranca FROM public.financeiro_cobrancas
  WHERE id = p_cobranca_id AND empresa_id = v_empresa_id FOR UPDATE;
  IF NOT FOUND OR v_cobranca.status IN ('Pago', 'Cancelado') THEN
    RAISE EXCEPTION 'Apenas cobrancas em aberto podem receber baixa.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.financeiro_cobrancas_integracoes i
    WHERE i.empresa_id = v_empresa_id AND i.cobranca_id = p_cobranca_id AND i.provedor = 'inter') THEN
    RAISE EXCEPTION 'Cobrancas Banco Inter devem ser conciliadas pelo webhook.';
  END IF;
  v_valor_abatido := coalesce(p_valor_recebido, 0) + coalesce(p_desconto, 0) - coalesce(p_juros, 0);
  IF v_valor_abatido <= 0 THEN RAISE EXCEPTION 'Valor de baixa invalido.'; END IF;
  v_novo_valor := greatest(v_cobranca.valor - v_valor_abatido, 0);
  v_novo_status := CASE WHEN NOT p_baixar_parcial OR v_novo_valor = 0 THEN 'Pago' ELSE v_cobranca.status END;
  UPDATE public.financeiro_cobrancas SET
    valor = CASE WHEN v_novo_status = 'Pago' THEN v_cobranca.valor ELSE v_novo_valor END,
    status = v_novo_status,
    data_pagamento = CASE WHEN v_novo_status = 'Pago' THEN p_data_pagamento ELSE data_pagamento END,
    updated_at = now()
  WHERE id = p_cobranca_id AND empresa_id = v_empresa_id;
  INSERT INTO public.financeiro_lancamentos (
    empresa_id, conta_bancaria_id, cliente_empresa_id, tipo, origem, descricao,
    categoria, valor, data_competencia, data_pagamento, status, referencia_id, metadados
  ) VALUES (
    v_empresa_id, p_conta_bancaria_id, v_cobranca.cliente_empresa_id, 'receita', 'cobranca',
    v_cobranca.descricao, v_cobranca.categoria, p_valor_recebido, v_cobranca.data_vencimento,
    p_data_pagamento, 'Pago', v_cobranca.id, jsonb_build_object(
      'baixaManual', true, 'formaPagamento', p_forma_pagamento, 'desconto', p_desconto,
      'juros', p_juros, 'observacao', p_observacao, 'baixarParcial', p_baixar_parcial)
  ) RETURNING id INTO v_lancamento_id;
  IF p_conta_bancaria_id IS NOT NULL THEN
    UPDATE public.configuracoes_contas_bancarias SET saldo_atual = saldo_atual + p_valor_recebido
    WHERE id = p_conta_bancaria_id AND empresa_id = v_empresa_id;
  END IF;
  RETURN jsonb_build_object('success', true, 'novoStatus', v_novo_status,
    'novoValor', v_novo_valor, 'lancamentoId', v_lancamento_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.salvar_contrato_financeiro(p_payload jsonb)
RETURNS public.financeiro_configuracoes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_id uuid := NULLIF(p_payload->>'id', '')::uuid;
  v_row public.financeiro_configuracoes;
  v_vencimento date;
BEGIN
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuario sem empresa vinculada.'; END IF;
  IF v_id IS NULL THEN
    INSERT INTO public.financeiro_configuracoes (
      empresa_id, cliente_empresa_id, descricao_servico, valor_mensal, dia_vencimento,
      emissao_automatica_nfse, ativo
    ) VALUES (
      v_empresa_id, NULLIF(p_payload->>'cliente_empresa_id', '')::uuid,
      coalesce(NULLIF(p_payload->>'descricao_servico', ''), 'Honorarios contabeis'),
      coalesce((p_payload->>'valor_mensal')::numeric, 0),
      coalesce((p_payload->>'dia_vencimento')::integer, 10),
      coalesce((p_payload->>'emissao_automatica_nfse')::boolean, false),
      coalesce((p_payload->>'ativo')::boolean, true)
    ) RETURNING * INTO v_row;
    IF coalesce((p_payload->>'gerar_cobranca')::boolean, true) THEN
      v_vencimento := make_date(extract(year from current_date)::integer,
        extract(month from current_date)::integer, least(v_row.dia_vencimento, 28));
      IF v_vencimento < current_date THEN v_vencimento := (v_vencimento + interval '1 month')::date; END IF;
      INSERT INTO public.financeiro_cobrancas (
        empresa_id, contrato_id, cliente_empresa_id, descricao, categoria,
        valor, data_vencimento, status, meio_pagamento
      ) VALUES (v_empresa_id, v_row.id, v_row.cliente_empresa_id, v_row.descricao_servico,
        'Faturamento', v_row.valor_mensal, v_vencimento, 'Pendente', 'Boleto');
    END IF;
  ELSE
    UPDATE public.financeiro_configuracoes SET
      cliente_empresa_id = NULLIF(p_payload->>'cliente_empresa_id', '')::uuid,
      descricao_servico = coalesce(NULLIF(p_payload->>'descricao_servico', ''), descricao_servico),
      valor_mensal = coalesce((p_payload->>'valor_mensal')::numeric, valor_mensal),
      dia_vencimento = coalesce((p_payload->>'dia_vencimento')::integer, dia_vencimento),
      emissao_automatica_nfse = coalesce((p_payload->>'emissao_automatica_nfse')::boolean, emissao_automatica_nfse),
      ativo = coalesce((p_payload->>'ativo')::boolean, ativo)
    WHERE id = v_id AND empresa_id = v_empresa_id RETURNING * INTO v_row;
    IF NOT FOUND THEN RAISE EXCEPTION 'Contrato nao encontrado.'; END IF;
  END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_cobranca(p_public_token uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_row record; v_payload jsonb; v_pix_copy text; v_expired boolean;
BEGIN
  SELECT cb.*, fc.descricao_servico, cl.nome AS cliente_nome,
    cl.razao_social AS cliente_razao_social, cl.cnpj AS cliente_cnpj,
    cl.email AS cliente_email, cl.telefone AS cliente_telefone,
    cl.tipo AS cliente_tipo, cl.tipo_estabelecimento AS cliente_tipo_estabelecimento,
    coalesce(nullif(ce.razao_social,''), nullif(ce.nome_fantasia,''), nullif(e.razao_social,''), nullif(e.nome,''), 'Empresa emissora') AS emissor_nome,
    coalesce(nullif(ce.razao_social,''), nullif(e.razao_social,''), nullif(ce.nome_fantasia,''), nullif(e.nome,''), 'Empresa emissora') AS emissor_razao_social,
    coalesce(nullif(ce.cnpj,''), nullif(e.cnpj,'')) AS emissor_cnpj,
    ce.logo_url AS emissor_logo_url, ci.provedor AS bank_provider,
    ci.boleto_url AS integration_boleto_url, ci.pix_copia_cola, ci.payload AS integration_payload
  INTO v_row FROM public.financeiro_cobrancas cb
  LEFT JOIN public.financeiro_configuracoes fc ON fc.id = cb.contrato_id
  LEFT JOIN public.clientes cl ON cl.id = cb.cliente_empresa_id
  LEFT JOIN public.configuracoes_empresa ce ON ce.empresa_id = cb.empresa_id
  LEFT JOIN public.empresas e ON e.id = cb.empresa_id
  LEFT JOIN LATERAL (
    SELECT i.provedor, i.boleto_url, i.pix_copia_cola, i.payload
    FROM public.financeiro_cobrancas_integracoes i
    WHERE i.empresa_id = cb.empresa_id AND i.cobranca_id = cb.id AND i.provedor = 'inter'
    ORDER BY i.created_at DESC LIMIT 1
  ) ci ON true WHERE cb.public_token = p_public_token;
  IF v_row.id IS NULL THEN RETURN NULL; END IF;
  v_payload := coalesce(v_row.integration_payload, '{}'::jsonb);
  v_expired := v_row.status IN ('Pago', 'Cancelado');
  v_pix_copy := coalesce(NULLIF(v_row.pix_copia_cola, ''),
    NULLIF(v_payload #>> '{pixCopiaECola}', ''), NULLIF(v_payload #>> '{pix,pixCopiaECola}', ''));
  RETURN jsonb_build_object(
    'id', v_row.id, 'publicToken', v_row.public_token, 'descricao', coalesce(nullif(v_row.descricao,''), 'Cobranca'),
    'servicoDescricao', coalesce(nullif(v_row.descricao_servico,''), nullif(v_row.descricao,''), 'Servico contratado'),
    'valor', coalesce(v_row.valor,0), 'dataVencimento', v_row.data_vencimento,
    'status', v_row.status, 'meioPagamento', v_row.meio_pagamento, 'bankProvider', v_row.bank_provider,
    'paymentLink', CASE WHEN v_expired THEN '' ELSE coalesce(nullif(v_row.integration_boleto_url,''), '') END,
    'bankSlipLink', CASE WHEN v_expired THEN '' ELSE coalesce(nullif(v_row.integration_boleto_url,''), '') END,
    'pixCopyPaste', CASE WHEN v_expired THEN '' ELSE coalesce(v_pix_copy,'') END,
    'clienteNome', coalesce(nullif(v_row.cliente_razao_social,''), nullif(v_row.cliente_nome,''), 'Cliente'),
    'clienteCnpj', coalesce(nullif(v_row.cliente_cnpj,''),''), 'clienteEmail', coalesce(nullif(v_row.cliente_email,''),''),
    'clienteTelefone', coalesce(nullif(v_row.cliente_telefone,''),''), 'clienteTipo', coalesce(nullif(v_row.cliente_tipo,''),''),
    'clienteTipoEstabelecimento', coalesce(nullif(v_row.cliente_tipo_estabelecimento,''),''),
    'emissorNome', v_row.emissor_nome, 'emissorRazaoSocial', v_row.emissor_razao_social,
    'emissorCnpj', coalesce(v_row.emissor_cnpj,''), 'emissorLogoUrl', coalesce(v_row.emissor_logo_url,''),
    'isExpired', v_expired, 'expiredReason', CASE WHEN v_row.status='Pago' THEN 'Esta cobranca ja foi paga.'
      WHEN v_row.status='Cancelado' THEN 'Esta cobranca foi cancelada.' ELSE '' END, 'generatedAt', now());
END;
$$;

DO $$
DECLARE v_name text; v_definition text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY['get_faturamento_dashboard','get_faturamento_nfse','get_faturamento_recorrencias'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_definition
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_name AND p.prokind = 'f' LIMIT 1;
    IF v_definition IS NOT NULL THEN
      EXECUTE replace(v_definition, 'asaas_nfse_id', 'nfse_id');
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.registrar_integracao_cobranca_service(uuid,uuid,text,text,jsonb)'::regprocedure)
  INTO v_definition;
  v_definition := replace(v_definition,
    $text$v_provedor NOT IN ('asaas', 'inter')$text$,
    $text$v_provedor <> 'inter'$text$);
  v_definition := replace(v_definition,
    $text$('boleto','pix','bolepix','cartao','checkout','outro')$text$,
    $text$('boleto','pix','bolepix','outro')$text$);
  EXECUTE v_definition;

  SELECT pg_get_functiondef('public.upsert_configuracao_inter(jsonb)'::regprocedure) INTO v_definition;
  v_definition := replace(v_definition,
    $text$IF coalesce(v_current_row.ativo, false) AND NOT v_keep_active AND NOT EXISTS (
    SELECT 1 FROM public.configuracoes_integracao_bancaria c
    WHERE c.empresa_id = v_empresa_id AND c.provedor = 'asaas' AND c.status = 'ativo'
  ) THEN RAISE EXCEPTION 'Selecione um provedor validado antes de alterar credenciais do banco ativo.'; END IF;$text$,
    $text$IF coalesce(v_current_row.ativo, false) AND NOT v_keep_active THEN v_status := 'em_validacao'; END IF;$text$);
  v_definition := replace(v_definition,
    $text$IF coalesce(v_current_row.ativo, false) AND NOT v_keep_active THEN
    UPDATE public.configuracoes_integracao_bancaria SET ativo = true, updated_at = now()
    WHERE empresa_id = v_empresa_id AND provedor = 'asaas' AND status = 'ativo';
  END IF;$text$, '');
  EXECUTE v_definition;
END;
$$;

ALTER TABLE public.financeiro_cobrancas
  DROP COLUMN IF EXISTS asaas_cobranca_id,
  DROP COLUMN IF EXISTS asaas_nfse_id,
  DROP COLUMN IF EXISTS asaas_boleto_url,
  DROP COLUMN IF EXISTS asaas_invoice_url,
  DROP COLUMN IF EXISTS asaas_bank_slip_url,
  DROP COLUMN IF EXISTS asaas_billing_type,
  DROP COLUMN IF EXISTS asaas_status,
  DROP COLUMN IF EXISTS asaas_ambiente,
  DROP COLUMN IF EXISTS asaas_payload,
  DROP COLUMN IF EXISTS asaas_synced_at;

ALTER TABLE public.clientes DROP COLUMN IF EXISTS asaas_customer_ids;

REVOKE ALL ON FUNCTION public.baixar_manual_cobranca_custom(uuid,date,text,numeric,numeric,numeric,text,boolean,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.baixar_manual_cobranca_custom(uuid,date,text,numeric,numeric,numeric,text,boolean,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.salvar_contrato_financeiro(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_contrato_financeiro(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.get_public_cobranca(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_cobranca(uuid) TO anon, authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind IN ('f','p')
      AND pg_get_functiondef(p.oid) ILIKE '%asaas%'
  ) THEN RAISE EXCEPTION 'Ainda existem funcoes ativas vinculadas ao provedor removido.'; END IF;
END;
$$;
