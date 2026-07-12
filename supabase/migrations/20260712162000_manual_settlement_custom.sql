-- Custom manual write-off for financeiro_cobrancas with partial payment, discount, interest, comments and bank account balance adjustment.

CREATE OR REPLACE FUNCTION public.baixar_manual_cobranca_custom(
  p_cobranca_id uuid,
  p_data_pagamento date,
  p_forma_pagamento text,
  p_valor_recebido numeric,
  p_desconto numeric,
  p_juros numeric,
  p_observacao text,
  p_baixar_parcial boolean,
  p_conta_bancaria_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_cobranca public.financeiro_cobrancas;
  v_valor_abatido numeric;
  v_novo_valor numeric;
  v_novo_status text;
  v_lancamento_id uuid;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado ou sem empresa vinculada.';
  END IF;

  -- 1. Obter e validar a cobranca
  SELECT * INTO v_cobranca
  FROM public.financeiro_cobrancas
  WHERE id = p_cobranca_id AND empresa_id = v_empresa_id;

  IF v_cobranca.id IS NULL THEN
    RAISE EXCEPTION 'Cobranca nao encontrada para esta empresa.';
  END IF;

  IF v_cobranca.status IN ('Pago', 'Cancelado') THEN
    RAISE EXCEPTION 'Apenas cobrancas em aberto podem receber baixa.';
  END IF;

  -- 2. Calcular o valor abatido da cobranca
  -- Se o usuario recebeu p_valor_recebido, mais p_desconto (que abate a divida) menos p_juros (que aumenta a divida)
  -- Divida abatida = valor_recebido + desconto - juros
  v_valor_abatido := coalesce(p_valor_recebido, 0) + coalesce(p_desconto, 0) - coalesce(p_juros, 0);

  IF v_valor_abatido <= 0 THEN
    RAISE EXCEPTION 'O valor efetivamente abatido deve ser maior que zero.';
  END IF;

  IF p_baixar_parcial THEN
    -- Baixa parcial:
    v_novo_valor := v_cobranca.valor - v_valor_abatido;
    IF v_novo_valor <= 0 THEN
      -- Se pagou tudo ou mais, fecha a cobranca
      v_novo_valor := 0;
      v_novo_status := 'Pago';
    ELSE
      v_novo_status := v_cobranca.status; -- mantem o status atual (Pendente/Vencido)
    END IF;
  ELSE
    -- Baixa total:
    v_novo_valor := 0;
    v_novo_status := 'Pago';
  END IF;

  -- 3. Atualizar a cobranca
  UPDATE public.financeiro_cobrancas
  SET valor = CASE WHEN v_novo_status = 'Pago' THEN v_cobranca.valor ELSE v_novo_valor END,
      status = v_novo_status,
      data_pagamento = CASE WHEN v_novo_status = 'Pago' THEN p_data_pagamento ELSE data_pagamento END,
      asaas_status = CASE WHEN v_novo_status = 'Pago' AND asaas_cobranca_id IS NOT NULL THEN 'MANUAL_SETTLEMENT_CUSTOM' ELSE asaas_status END,
      asaas_payload = coalesce(asaas_payload, '{}'::jsonb) || jsonb_build_object(
        'customManualSettlement', jsonb_build_object(
          'dataPagamento', p_data_pagamento,
          'formaPagamento', p_forma_pagamento,
          'valorRecebido', p_valor_recebido,
          'desconto', p_desconto,
          'juros', p_juros,
          'observacao', p_observacao,
          'baixarParcial', p_baixar_parcial,
          'valorOriginalCobranca', v_cobranca.valor,
          'valorAbatido', v_valor_abatido
        )
      ),
      updated_at = now()
  WHERE id = p_cobranca_id AND empresa_id = v_empresa_id;

  -- 4. Registrar o lancamento de receita (fluxo de caixa)
  INSERT INTO public.financeiro_lancamentos (
    empresa_id,
    conta_bancaria_id,
    cliente_empresa_id,
    tipo,
    origem,
    descricao,
    categoria,
    valor,
    data_competencia,
    data_pagamento,
    status,
    referencia_id,
    metadados
  )
  VALUES (
    v_empresa_id,
    p_conta_bancaria_id,
    v_cobranca.cliente_empresa_id,
    'receita',
    'cobranca',
    v_cobranca.descricao || CASE WHEN p_baixar_parcial THEN ' (Baixa Parcial)' ELSE ' (Baixa Manual)' END,
    v_cobranca.categoria,
    p_valor_recebido,
    v_cobranca.data_vencimento,
    p_data_pagamento,
    'Pago',
    v_cobranca.id,
    jsonb_build_object(
      'customManualSettlement', true,
      'valorRecebido', p_valor_recebido,
      'desconto', p_desconto,
      'juros', p_juros,
      'observacao', p_observacao,
      'formaPagamento', p_forma_pagamento,
      'baixarParcial', p_baixar_parcial
    )
  )
  RETURNING id INTO v_lancamento_id;

  -- 5. Atualizar saldo da conta bancaria se fornecida
  IF p_conta_bancaria_id IS NOT NULL THEN
    UPDATE public.configuracoes_contas_bancarias
    SET saldo_atual = saldo_atual + p_valor_recebido
    WHERE id = p_conta_bancaria_id
      AND empresa_id = v_empresa_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'novoStatus', v_novo_status,
    'novoValor', v_novo_valor,
    'lancamentoId', v_lancamento_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.baixar_manual_cobranca_custom(uuid, date, text, numeric, numeric, numeric, text, boolean, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.baixar_manual_cobranca_custom(uuid, date, text, numeric, numeric, numeric, text, boolean, uuid) TO authenticated;
