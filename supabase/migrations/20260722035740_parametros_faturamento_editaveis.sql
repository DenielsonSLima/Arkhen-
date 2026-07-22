CREATE TABLE IF NOT EXISTS public.financeiro_parametros_faturamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo_servico_nfse text NOT NULL DEFAULT '17.19',
  aliquota_iss numeric(7,4) NOT NULL DEFAULT 2 CHECK (aliquota_iss BETWEEN 0 AND 100),
  retencao_inss numeric(7,4) NOT NULL DEFAULT 0 CHECK (retencao_inss BETWEEN 0 AND 100),
  regime_tributacao text NOT NULL DEFAULT 'simples' CHECK (regime_tributacao IN ('simples','lucro_presumido','lucro_real')),
  observacao_nfse text NOT NULL DEFAULT 'Referente a prestação de serviços do mês [MES_ATUAL]. Valor aproximado dos tributos: [TRIBUTOS_APROX].',
  mensagem_email_cobranca text NOT NULL DEFAULT 'Olá [NOME_CLIENTE], a fatura referente aos serviços de [MES_ATUAL] está disponível. O vencimento será em [DATA_VENCIMENTO].',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financeiro_parametros_faturamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY financeiro_parametros_select_tenant ON public.financeiro_parametros_faturamento
  FOR SELECT TO authenticated USING (empresa_id = public.current_empresa_id());
CREATE POLICY financeiro_parametros_insert_tenant ON public.financeiro_parametros_faturamento
  FOR INSERT TO authenticated WITH CHECK (
    empresa_id = public.current_empresa_id() AND public.configuracoes_modulos_can_manage()
  );
CREATE POLICY financeiro_parametros_update_tenant ON public.financeiro_parametros_faturamento
  FOR UPDATE TO authenticated USING (
    empresa_id = public.current_empresa_id() AND public.configuracoes_modulos_can_manage()
  ) WITH CHECK (empresa_id = public.current_empresa_id());

CREATE OR REPLACE FUNCTION public.format_parametros_faturamento(p_row public.financeiro_parametros_faturamento)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'codigoServicoNfse', p_row.codigo_servico_nfse,
    'aliquotaIss', p_row.aliquota_iss,
    'retencaoInss', p_row.retencao_inss,
    'regimeTributacao', p_row.regime_tributacao,
    'observacaoNfse', p_row.observacao_nfse,
    'mensagemEmailCobranca', p_row.mensagem_email_cobranca
  )
$$;

CREATE OR REPLACE FUNCTION public.listar_parametros_faturamento()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_empresa_id uuid := public.current_empresa_id(); v_row public.financeiro_parametros_faturamento;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuario sem empresa vinculada.'; END IF;
  SELECT * INTO v_row FROM public.financeiro_parametros_faturamento WHERE empresa_id = v_empresa_id;
  IF NOT FOUND THEN
    INSERT INTO public.financeiro_parametros_faturamento (empresa_id) VALUES (v_empresa_id)
    ON CONFLICT (empresa_id) DO UPDATE SET empresa_id = excluded.empresa_id RETURNING * INTO v_row;
  END IF;
  RETURN public.format_parametros_faturamento(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.salvar_parametros_faturamento(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_row public.financeiro_parametros_faturamento;
  v_codigo text := trim(coalesce(p_payload->>'codigoServicoNfse', ''));
  v_aliquota numeric;
  v_retencao numeric;
  v_regime text := lower(trim(coalesce(p_payload->>'regimeTributacao', '')));
  v_observacao text := trim(coalesce(p_payload->>'observacaoNfse', ''));
  v_mensagem text := trim(coalesce(p_payload->>'mensagemEmailCobranca', ''));
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL OR NOT public.configuracoes_modulos_can_manage() THEN
    RAISE EXCEPTION 'Usuario sem permissao para alterar o faturamento.';
  END IF;
  IF jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'Configuracao invalida.'; END IF;
  BEGIN
    v_aliquota := (p_payload->>'aliquotaIss')::numeric;
    v_retencao := (p_payload->>'retencaoInss')::numeric;
  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Percentuais invalidos.';
  END;
  IF v_codigo !~ '^[0-9]{1,2}\.[0-9]{1,2}$' OR v_aliquota NOT BETWEEN 0 AND 100 OR v_retencao NOT BETWEEN 0 AND 100 THEN
    RAISE EXCEPTION 'Parametros tributarios fora dos limites permitidos.';
  END IF;
  IF v_regime NOT IN ('simples','lucro_presumido','lucro_real') THEN RAISE EXCEPTION 'Regime tributario invalido.'; END IF;
  IF length(v_observacao) > 2000 OR length(v_mensagem) > 3000 THEN RAISE EXCEPTION 'Texto acima do limite permitido.'; END IF;
  INSERT INTO public.financeiro_parametros_faturamento (
    empresa_id, codigo_servico_nfse, aliquota_iss, retencao_inss,
    regime_tributacao, observacao_nfse, mensagem_email_cobranca
  ) VALUES (v_empresa_id, v_codigo, v_aliquota, v_retencao, v_regime, v_observacao, v_mensagem)
  ON CONFLICT (empresa_id) DO UPDATE SET
    codigo_servico_nfse = excluded.codigo_servico_nfse,
    aliquota_iss = excluded.aliquota_iss,
    retencao_inss = excluded.retencao_inss,
    regime_tributacao = excluded.regime_tributacao,
    observacao_nfse = excluded.observacao_nfse,
    mensagem_email_cobranca = excluded.mensagem_email_cobranca,
    updated_at = now()
  RETURNING * INTO v_row;
  RETURN public.format_parametros_faturamento(v_row);
END;
$$;

REVOKE ALL ON TABLE public.financeiro_parametros_faturamento FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.financeiro_parametros_faturamento TO authenticated;
REVOKE ALL ON FUNCTION public.format_parametros_faturamento(public.financeiro_parametros_faturamento) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.listar_parametros_faturamento() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.salvar_parametros_faturamento(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_parametros_faturamento() TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_parametros_faturamento(jsonb) TO authenticated;
