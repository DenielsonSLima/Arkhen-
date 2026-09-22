-- Nao regrava valores/saldos historicos. Conserva as assinaturas publicas.
BEGIN;
CREATE OR REPLACE FUNCTION app_private.financeiro_empresa_autorizada(p_contas boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE t uuid := public.current_empresa_id();
BEGIN
  IF auth.uid() IS NULL OR t IS NULL OR NOT coalesce(public.is_empresa_member(t),false)
    OR coalesce(public.current_user_is_client_scoped(t),true)
    OR NOT (coalesce(public.current_user_has_permission(t,'financeiro:manage'),false)
      OR (p_contas AND coalesce(public.current_user_has_permission(t,'contas-bancarias:manage'),false))) THEN
    RAISE EXCEPTION 'Permissao financeira necessaria.' USING ERRCODE='42501';
  END IF;
  RETURN t;
END;
$$;
REVOKE ALL ON FUNCTION app_private.financeiro_empresa_autorizada(boolean) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION app_private.prever_pagamento_despesa(p_lancamento_id uuid,p_desconto numeric,p_juros numeric)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE t uuid := app_private.financeiro_empresa_autorizada(); l public.financeiro_lancamentos;
  desconto numeric := app_private.financeiro_numero(p_desconto::text);
  juros numeric := app_private.financeiro_numero(p_juros::text);
BEGIN
  SELECT * INTO l FROM public.financeiro_lancamentos WHERE id=p_lancamento_id AND empresa_id=t;
  IF NOT FOUND OR l.tipo<>'despesa' OR l.status<>'Pendente' THEN
    RAISE EXCEPTION 'Despesa pendente nao encontrada.' USING ERRCODE='22023';
  END IF;
  IF desconto<0 OR desconto>l.valor OR juros<0 THEN
    RAISE EXCEPTION 'Desconto ou juros invalidos.' USING ERRCODE='22023';
  END IF;
  RETURN jsonb_build_object('valorPago',l.valor-desconto+juros);
END;
$$;
CREATE OR REPLACE FUNCTION public.prever_pagamento_despesa(p_lancamento_id uuid,p_desconto numeric,p_juros numeric)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT app_private.prever_pagamento_despesa(p_lancamento_id,p_desconto,p_juros);
$$;

CREATE OR REPLACE FUNCTION app_private.pagar_despesa_financeira(
  p_lancamento_id uuid,p_conta_bancaria_id uuid,p_data_pagamento date,
  p_valor_pago numeric,p_desconto numeric,p_juros numeric,p_observacao text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t uuid := app_private.financeiro_empresa_autorizada(); l public.financeiro_lancamentos;
  valor_pago numeric := app_private.financeiro_numero(p_valor_pago::text);
  desconto numeric := app_private.financeiro_numero(p_desconto::text);
  juros numeric := app_private.financeiro_numero(p_juros::text); detalhes jsonb;
BEGIN
  IF p_data_pagamento IS NULL OR p_conta_bancaria_id IS NULL OR valor_pago<=0 OR desconto<0 OR juros<0 THEN
    RAISE EXCEPTION 'Informe conta, data e valores de pagamento validos.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO l FROM public.financeiro_lancamentos WHERE id=p_lancamento_id AND empresa_id=t FOR UPDATE;
  IF NOT FOUND OR l.tipo<>'despesa' THEN RAISE EXCEPTION 'Despesa nao encontrada.' USING ERRCODE='22023'; END IF;
  detalhes:=jsonb_build_object('valor_pago',valor_pago,'desconto',desconto,'juros',juros,'observacao',coalesce(p_observacao,''));
  -- A mesma confirmacao pode ser repetida apos perda da resposta, sem nova saida.
  IF l.status='Pago' AND l.conta_bancaria_id=p_conta_bancaria_id AND l.data_pagamento=p_data_pagamento
    AND l.metadados->'pagamento_detalhes'=detalhes THEN RETURN true; END IF;
  IF l.status<>'Pendente' THEN RAISE EXCEPTION 'Somente despesas pendentes podem ser pagas.' USING ERRCODE='22023'; END IF;
  IF desconto>l.valor OR valor_pago<>l.valor-desconto+juros THEN
    RAISE EXCEPTION 'O total pago deve corresponder ao valor da despesa menos desconto mais juros.' USING ERRCODE='22023';
  END IF;
  PERFORM 1 FROM public.configuracoes_contas_bancarias WHERE id=p_conta_bancaria_id AND empresa_id=t FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta bancaria fora da empresa.' USING ERRCODE='23503'; END IF;
  UPDATE public.financeiro_lancamentos SET status='Pago',data_pagamento=p_data_pagamento,
    conta_bancaria_id=p_conta_bancaria_id,metadados=coalesce(metadados,'{}'::jsonb)||jsonb_build_object(
      'pagamento_detalhes',detalhes,'contaBancariaId',p_conta_bancaria_id,'dataPagamento',p_data_pagamento),updated_at=now()
    WHERE id=l.id AND empresa_id=t;
  UPDATE public.configuracoes_contas_bancarias SET saldo_atual=saldo_atual-valor_pago,updated_at=now()
    WHERE id=p_conta_bancaria_id AND empresa_id=t;
  RETURN true;
END;
$$;
CREATE OR REPLACE FUNCTION public.pagar_despesa_financeira(
  p_lancamento_id uuid,p_conta_bancaria_id uuid,p_data_pagamento date,
  p_valor_pago numeric,p_desconto numeric,p_juros numeric,p_observacao text)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT app_private.pagar_despesa_financeira(p_lancamento_id,p_conta_bancaria_id,p_data_pagamento,p_valor_pago,p_desconto,p_juros,p_observacao);
$$;

CREATE OR REPLACE FUNCTION app_private.salvar_lancamento_financeiro(p_payload jsonb)
RETURNS public.financeiro_lancamentos LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t uuid := app_private.financeiro_empresa_autorizada(); l public.financeiro_lancamentos;
  conta uuid := nullif(p_payload->>'conta_bancaria_id','')::uuid;
  cliente uuid := nullif(p_payload->>'cliente_empresa_id','')::uuid;
  tipo text := coalesce(nullif(p_payload->>'tipo',''),'receita');
  origem text := coalesce(nullif(p_payload->>'origem',''),'manual');
  estado text := coalesce(nullif(p_payload->>'status',''),'Pendente');
  valor numeric := app_private.financeiro_numero(p_payload->>'valor');
  competencia date := coalesce(nullif(p_payload->>'data_competencia','')::date,(now() AT TIME ZONE 'America/Maceio')::date);
  pagamento date := nullif(p_payload->>'data_pagamento','')::date;
  meta jsonb := coalesce(p_payload->'metadados','{}'::jsonb);
BEGIN
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR octet_length(p_payload::text)>65536
    OR jsonb_typeof(meta) IS DISTINCT FROM 'object' OR valor<=0
    OR tipo NOT IN ('receita','despesa') OR estado NOT IN ('Pendente','Pago')
    OR origem NOT IN ('conta_pagar','outro_credito','outro_debito','manual')
    OR nullif(trim(p_payload->>'descricao'),'') IS NULL THEN
    RAISE EXCEPTION 'Lancamento manual invalido; transferencias e cobrancas usam operacoes proprias.' USING ERRCODE='22023';
  END IF;
  IF (origem='conta_pagar' AND tipo<>'despesa') OR (origem='outro_debito' AND tipo<>'despesa')
    OR (origem='outro_credito' AND tipo<>'receita') THEN RAISE EXCEPTION 'Tipo e origem inconsistentes.' USING ERRCODE='22023'; END IF;
  IF estado='Pago' AND (conta IS NULL OR pagamento IS NULL) THEN
    RAISE EXCEPTION 'Conta e data obrigatorias para lancamento pago.' USING ERRCODE='22023';
  END IF;
  IF estado='Pendente' AND pagamento IS NOT NULL THEN RAISE EXCEPTION 'Lancamento pendente nao possui data de pagamento.' USING ERRCODE='22023'; END IF;
  IF cliente IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=cliente AND empresa_id=t) THEN
    RAISE EXCEPTION 'Cliente fora da empresa.' USING ERRCODE='23503';
  END IF;
  IF conta IS NOT NULL THEN
    PERFORM 1 FROM public.configuracoes_contas_bancarias WHERE id=conta AND empresa_id=t FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Conta bancaria fora da empresa.' USING ERRCODE='23503'; END IF;
  END IF;
  meta:=meta-'pagamento_detalhes'-'contaBancariaId'-'dataPagamento';
  IF estado='Pago' AND tipo='despesa' THEN
    meta:=meta||jsonb_build_object('pagamento_detalhes',jsonb_build_object('valor_pago',valor,'desconto',0,'juros',0,'observacao',''));
  END IF;
  INSERT INTO public.financeiro_lancamentos(empresa_id,conta_bancaria_id,cliente_empresa_id,tipo,origem,descricao,categoria,
    valor,data_competencia,data_pagamento,status,metadados)
  VALUES(t,conta,cliente,tipo,origem,trim(p_payload->>'descricao'),coalesce(nullif(trim(p_payload->>'categoria'),''),'Geral'),
    valor,competencia,pagamento,estado,meta) RETURNING * INTO l;
  IF estado='Pago' THEN
    UPDATE public.configuracoes_contas_bancarias SET saldo_atual=saldo_atual+CASE WHEN tipo='receita' THEN valor ELSE -valor END,
      updated_at=now() WHERE id=conta AND empresa_id=t;
  END IF;
  RETURN l;
END;
$$;
CREATE OR REPLACE FUNCTION public.salvar_lancamento_financeiro(p_payload jsonb)
RETURNS public.financeiro_lancamentos LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT app_private.salvar_lancamento_financeiro(p_payload);
$$;

CREATE OR REPLACE FUNCTION app_private.salvar_conta_bancaria(p_payload jsonb)
RETURNS public.configuracoes_contas_bancarias LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t uuid := app_private.financeiro_empresa_autorizada(true); c public.configuracoes_contas_bancarias;
  identificador uuid := nullif(p_payload->>'id','')::uuid;
  inicial numeric := app_private.financeiro_numero(coalesce(p_payload->>'saldo_inicial','0'));
BEGIN
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR nullif(trim(p_payload->>'banco'),'') IS NULL
    OR nullif(trim(p_payload->>'agencia'),'') IS NULL OR nullif(trim(p_payload->>'numero_conta'),'') IS NULL
    OR coalesce(nullif(p_payload->>'tipo_conta',''),'corrente') NOT IN ('corrente','poupanca') THEN
    RAISE EXCEPTION 'Dados da conta bancaria invalidos.' USING ERRCODE='22023';
  END IF;
  IF identificador IS NULL THEN
    INSERT INTO public.configuracoes_contas_bancarias(empresa_id,banco,agencia,numero_conta,tipo_conta,saldo_inicial,saldo_atual)
    VALUES(t,trim(p_payload->>'banco'),trim(p_payload->>'agencia'),trim(p_payload->>'numero_conta'),
      coalesce(nullif(p_payload->>'tipo_conta',''),'corrente'),inicial,inicial) RETURNING * INTO c;
  ELSE
    SELECT * INTO c FROM public.configuracoes_contas_bancarias WHERE id=identificador AND empresa_id=t FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Conta bancaria nao encontrada.' USING ERRCODE='23503'; END IF;
    UPDATE public.configuracoes_contas_bancarias SET banco=trim(p_payload->>'banco'),agencia=trim(p_payload->>'agencia'),
      numero_conta=trim(p_payload->>'numero_conta'),tipo_conta=coalesce(nullif(p_payload->>'tipo_conta',''),'corrente'),
      saldo_atual=saldo_atual+(inicial-saldo_inicial),saldo_inicial=inicial,updated_at=now()
      WHERE id=identificador AND empresa_id=t RETURNING * INTO c;
  END IF;
  RETURN c;
END;
$$;
CREATE OR REPLACE FUNCTION public.salvar_conta_bancaria(p_payload jsonb)
RETURNS public.configuracoes_contas_bancarias LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT app_private.salvar_conta_bancaria(p_payload);
$$;

-- Mantem as baixas internas existentes apos a revogacao do DML direto.
CREATE OR REPLACE FUNCTION app_private.financeiro_recebimento_empresa()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE t uuid:=public.current_empresa_id();
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR NOT coalesce(public.is_empresa_member(t),false)
   OR coalesce(public.current_user_is_client_scoped(t),true)
   OR NOT (coalesce(public.current_user_has_permission(t,'financeiro:manage'),false)
      OR coalesce(public.current_user_has_permission(t,'faturamento:manage'),false)) THEN
   RAISE EXCEPTION 'Permissao para recebimento necessaria.' USING ERRCODE='42501';
 END IF;
 RETURN t;
END;
$$;
REVOKE ALL ON FUNCTION app_private.financeiro_recebimento_empresa() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION app_private.baixar_manual_cobranca_custom(p_cobranca_id uuid, p_data_pagamento date, p_forma_pagamento text, p_valor_recebido numeric, p_desconto numeric, p_juros numeric, p_observacao text, p_baixar_parcial boolean, p_conta_bancaria_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_empresa_id uuid := app_private.financeiro_recebimento_empresa();
  v_cobranca public.financeiro_cobrancas;
  v_valor_abatido numeric;
  v_novo_valor numeric;
  v_novo_status text;
  v_lancamento_id uuid;
BEGIN
  IF p_data_pagamento IS NULL OR p_baixar_parcial IS NULL
    OR app_private.financeiro_numero(p_valor_recebido::text)<=0
    OR app_private.financeiro_numero(coalesce(p_desconto,0)::text)<0
    OR app_private.financeiro_numero(coalesce(p_juros,0)::text)<0 THEN
    RAISE EXCEPTION 'Valores de recebimento invalidos.' USING ERRCODE='22023';
  END IF;
  IF p_conta_bancaria_id IS NOT NULL THEN
    PERFORM 1 FROM public.configuracoes_contas_bancarias WHERE id=p_conta_bancaria_id AND empresa_id=v_empresa_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Conta bancaria fora da empresa.' USING ERRCODE='23503'; END IF;
  END IF;
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
  IF v_valor_abatido <= 0 OR v_valor_abatido > v_cobranca.valor
    OR (NOT p_baixar_parcial AND v_valor_abatido <> v_cobranca.valor) THEN
    RAISE EXCEPTION 'A baixa deve corresponder ao saldo em aberto; use baixa parcial para valor menor.' USING ERRCODE='22023';
  END IF;
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
$function$
;
CREATE OR REPLACE FUNCTION public.baixar_manual_cobranca_custom(
 p_cobranca_id uuid,p_data_pagamento date,p_forma_pagamento text,p_valor_recebido numeric,
 p_desconto numeric,p_juros numeric,p_observacao text,p_baixar_parcial boolean,p_conta_bancaria_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
 SELECT app_private.baixar_manual_cobranca_custom(p_cobranca_id,p_data_pagamento,p_forma_pagamento,p_valor_recebido,
   p_desconto,p_juros,p_observacao,p_baixar_parcial,p_conta_bancaria_id);
$$;
CREATE OR REPLACE FUNCTION app_private.confirmar_recebimento_financeiro(p_cobranca_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t uuid:=app_private.financeiro_recebimento_empresa(); c public.financeiro_cobrancas;
BEGIN
 SELECT * INTO c FROM public.financeiro_cobrancas WHERE id=p_cobranca_id AND empresa_id=t FOR UPDATE;
 IF NOT FOUND OR c.status='Cancelado' THEN RETURN false; END IF;
 IF c.status='Pago' THEN RETURN true; END IF;
 IF EXISTS(SELECT 1 FROM public.financeiro_cobrancas_integracoes WHERE empresa_id=t AND cobranca_id=c.id AND provedor='inter') THEN
   RAISE EXCEPTION 'Cobrancas Banco Inter devem ser conciliadas pelo webhook.' USING ERRCODE='22023';
 END IF;
 IF app_private.financeiro_numero(c.valor::text)<=0 THEN RAISE EXCEPTION 'Valor invalido.' USING ERRCODE='22023'; END IF;
 UPDATE public.financeiro_cobrancas SET status='Pago',data_pagamento=now(),updated_at=now() WHERE id=c.id AND empresa_id=t;
 INSERT INTO public.financeiro_lancamentos(empresa_id,cliente_empresa_id,tipo,origem,descricao,categoria,valor,data_competencia,data_pagamento,status,referencia_id)
 VALUES(t,c.cliente_empresa_id,'receita','cobranca',c.descricao,c.categoria,c.valor,c.data_vencimento,
   (now() AT TIME ZONE 'America/Maceio')::date,'Pago',c.id);
 RETURN true;
END;
$$;
CREATE OR REPLACE FUNCTION public.confirmar_recebimento_financeiro(p_cobranca_id uuid)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT app_private.confirmar_recebimento_financeiro(p_cobranca_id); $$;
REVOKE ALL ON FUNCTION app_private.baixar_manual_cobranca_custom(uuid,date,text,numeric,numeric,numeric,text,boolean,uuid),
 public.baixar_manual_cobranca_custom(uuid,date,text,numeric,numeric,numeric,text,boolean,uuid),
 app_private.confirmar_recebimento_financeiro(uuid),public.confirmar_recebimento_financeiro(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.baixar_manual_cobranca_custom(uuid,date,text,numeric,numeric,numeric,text,boolean,uuid),
 public.baixar_manual_cobranca_custom(uuid,date,text,numeric,numeric,numeric,text,boolean,uuid),
 app_private.confirmar_recebimento_financeiro(uuid),public.confirmar_recebimento_financeiro(uuid) TO authenticated,service_role;

-- Defesa contra futuras concessoes acidentais e RPCs antigas que escrevem
-- sem validar RBAC. service_role sem usuario continua com suas permissoes.
CREATE OR REPLACE FUNCTION app_private.proteger_escrita_financeira()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE t uuid := CASE WHEN TG_OP='DELETE' THEN OLD.empresa_id ELSE NEW.empresa_id END;
  recebimento boolean := false;
BEGIN
  -- A FK de clientes e ON DELETE SET NULL. Preserva essa cascata autorizada
  -- sem exigir financeiro:manage de quem ja pode excluir o cliente.
  IF TG_TABLE_NAME='financeiro_lancamentos' AND TG_OP='UPDATE' AND pg_trigger_depth()>1 THEN
    IF OLD.cliente_empresa_id IS NOT NULL AND NEW.cliente_empresa_id IS NULL
      AND (to_jsonb(NEW)-'cliente_empresa_id') IS NOT DISTINCT FROM (to_jsonb(OLD)-'cliente_empresa_id')
      AND coalesce(public.is_empresa_member(t),false) AND NOT coalesce(public.current_user_is_client_scoped(t),true)
      AND NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=OLD.cliente_empresa_id AND empresa_id=t) THEN
      RETURN NEW;
    END IF;
  END IF;
  IF current_user IN ('authenticated','anon') AND (TG_TABLE_NAME='financeiro_lancamentos' OR TG_OP<>'DELETE') THEN
    RAISE EXCEPTION 'Use uma operacao financeira autorizada.' USING ERRCODE='42501';
  END IF;
  IF TG_TABLE_NAME='financeiro_lancamentos' AND TG_OP='INSERT' THEN
    recebimento := NEW.tipo='receita' AND NEW.origem='cobranca';
  ELSIF TG_TABLE_NAME='configuracoes_contas_bancarias' AND TG_OP='UPDATE' THEN
    recebimento := NEW.saldo_inicial=OLD.saldo_inicial AND NEW.banco=OLD.banco
      AND NEW.agencia=OLD.agencia AND NEW.numero_conta=OLD.numero_conta AND NEW.tipo_conta=OLD.tipo_conta;
  END IF;
  IF auth.uid() IS NOT NULL AND (NOT coalesce(public.is_empresa_member(t),false) OR coalesce(public.current_user_is_client_scoped(t),true)
    OR NOT (coalesce(public.current_user_has_permission(t,'financeiro:manage'),false)
      OR (coalesce(recebimento,false) AND coalesce(public.current_user_has_permission(t,'faturamento:manage'),false)) OR
      (TG_TABLE_NAME='configuracoes_contas_bancarias' AND coalesce(public.current_user_has_permission(t,'contas-bancarias:manage'),false)))) THEN
    RAISE EXCEPTION 'Permissao financeira necessaria.' USING ERRCODE='42501';
  END IF;
  IF TG_TABLE_NAME='configuracoes_contas_bancarias' AND TG_OP='DELETE' AND auth.uid() IS NOT NULL THEN
    IF OLD.saldo_atual<>0 OR EXISTS(SELECT 1 FROM public.financeiro_lancamentos WHERE conta_bancaria_id=OLD.id AND empresa_id=t) THEN
      RAISE EXCEPTION 'Conta com saldo ou movimentacoes nao pode ser excluida.' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION app_private.proteger_escrita_financeira() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS financeiro_escrita_autorizada ON public.financeiro_lancamentos;
CREATE TRIGGER financeiro_escrita_autorizada BEFORE INSERT OR UPDATE OR DELETE ON public.financeiro_lancamentos
  FOR EACH ROW EXECUTE FUNCTION app_private.proteger_escrita_financeira();
DROP TRIGGER IF EXISTS financeiro_conta_escrita_autorizada ON public.configuracoes_contas_bancarias;
CREATE TRIGGER financeiro_conta_escrita_autorizada BEFORE INSERT OR UPDATE OR DELETE ON public.configuracoes_contas_bancarias
  FOR EACH ROW EXECUTE FUNCTION app_private.proteger_escrita_financeira();
ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_contas_bancarias ENABLE ROW LEVEL SECURITY;
REVOKE INSERT,UPDATE,DELETE ON public.financeiro_lancamentos FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE ON public.configuracoes_contas_bancarias FROM PUBLIC,anon,authenticated;
DROP POLICY IF EXISTS financeiro_contas_delete_guard ON public.configuracoes_contas_bancarias;
CREATE POLICY financeiro_contas_delete_guard ON public.configuracoes_contas_bancarias AS RESTRICTIVE FOR DELETE TO authenticated
  USING (coalesce(public.current_user_has_permission(empresa_id,'financeiro:manage'),false) OR coalesce(public.current_user_has_permission(empresa_id,'contas-bancarias:manage'),false));

REVOKE ALL ON FUNCTION app_private.prever_pagamento_despesa(uuid,numeric,numeric),public.prever_pagamento_despesa(uuid,numeric,numeric),
  app_private.pagar_despesa_financeira(uuid,uuid,date,numeric,numeric,numeric,text),public.pagar_despesa_financeira(uuid,uuid,date,numeric,numeric,numeric,text),
  app_private.salvar_lancamento_financeiro(jsonb),public.salvar_lancamento_financeiro(jsonb),
  app_private.salvar_conta_bancaria(jsonb),public.salvar_conta_bancaria(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.prever_pagamento_despesa(uuid,numeric,numeric),public.prever_pagamento_despesa(uuid,numeric,numeric),
  app_private.pagar_despesa_financeira(uuid,uuid,date,numeric,numeric,numeric,text),public.pagar_despesa_financeira(uuid,uuid,date,numeric,numeric,numeric,text),
  app_private.salvar_lancamento_financeiro(jsonb),public.salvar_lancamento_financeiro(jsonb),
  app_private.salvar_conta_bancaria(jsonb),public.salvar_conta_bancaria(jsonb) TO authenticated,service_role;
COMMIT;
