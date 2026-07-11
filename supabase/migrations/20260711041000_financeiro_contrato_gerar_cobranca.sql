-- Permite criar recorrencia sem gerar a primeira cobranca automaticamente.

CREATE OR REPLACE FUNCTION public.salvar_contrato_financeiro(p_payload jsonb)
RETURNS public.financeiro_configuracoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_id uuid := NULLIF(p_payload->>'id', '')::uuid;
  v_row public.financeiro_configuracoes;
  v_vencimento date;
  v_gerar_cobranca boolean := COALESCE((p_payload->>'gerar_cobranca')::boolean, true);
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.financeiro_configuracoes (
      empresa_id, cliente_empresa_id, descricao_servico, valor_mensal, dia_vencimento,
      emissao_automatica_nfse, ativo
    )
    VALUES (
      v_empresa_id,
      NULLIF(p_payload->>'cliente_empresa_id', '')::uuid,
      COALESCE(NULLIF(p_payload->>'descricao_servico', ''), 'Honorarios contabeis'),
      COALESCE((p_payload->>'valor_mensal')::numeric, 0),
      COALESCE((p_payload->>'dia_vencimento')::integer, 10),
      COALESCE((p_payload->>'emissao_automatica_nfse')::boolean, false),
      COALESCE((p_payload->>'ativo')::boolean, true)
    )
    RETURNING * INTO v_row;

    IF v_gerar_cobranca THEN
      v_vencimento := make_date(
        EXTRACT(YEAR FROM CURRENT_DATE)::integer,
        EXTRACT(MONTH FROM CURRENT_DATE)::integer,
        LEAST(v_row.dia_vencimento, 28)
      );

      IF v_vencimento < CURRENT_DATE THEN
        v_vencimento := (v_vencimento + interval '1 month')::date;
      END IF;

      INSERT INTO public.financeiro_cobrancas (
        empresa_id, contrato_id, cliente_empresa_id, descricao, categoria, valor, data_vencimento,
        status, meio_pagamento, asaas_cobranca_id, asaas_boleto_url
      )
      VALUES (
        v_empresa_id, v_row.id, v_row.cliente_empresa_id, v_row.descricao_servico, 'Faturamento',
        v_row.valor_mensal, v_vencimento, 'Pendente', 'Boleto',
        'pay_' || substr(encode(digest(v_row.id::text || now()::text, 'sha256'), 'hex'), 1, 16),
        'https://asaas.com/b/pay_' || substr(encode(digest(v_row.id::text, 'sha256'), 'hex'), 1, 16)
      );
    END IF;
  ELSE
    UPDATE public.financeiro_configuracoes
    SET cliente_empresa_id = NULLIF(p_payload->>'cliente_empresa_id', '')::uuid,
        descricao_servico = COALESCE(NULLIF(p_payload->>'descricao_servico', ''), descricao_servico),
        valor_mensal = COALESCE((p_payload->>'valor_mensal')::numeric, valor_mensal),
        dia_vencimento = COALESCE((p_payload->>'dia_vencimento')::integer, dia_vencimento),
        emissao_automatica_nfse = COALESCE((p_payload->>'emissao_automatica_nfse')::boolean, emissao_automatica_nfse),
        ativo = COALESCE((p_payload->>'ativo')::boolean, ativo)
    WHERE id = v_id
      AND empresa_id = v_empresa_id
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
      RAISE EXCEPTION 'Contrato nao encontrado.';
    END IF;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.salvar_contrato_financeiro(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.salvar_contrato_financeiro(jsonb) TO authenticated;
