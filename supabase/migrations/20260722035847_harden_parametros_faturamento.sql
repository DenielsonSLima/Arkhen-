ALTER TABLE public.financeiro_parametros_faturamento
  ADD CONSTRAINT financeiro_parametros_codigo_check
    CHECK (codigo_servico_nfse ~ '^[0-9]{1,2}\.[0-9]{1,2}$'),
  ADD CONSTRAINT financeiro_parametros_observacao_length_check
    CHECK (length(observacao_nfse) <= 2000),
  ADD CONSTRAINT financeiro_parametros_mensagem_length_check
    CHECK (length(mensagem_email_cobranca) <= 3000);

CREATE OR REPLACE FUNCTION public.listar_parametros_faturamento()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_row public.financeiro_parametros_faturamento;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuario sem empresa vinculada.'; END IF;
  SELECT * INTO v_row FROM public.financeiro_parametros_faturamento WHERE empresa_id = v_empresa_id;
  IF FOUND THEN RETURN public.format_parametros_faturamento(v_row); END IF;
  RETURN jsonb_build_object(
    'codigoServicoNfse', '17.19', 'aliquotaIss', 2, 'retencaoInss', 0,
    'regimeTributacao', 'simples',
    'observacaoNfse', 'Referente a prestação de serviços do mês [MES_ATUAL]. Valor aproximado dos tributos: [TRIBUTOS_APROX].',
    'mensagemEmailCobranca', 'Olá [NOME_CLIENTE], a fatura referente aos serviços de [MES_ATUAL] está disponível. O vencimento será em [DATA_VENCIMENTO].'
  );
END;
$$;

ALTER FUNCTION public.salvar_parametros_faturamento(jsonb) SECURITY INVOKER;

GRANT EXECUTE ON FUNCTION public.format_parametros_faturamento(public.financeiro_parametros_faturamento) TO authenticated;
