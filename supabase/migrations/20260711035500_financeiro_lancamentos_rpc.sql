-- RPC para lancamentos financeiros manuais com ajuste de saldo no banco.

CREATE OR REPLACE FUNCTION public.salvar_lancamento_financeiro(p_payload jsonb)
RETURNS public.financeiro_lancamentos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_conta_id uuid := NULLIF(p_payload->>'conta_bancaria_id', '')::uuid;
  v_tipo text := COALESCE(NULLIF(p_payload->>'tipo', ''), 'receita');
  v_origem text := COALESCE(NULLIF(p_payload->>'origem', ''), 'manual');
  v_status text := COALESCE(NULLIF(p_payload->>'status', ''), 'Pendente');
  v_valor numeric(15,2) := COALESCE((p_payload->>'valor')::numeric, 0);
  v_row public.financeiro_lancamentos;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  IF v_valor < 0 THEN
    RAISE EXCEPTION 'Valor do lancamento nao pode ser negativo.';
  END IF;

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
    v_conta_id,
    NULLIF(p_payload->>'cliente_empresa_id', '')::uuid,
    v_tipo,
    v_origem,
    trim(p_payload->>'descricao'),
    COALESCE(NULLIF(trim(p_payload->>'categoria'), ''), 'Geral'),
    v_valor,
    COALESCE(NULLIF(p_payload->>'data_competencia', '')::date, CURRENT_DATE),
    NULLIF(p_payload->>'data_pagamento', '')::date,
    v_status,
    NULLIF(p_payload->>'referencia_id', '')::uuid,
    COALESCE(p_payload->'metadados', '{}'::jsonb)
  )
  RETURNING * INTO v_row;

  IF v_conta_id IS NOT NULL AND v_status = 'Pago' THEN
    UPDATE public.configuracoes_contas_bancarias
    SET saldo_atual = saldo_atual + CASE
      WHEN v_tipo IN ('receita', 'transferencia_entrada') THEN v_valor
      ELSE -v_valor
    END
    WHERE id = v_conta_id
      AND empresa_id = v_empresa_id;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.salvar_lancamento_financeiro(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.salvar_lancamento_financeiro(jsonb) TO authenticated;
