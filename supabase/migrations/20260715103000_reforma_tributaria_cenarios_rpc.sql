-- Cenarios parametrizados de IBS/CBS e split payment. Os resultados sao
-- estimativos e preservam as premissas informadas para auditoria.

DROP POLICY reforma_adequacoes_select_tenant ON public.reforma_tributaria_adequacoes;
CREATE POLICY reforma_adequacoes_select_tenant ON public.reforma_tributaria_adequacoes
  FOR SELECT TO authenticated USING (public.is_empresa_member(empresa_id)
    AND public.modulo_sistema_habilitado('reforma-tributaria')
    AND public.reforma_tributaria_tem_permissao('reforma-tributaria:view'));
DROP POLICY reforma_validacoes_select_tenant ON public.reforma_tributaria_validacoes_xml;
CREATE POLICY reforma_validacoes_select_tenant ON public.reforma_tributaria_validacoes_xml
  FOR SELECT TO authenticated USING (public.is_empresa_member(empresa_id)
    AND public.modulo_sistema_habilitado('reforma-tributaria')
    AND public.reforma_tributaria_tem_permissao('reforma-tributaria:view'));
DROP POLICY reforma_simulacoes_select_tenant ON public.reforma_tributaria_simulacoes;
CREATE POLICY reforma_simulacoes_select_tenant ON public.reforma_tributaria_simulacoes
  FOR SELECT TO authenticated USING (public.is_empresa_member(empresa_id)
    AND public.modulo_sistema_habilitado('reforma-tributaria')
    AND public.reforma_tributaria_tem_permissao('reforma-tributaria:view'));
DROP POLICY reforma_decisoes_select_tenant ON public.reforma_tributaria_decisoes;
CREATE POLICY reforma_decisoes_select_tenant ON public.reforma_tributaria_decisoes
  FOR SELECT TO authenticated USING (public.is_empresa_member(empresa_id)
    AND public.modulo_sistema_habilitado('reforma-tributaria')
    AND public.reforma_tributaria_tem_permissao('reforma-tributaria:view'));

CREATE OR REPLACE FUNCTION public.reforma_tributaria_numero(
  p_payload jsonb,
  p_chave text,
  p_padrao numeric DEFAULT 0
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_text text := NULLIF(trim(p_payload->>p_chave), '');
  v_numero numeric;
BEGIN
  IF v_text IS NULL THEN RETURN p_padrao; END IF;
  IF v_text !~ '^-?[0-9]+([.][0-9]+)?$' THEN
    RAISE EXCEPTION 'Valor numerico invalido para %.', p_chave;
  END IF;
  v_numero := v_text::numeric;
  IF v_numero < 0 OR v_numero > 1000000000000 THEN
    RAISE EXCEPTION 'Valor fora do intervalo permitido para %.', p_chave;
  END IF;
  RETURN v_numero;
END;
$$;

CREATE OR REPLACE FUNCTION public.salvar_reforma_simulacao_ibs_cbs(
  p_cliente_id uuid,
  p_entrada jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_receita numeric := public.reforma_tributaria_numero(p_entrada, 'receitaMensal');
  v_aliq_simples numeric := public.reforma_tributaria_numero(p_entrada, 'aliquotaSimples');
  v_aliq_regular numeric := public.reforma_tributaria_numero(p_entrada, 'aliquotaRegular');
  v_compras numeric := public.reforma_tributaria_numero(p_entrada, 'comprasCreditaveis');
  v_aliq_credito numeric := public.reforma_tributaria_numero(p_entrada, 'aliquotaCredito', v_aliq_regular);
  v_b2b numeric := public.reforma_tributaria_numero(p_entrada, 'percentualB2b');
  v_dentro numeric;
  v_debito numeric;
  v_credito numeric;
  v_saldo numeric;
  v_excedente numeric;
  v_result jsonb;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL OR NOT public.reforma_tributaria_cliente_autorizado(p_cliente_id) THEN
    RAISE EXCEPTION 'Cliente nao pertence ao escritorio.';
  END IF;
  IF NOT public.reforma_tributaria_tem_permissao('reforma-tributaria:manage') THEN
    RAISE EXCEPTION 'Permissao de gerenciamento da Reforma Tributaria necessaria.';
  END IF;
  IF v_receita <= 0 THEN RAISE EXCEPTION 'Informe uma receita mensal maior que zero.'; END IF;
  IF v_aliq_simples > 100 OR v_aliq_regular > 100 OR v_aliq_credito > 100 OR v_b2b > 100 THEN
    RAISE EXCEPTION 'Percentuais devem estar entre zero e cem.';
  END IF;

  v_dentro := round(v_receita * v_aliq_simples / 100, 2);
  v_debito := round(v_receita * v_aliq_regular / 100, 2);
  v_credito := round(v_compras * v_aliq_credito / 100, 2);
  v_saldo := GREATEST(v_debito - v_credito, 0);
  v_excedente := GREATEST(v_credito - v_debito, 0);

  v_result := jsonb_build_object(
    'cenarioDentroSimples', jsonb_build_object(
      'valorMensal', v_dentro,
      'valorSemestral', v_dentro * 6,
      'creditoPotencialComprador', round(v_dentro * v_b2b / 100, 2)
    ),
    'cenarioRegimeRegular', jsonb_build_object(
      'debitoMensal', v_debito,
      'creditosMensais', v_credito,
      'saldoMensal', v_saldo,
      'creditoExcedente', v_excedente,
      'saldoSemestral', v_saldo * 6,
      'creditoPotencialComprador', round(v_debito * v_b2b / 100, 2)
    ),
    'diferencaMensal', v_saldo - v_dentro,
    'diferencaSemestral', (v_saldo - v_dentro) * 6,
    'tendencia', CASE
      WHEN abs(v_saldo - v_dentro) < 0.01 THEN 'equilibrado'
      WHEN v_saldo < v_dentro THEN 'regular_menor_desembolso'
      ELSE 'simples_menor_desembolso'
    END,
    'natureza', 'cenario_parametrico',
    'aviso', 'Estimativa baseada nas premissas informadas. Exige revisao do contador.'
  );

  INSERT INTO public.reforma_tributaria_simulacoes (
    empresa_id, cliente_id, tipo, competencia, entrada, resultado, criado_por
  ) VALUES (
    v_empresa_id,
    p_cliente_id,
    'ibs_cbs',
    COALESCE(NULLIF(p_entrada->>'competencia', '')::date, date_trunc('month', CURRENT_DATE)::date),
    p_entrada,
    v_result,
    auth.uid()
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'resultado', v_result, 'versaoRegra', 'cenario-parametrico-2026.1');
END;
$$;

CREATE OR REPLACE FUNCTION public.salvar_reforma_simulacao_split_payment(
  p_cliente_id uuid,
  p_entrada jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_pix numeric := public.reforma_tributaria_numero(p_entrada, 'receitaPix');
  v_cartao numeric := public.reforma_tributaria_numero(p_entrada, 'receitaCartao');
  v_boleto numeric := public.reforma_tributaria_numero(p_entrada, 'receitaBoleto');
  v_outros numeric := public.reforma_tributaria_numero(p_entrada, 'receitaOutros');
  v_aliquota numeric := public.reforma_tributaria_numero(p_entrada, 'aliquotaEfetiva');
  v_cobertura numeric := public.reforma_tributaria_numero(p_entrada, 'percentualCobertura', 100);
  v_total numeric;
  v_base_split numeric;
  v_segregado numeric;
  v_result jsonb;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL OR NOT public.reforma_tributaria_cliente_autorizado(p_cliente_id) THEN
    RAISE EXCEPTION 'Cliente nao pertence ao escritorio.';
  END IF;
  IF NOT public.reforma_tributaria_tem_permissao('reforma-tributaria:manage') THEN
    RAISE EXCEPTION 'Permissao de gerenciamento da Reforma Tributaria necessaria.';
  END IF;
  IF v_aliquota > 100 OR v_cobertura > 100 THEN
    RAISE EXCEPTION 'Percentuais devem estar entre zero e cem.';
  END IF;
  v_total := v_pix + v_cartao + v_boleto + v_outros;
  IF v_total <= 0 THEN RAISE EXCEPTION 'Informe receitas por meio de pagamento.'; END IF;

  v_base_split := round(v_total * v_cobertura / 100, 2);
  v_segregado := round(v_base_split * v_aliquota / 100, 2);
  v_result := jsonb_build_object(
    'receitaTotal', v_total,
    'baseSujeitaSegregacao', v_base_split,
    'valorSegregadoEstimado', v_segregado,
    'caixaDisponivelEstimado', v_total - v_segregado,
    'necessidadeCapitalGiro30Dias', v_segregado,
    'necessidadeCapitalGiro90Dias', v_segregado * 3,
    'participacaoMeios', jsonb_build_object(
      'pix', round(v_pix / v_total * 100, 2),
      'cartao', round(v_cartao / v_total * 100, 2),
      'boleto', round(v_boleto / v_total * 100, 2),
      'outros', round(v_outros / v_total * 100, 2)
    ),
    'natureza', 'projecao_parametrica',
    'aviso', 'Projecao de caixa. A cobertura operacional do split payment pode evoluir.'
  );

  INSERT INTO public.reforma_tributaria_simulacoes (
    empresa_id, cliente_id, tipo, competencia, entrada, resultado, criado_por
  ) VALUES (
    v_empresa_id,
    p_cliente_id,
    'split_payment',
    COALESCE(NULLIF(p_entrada->>'competencia', '')::date, date_trunc('month', CURRENT_DATE)::date),
    p_entrada,
    v_result,
    auth.uid()
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'resultado', v_result, 'versaoRegra', 'cenario-parametrico-2026.1');
END;
$$;

CREATE OR REPLACE FUNCTION public.salvar_reforma_tributaria_decisao(
  p_cliente_id uuid,
  p_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_decisao text := COALESCE(NULLIF(p_payload->>'decisao', ''), 'pendente');
  v_simulacao_id uuid := NULLIF(p_payload->>'simulacaoId', '')::uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL OR NOT public.reforma_tributaria_cliente_autorizado(p_cliente_id) THEN
    RAISE EXCEPTION 'Cliente nao pertence ao escritorio.';
  END IF;
  IF NOT public.reforma_tributaria_tem_permissao('reforma-tributaria:manage') THEN
    RAISE EXCEPTION 'Permissao de gerenciamento da Reforma Tributaria necessaria.';
  END IF;
  IF v_decisao NOT IN ('manter_simples', 'regime_regular', 'inconclusivo', 'pendente') THEN
    RAISE EXCEPTION 'Decisao invalida.';
  END IF;
  IF length(COALESCE(p_payload->>'parecer', '')) > 10000 THEN
    RAISE EXCEPTION 'Parecer excede o limite permitido.';
  END IF;
  IF v_simulacao_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.reforma_tributaria_simulacoes s
    WHERE s.id = v_simulacao_id AND s.empresa_id = v_empresa_id AND s.cliente_id = p_cliente_id
  ) THEN
    RAISE EXCEPTION 'Simulacao nao pertence ao cliente.';
  END IF;

  INSERT INTO public.reforma_tributaria_decisoes (
    empresa_id, cliente_id, simulacao_id, decisao, parecer,
    ciencia_cliente_em, periodo_inicio, periodo_fim, decidido_por
  ) VALUES (
    v_empresa_id,
    p_cliente_id,
    v_simulacao_id,
    v_decisao,
    COALESCE(p_payload->>'parecer', ''),
    NULLIF(p_payload->>'cienciaClienteEm', '')::timestamptz,
    COALESCE(NULLIF(p_payload->>'periodoInicio', '')::date, '2027-01-01'::date),
    COALESCE(NULLIF(p_payload->>'periodoFim', '')::date, '2027-06-30'::date),
    auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_reforma_tributaria_historico(p_cliente_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_validacoes jsonb;
  v_simulacoes jsonb;
  v_decisoes jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL OR NOT public.is_empresa_member(v_empresa_id)
    OR NOT public.modulo_sistema_habilitado('reforma-tributaria')
    OR NOT public.reforma_tributaria_tem_permissao('reforma-tributaria:view') THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;
  IF p_cliente_id IS NOT NULL AND NOT public.reforma_tributaria_cliente_autorizado(p_cliente_id) THEN
    RAISE EXCEPTION 'Cliente nao pertence ao escritorio.';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', v.id, 'clienteId', v.cliente_id, 'clienteNome', COALESCE(NULLIF(c.razao_social, ''), c.nome),
    'arquivoNome', v.arquivo_nome, 'tipoDocumento', v.tipo_documento,
    'resultado', v.resultado, 'inconsistencias', v.inconsistencias,
    'versaoRegra', v.versao_regra, 'criadoEm', v.created_at
  ) ORDER BY v.created_at DESC), '[]'::jsonb)
  INTO v_validacoes
  FROM public.reforma_tributaria_validacoes_xml v
  JOIN public.clientes c ON c.id = v.cliente_id AND c.empresa_id = v_empresa_id
  WHERE v.empresa_id = v_empresa_id AND (p_cliente_id IS NULL OR v.cliente_id = p_cliente_id);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id, 'clienteId', s.cliente_id, 'clienteNome', COALESCE(NULLIF(c.razao_social, ''), c.nome),
    'tipo', s.tipo, 'competencia', s.competencia, 'entrada', s.entrada,
    'resultado', s.resultado, 'versaoRegra', s.versao_regra, 'criadoEm', s.created_at
  ) ORDER BY s.created_at DESC), '[]'::jsonb)
  INTO v_simulacoes
  FROM public.reforma_tributaria_simulacoes s
  JOIN public.clientes c ON c.id = s.cliente_id AND c.empresa_id = v_empresa_id
  WHERE s.empresa_id = v_empresa_id AND (p_cliente_id IS NULL OR s.cliente_id = p_cliente_id);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', d.id, 'clienteId', d.cliente_id, 'clienteNome', COALESCE(NULLIF(c.razao_social, ''), c.nome),
    'simulacaoId', d.simulacao_id, 'decisao', d.decisao, 'parecer', d.parecer,
    'cienciaClienteEm', d.ciencia_cliente_em, 'periodoInicio', d.periodo_inicio,
    'periodoFim', d.periodo_fim, 'criadoEm', d.created_at
  ) ORDER BY d.created_at DESC), '[]'::jsonb)
  INTO v_decisoes
  FROM public.reforma_tributaria_decisoes d
  JOIN public.clientes c ON c.id = d.cliente_id AND c.empresa_id = v_empresa_id
  WHERE d.empresa_id = v_empresa_id AND (p_cliente_id IS NULL OR d.cliente_id = p_cliente_id);

  RETURN jsonb_build_object(
    'validacoes', v_validacoes,
    'simulacoes', v_simulacoes,
    'decisoes', v_decisoes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reforma_tributaria_numero(jsonb, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salvar_reforma_simulacao_ibs_cbs(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salvar_reforma_simulacao_split_payment(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salvar_reforma_tributaria_decisao(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_reforma_tributaria_historico(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_reforma_simulacao_ibs_cbs(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_reforma_simulacao_split_payment(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_reforma_tributaria_decisao(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_reforma_tributaria_historico(uuid) TO authenticated;
