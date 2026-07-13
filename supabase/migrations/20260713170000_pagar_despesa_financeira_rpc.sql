-- Migration to create pagar_despesa_financeira RPC function

CREATE OR REPLACE FUNCTION public.pagar_despesa_financeira(
  p_lancamento_id uuid,
  p_conta_bancaria_id uuid,
  p_data_pagamento date,
  p_valor_pago numeric(15,2),
  p_desconto numeric(15,2),
  p_juros numeric(15,2),
  p_observacao text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_lancamento record;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  -- 1. Busca e trava o lançamento para garantir consistência
  SELECT * INTO v_lancamento
  FROM public.financeiro_lancamentos
  WHERE id = p_lancamento_id AND empresa_id = v_empresa_id FOR UPDATE;

  IF v_lancamento.id IS NULL THEN
    RAISE EXCEPTION 'Lançamento não encontrado.';
  END IF;

  IF v_lancamento.status = 'Pago' THEN
    RAISE EXCEPTION 'Este lançamento já está pago.';
  END IF;

  IF v_lancamento.tipo <> 'despesa' THEN
    RAISE EXCEPTION 'Somente despesas podem ser baixadas/pagas por esta função.';
  END IF;

  -- 2. Atualiza o lançamento com os dados do pagamento
  UPDATE public.financeiro_lancamentos
  SET
    status = 'Pago',
    data_pagamento = p_data_pagamento,
    conta_bancaria_id = p_conta_bancaria_id,
    metadados = jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(metadados, '{}'::jsonb),
          '{pagamento_detalhes}',
          jsonb_build_object(
            'valor_pago', p_valor_pago,
            'desconto', p_desconto,
            'juros', p_juros,
            'observacao', p_observacao
          )
        ),
        '{contaBancariaId}',
        to_jsonb(p_conta_bancaria_id::text)
      ),
      '{dataPagamento}',
      to_jsonb(p_data_pagamento::text)
    ),
    updated_at = now()
  WHERE id = p_lancamento_id;

  -- 3. Deduz o valor pago do saldo atual da conta bancária
  UPDATE public.configuracoes_contas_bancarias
  SET saldo_atual = saldo_atual - p_valor_pago,
      updated_at = now()
  WHERE id = p_conta_bancaria_id AND empresa_id = v_empresa_id;

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pagar_despesa_financeira(uuid, uuid, date, numeric, numeric, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.pagar_despesa_financeira(uuid, uuid, date, numeric, numeric, numeric, text) TO authenticated;
