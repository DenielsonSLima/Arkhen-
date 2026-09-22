-- Movimentacoes atomicas sao a unica escrita de ledger disponivel ao cliente.
-- Implementacoes privilegiadas ficam em schema nao exposto; wrappers conservam APIs.
-- service_role continua disponivel para as integracoes ja existentes.
BEGIN;
CREATE SCHEMA IF NOT EXISTS app_private;
CREATE TABLE IF NOT EXISTS public.financeiro_operacoes_idempotentes (
  empresa_id uuid NOT NULL REFERENCES public.empresas(id), chave text NOT NULL,
  operacao text NOT NULL, resposta jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, chave), CHECK (char_length(chave) BETWEEN 8 AND 128)
);
ALTER TABLE public.financeiro_operacoes_idempotentes ADD COLUMN IF NOT EXISTS entrada jsonb;
ALTER TABLE public.financeiro_operacoes_idempotentes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.financeiro_operacoes_idempotentes FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.financeiro_numero(p_valor text)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF p_valor IS NULL OR p_valor !~ '^-?[0-9]+([.][0-9]{1,2})?$' THEN
    RAISE EXCEPTION 'Informe um valor monetario valido com ate duas casas decimais.' USING ERRCODE='22023';
  END IF;
  IF abs(p_valor::numeric) > 9999999999999.99 THEN
    RAISE EXCEPTION 'Valor monetario fora do limite.' USING ERRCODE='22023';
  END IF;
  RETURN p_valor::numeric;
END;
$$;
REVOKE ALL ON FUNCTION app_private.financeiro_numero(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.transferir_entre_contas_financeiro(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_conta_origem uuid := NULLIF(p_payload->>'conta_origem_id', '')::uuid;
  v_conta_destino uuid := NULLIF(p_payload->>'conta_destino_id', '')::uuid;
  v_valor numeric(15,2) := app_private.financeiro_numero(p_payload->>'valor');
  v_data date := COALESCE(NULLIF(p_payload->>'data', '')::date, CURRENT_DATE);
  v_descricao text := COALESCE(NULLIF(trim(p_payload->>'descricao'), ''), 'Transferência entre contas');
  v_idempotency_key text := NULLIF(trim(p_payload->>'idempotency_key'), '');
  v_transferencia_id uuid := gen_random_uuid();
  v_saida_id uuid;
  v_entrada_id uuid;
  v_contas_encontradas integer;
  v_resposta jsonb;
  v_request public.financeiro_operacoes_idempotentes;
  v_saldo_origem numeric(15,2);
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa vinculada.';
  END IF;
  IF NOT coalesce(public.is_empresa_member(v_empresa_id),false) OR coalesce(public.current_user_is_client_scoped(v_empresa_id),true)
    OR NOT coalesce(public.current_user_has_permission(v_empresa_id, 'financeiro:manage'),false) THEN
    RAISE EXCEPTION 'Usuário sem permissão para movimentar o financeiro.' USING ERRCODE = '42501';
  END IF;
  IF v_idempotency_key IS NULL OR char_length(v_idempotency_key) NOT BETWEEN 8 AND 128 THEN
    RAISE EXCEPTION 'Chave de idempotência inválida.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_empresa_id::text || ':' || v_idempotency_key, 0));
  SELECT * INTO v_request FROM public.financeiro_operacoes_idempotentes
  WHERE empresa_id = v_empresa_id AND chave = v_idempotency_key;
  IF FOUND THEN
    IF v_request.operacao <> 'transferencia' OR (v_request.entrada IS NOT NULL
       AND v_request.entrada IS DISTINCT FROM p_payload - 'idempotency_key') THEN
      RAISE EXCEPTION 'Referencia de operacao ja usada com outros dados.' USING ERRCODE = '22023';
    END IF;
    RETURN v_request.resposta;
  END IF;
  IF v_conta_origem IS NULL OR v_conta_destino IS NULL OR v_conta_origem = v_conta_destino THEN
    RAISE EXCEPTION 'Informe contas de origem e destino diferentes.';
  END IF;
  IF v_valor <= 0 OR v_valor IS DISTINCT FROM app_private.financeiro_numero(p_payload->>'valor') THEN
    RAISE EXCEPTION 'O valor da transferência deve ser maior que zero.';
  END IF;

  SELECT count(*) INTO v_contas_encontradas
  FROM (
    SELECT conta.id
    FROM public.configuracoes_contas_bancarias AS conta
    WHERE conta.empresa_id = v_empresa_id
      AND conta.id IN (v_conta_origem, v_conta_destino)
    ORDER BY conta.id
    FOR UPDATE
  ) AS contas_bloqueadas;

  IF v_contas_encontradas <> 2 THEN
    RAISE EXCEPTION 'Uma das contas não pertence à empresa ativa.'
      USING ERRCODE = '23503';
  END IF;
  SELECT saldo_atual INTO v_saldo_origem
  FROM public.configuracoes_contas_bancarias
  WHERE id = v_conta_origem AND empresa_id = v_empresa_id;
  IF v_saldo_origem < v_valor THEN
    RAISE EXCEPTION 'Saldo insuficiente na conta de origem.';
  END IF;

  INSERT INTO public.financeiro_lancamentos (
    empresa_id, conta_bancaria_id, tipo, origem, descricao, categoria,
    valor, data_competencia, data_pagamento, status, metadados
  ) VALUES (
    v_empresa_id, v_conta_origem, 'transferencia_saida', 'transferencia',
    v_descricao, 'Transferência', v_valor, v_data, v_data, 'Pago',
    jsonb_build_object('transferenciaId', v_transferencia_id, 'contaDestinoId', v_conta_destino)
  ) RETURNING id INTO v_saida_id;

  INSERT INTO public.financeiro_lancamentos (
    empresa_id, conta_bancaria_id, tipo, origem, descricao, categoria,
    valor, data_competencia, data_pagamento, status, metadados
  ) VALUES (
    v_empresa_id, v_conta_destino, 'transferencia_entrada', 'transferencia',
    v_descricao, 'Transferência', v_valor, v_data, v_data, 'Pago',
    jsonb_build_object('transferenciaId', v_transferencia_id, 'contaOrigemId', v_conta_origem)
  ) RETURNING id INTO v_entrada_id;

  UPDATE public.configuracoes_contas_bancarias
  SET saldo_atual = saldo_atual + CASE
    WHEN id = v_conta_origem THEN -v_valor
    WHEN id = v_conta_destino THEN v_valor
    ELSE 0
  END,
  updated_at = now()
  WHERE empresa_id = v_empresa_id
    AND id IN (v_conta_origem, v_conta_destino);

  v_resposta := jsonb_build_object(
    'transferenciaId', v_transferencia_id,
    'lancamentoSaidaId', v_saida_id,
    'lancamentoEntradaId', v_entrada_id
  );
  INSERT INTO public.financeiro_operacoes_idempotentes (empresa_id, chave, operacao, resposta, entrada)
  VALUES (v_empresa_id, v_idempotency_key, 'transferencia', v_resposta, p_payload - 'idempotency_key');
  RETURN v_resposta;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.criar_contas_pagar_parceladas(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_descricao text := NULLIF(trim(p_payload->>'descricao'), '');
  v_categoria text := COALESCE(NULLIF(trim(p_payload->>'categoria'), ''), 'Geral');
  v_tipo_despesa text := COALESCE(NULLIF(p_payload->>'tipo_despesa', ''), 'fixa');
  v_valor_total numeric(15,2) := app_private.financeiro_numero(p_payload->>'valor_total');
  v_data_competencia date := COALESCE(NULLIF(p_payload->>'data_competencia', '')::date, CURRENT_DATE);
  v_data_vencimento date := COALESCE(NULLIF(p_payload->>'data_vencimento', '')::date, CURRENT_DATE);
  v_status text := COALESCE(NULLIF(p_payload->>'status', ''), 'Pendente');
  v_conta_id uuid := NULLIF(p_payload->>'conta_bancaria_id', '')::uuid;
  v_numero_parcelas integer := COALESCE((p_payload->>'numero_parcelas')::integer, 0);
  v_idempotency_key text := NULLIF(trim(p_payload->>'idempotency_key'), '');
  v_valor_base numeric(15,2);
  v_valor_parcela numeric(15,2);
  v_grupo_id uuid := gen_random_uuid();
  v_ids jsonb := '[]'::jsonb;
  v_id uuid;
  v_resposta jsonb;
  v_request public.financeiro_operacoes_idempotentes;
  v_saldo_conta numeric(15,2);
  i integer;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa vinculada.';
  END IF;
  IF NOT coalesce(public.is_empresa_member(v_empresa_id),false) OR coalesce(public.current_user_is_client_scoped(v_empresa_id),true)
    OR NOT coalesce(public.current_user_has_permission(v_empresa_id, 'financeiro:manage'),false) THEN
    RAISE EXCEPTION 'Usuário sem permissão para movimentar o financeiro.' USING ERRCODE = '42501';
  END IF;
  IF v_idempotency_key IS NULL OR char_length(v_idempotency_key) NOT BETWEEN 8 AND 128 THEN
    RAISE EXCEPTION 'Chave de idempotência inválida.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_empresa_id::text || ':' || v_idempotency_key, 0));
  SELECT * INTO v_request FROM public.financeiro_operacoes_idempotentes
  WHERE empresa_id = v_empresa_id AND chave = v_idempotency_key;
  IF FOUND THEN
    IF v_request.operacao <> 'parcelamento' OR (v_request.entrada IS NOT NULL
       AND v_request.entrada IS DISTINCT FROM p_payload - 'idempotency_key') THEN
      RAISE EXCEPTION 'Referencia de operacao ja usada com outros dados.' USING ERRCODE = '22023';
    END IF;
    RETURN v_request.resposta;
  END IF;
  IF v_descricao IS NULL THEN
    RAISE EXCEPTION 'Descrição é obrigatória.';
  END IF;
  IF v_tipo_despesa NOT IN ('fixa', 'variavel') THEN
    RAISE EXCEPTION 'Tipo de despesa inválido.';
  END IF;
  IF v_status NOT IN ('Pendente', 'Pago') THEN
    RAISE EXCEPTION 'Status inválido.';
  END IF;
  IF v_valor_total < v_numero_parcelas * 0.01 OR v_numero_parcelas < 2 OR v_numero_parcelas > 120
     OR v_valor_total IS DISTINCT FROM app_private.financeiro_numero(p_payload->>'valor_total') THEN
    RAISE EXCEPTION 'Valor ou quantidade de parcelas inválidos.';
  END IF;
  IF v_status = 'Pago' AND v_conta_id IS NULL THEN
    RAISE EXCEPTION 'Conta bancária é obrigatória para parcelas pagas.';
  END IF;

  IF v_conta_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.configuracoes_contas_bancarias AS conta
    WHERE conta.id = v_conta_id AND conta.empresa_id = v_empresa_id
    FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'Conta bancária não pertence à empresa ativa.'
      USING ERRCODE = '23503';
  END IF;
  IF v_status = 'Pago' THEN
    SELECT saldo_atual INTO v_saldo_conta
    FROM public.configuracoes_contas_bancarias
    WHERE id = v_conta_id AND empresa_id = v_empresa_id;
    IF v_saldo_conta < v_valor_total THEN
      RAISE EXCEPTION 'Saldo insuficiente na conta selecionada.';
    END IF;
  END IF;

  v_valor_base := trunc(v_valor_total / v_numero_parcelas, 2);
  FOR i IN 1..v_numero_parcelas LOOP
    v_valor_parcela := CASE
      WHEN i = v_numero_parcelas THEN v_valor_total - (v_valor_base * (v_numero_parcelas - 1))
      ELSE v_valor_base
    END;

    INSERT INTO public.financeiro_lancamentos (
      empresa_id, conta_bancaria_id, tipo, origem, descricao, categoria,
      valor, data_competencia, data_pagamento, status, metadados
    ) VALUES (
      v_empresa_id,
      CASE WHEN v_status = 'Pago' THEN v_conta_id ELSE NULL END,
      'despesa',
      'conta_pagar',
      format('%s (Parcela %s/%s)', v_descricao, i, v_numero_parcelas),
      v_categoria,
      v_valor_parcela,
      (v_data_vencimento + make_interval(months => i - 1))::date,
      CASE WHEN v_status = 'Pago' THEN (v_data_competencia + make_interval(months => i - 1))::date ELSE NULL END,
      v_status,
      jsonb_build_object(
        'tipoDespesa', v_tipo_despesa,
        'parcelado', true,
        'parcelaAtual', i,
        'totalParcelas', v_numero_parcelas,
        'grupoParcelamentoId', v_grupo_id,
        'dataCompetencia', (v_data_competencia + make_interval(months => i - 1))::date
      )
    ) RETURNING id INTO v_id;
    v_ids := v_ids || jsonb_build_array(v_id);
  END LOOP;

  IF v_status = 'Pago' THEN
    UPDATE public.configuracoes_contas_bancarias
    SET saldo_atual = saldo_atual - v_valor_total,
        updated_at = now()
    WHERE id = v_conta_id AND empresa_id = v_empresa_id;
  END IF;

  v_resposta := jsonb_build_object('grupoParcelamentoId', v_grupo_id, 'lancamentoIds', v_ids);
  INSERT INTO public.financeiro_operacoes_idempotentes (empresa_id, chave, operacao, resposta, entrada)
  VALUES (v_empresa_id, v_idempotency_key, 'parcelamento', v_resposta, p_payload - 'idempotency_key');
  RETURN v_resposta;
END;
$$;


CREATE OR REPLACE FUNCTION public.transferir_entre_contas_financeiro(p_payload jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT app_private.transferir_entre_contas_financeiro(p_payload);
$$;
CREATE OR REPLACE FUNCTION public.criar_contas_pagar_parceladas(p_payload jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT app_private.criar_contas_pagar_parceladas(p_payload);
$$;
REVOKE ALL ON FUNCTION app_private.transferir_entre_contas_financeiro(jsonb),
  app_private.criar_contas_pagar_parceladas(jsonb), public.transferir_entre_contas_financeiro(jsonb),
  public.criar_contas_pagar_parceladas(jsonb) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA app_private TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.transferir_entre_contas_financeiro(jsonb),
  app_private.criar_contas_pagar_parceladas(jsonb), public.transferir_entre_contas_financeiro(jsonb),
  public.criar_contas_pagar_parceladas(jsonb) TO authenticated,service_role;
-- Os privilegios do ledger sao revogados ao fim da proxima migration, junto das
-- demais APIs. A publicacao deve aplicar as tres migrations em ordem.
COMMIT;
