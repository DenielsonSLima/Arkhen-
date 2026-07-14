-- Planejamento tributário com clientes reais, histórico persistido e cálculos no banco.

CREATE TABLE IF NOT EXISTS public.planejamento_tributario_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  regime_analisado text NOT NULL,
  regime_sugerido text NOT NULL,
  economia_estimada numeric(15,2) NOT NULL DEFAULT 0,
  faturamento_base numeric(15,2) NOT NULL DEFAULT 0,
  observacao text,
  criado_por uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.planejamento_tributario_historico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS planejamento_tributario_tenant_policy ON public.planejamento_tributario_historico;
CREATE POLICY planejamento_tributario_tenant_policy ON public.planejamento_tributario_historico
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (
    public.is_empresa_member(empresa_id)
    AND criado_por = auth.uid()
    AND (cliente_id IS NULL OR EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = planejamento_tributario_historico.cliente_id
        AND c.empresa_id = planejamento_tributario_historico.empresa_id
    ))
  );
CREATE INDEX IF NOT EXISTS idx_planejamento_historico_empresa_data ON public.planejamento_tributario_historico(empresa_id, created_at DESC);
REVOKE INSERT, UPDATE, DELETE ON public.planejamento_tributario_historico FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_planejamento_clientes()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_empresa_id uuid := public.current_empresa_id(); v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa vinculada.'; END IF;
  WITH recebimentos AS (
    SELECT referencia_id, sum(valor) AS valor_recebido
    FROM public.financeiro_lancamentos
    WHERE empresa_id = v_empresa_id AND origem = 'cobranca' AND tipo = 'receita' AND status = 'Pago'
    GROUP BY referencia_id
  ), cobrancas AS (
    SELECT c.cliente_empresa_id,
      CASE WHEN c.status = 'Pago' THEN GREATEST(c.valor, COALESCE(r.valor_recebido, 0))
        ELSE c.valor + COALESCE(r.valor_recebido, 0) END AS valor,
      c.data_vencimento AS data_ref
    FROM public.financeiro_cobrancas c LEFT JOIN recebimentos r ON r.referencia_id = c.id
    WHERE c.empresa_id = v_empresa_id AND c.status <> 'Cancelado'
      AND c.data_vencimento >= CURRENT_DATE - interval '12 months'
  ), receitas AS (
    SELECT cliente_id, sum(valor) faturamento_12, sum(valor) FILTER (WHERE data_ref >= date_trunc('month', CURRENT_DATE)::date) faturamento_mes
    FROM (
      SELECT cliente_empresa_id cliente_id, valor, data_ref FROM cobrancas
      UNION ALL
      SELECT cliente_empresa_id, valor, data_competencia FROM public.financeiro_lancamentos
      WHERE empresa_id = v_empresa_id AND tipo = 'receita' AND origem <> 'cobranca' AND status <> 'Cancelado' AND data_competencia >= CURRENT_DATE - interval '12 months'
    ) r GROUP BY cliente_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'nome', COALESCE(NULLIF(c.razao_social, ''), c.nome), 'cnpj', c.cnpj,
    'regimeAtual', c.tipo,
    'faturamentoMensal', COALESCE(r.faturamento_mes, 0), 'faturamento12Meses', COALESCE(r.faturamento_12, 0),
    'folhaPagamentoMensal', COALESCE((SELECT sum(COALESCE(NULLIF(f->>'salario','')::numeric,0)) FROM jsonb_array_elements(COALESCE(c.funcionarios,'[]'::jsonb)) f WHERE f->>'status' = 'Ativo'), 0),
    'funcionarios', COALESCE(c.funcionarios_count, jsonb_array_length(COALESCE(c.funcionarios,'[]'::jsonb))),
    'anexoSimples', 'III', 'cnaeDescricao', COALESCE(NULLIF(c.cnae_descricao,''), NULLIF(c.cnae,''), 'Não informado')
  ) ORDER BY c.nome), '[]'::jsonb) INTO v_result
  FROM public.clientes c LEFT JOIN receitas r ON r.cliente_id = c.id
  WHERE c.empresa_id = v_empresa_id AND c.status = 'Ativa'
    AND c.tipo IN ('Simples Nacional','Lucro Presumido','Lucro Real');
  RETURN v_result;
END; $$;

CREATE OR REPLACE FUNCTION public.calcular_planejamento_tributario(p_faturamento_anual numeric, p_anexo text DEFAULT 'III')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_empresa_id uuid := public.current_empresa_id(); v_fat numeric := GREATEST(COALESCE(p_faturamento_anual,0),0);
  v_anexo text := CASE WHEN p_anexo IN ('I','II','III','IV','V') THEN p_anexo ELSE 'III' END;
  v_aliq numeric; v_ded numeric; v_sn numeric; v_lp numeric; v_lr numeric; v_melhor text; v_segundo numeric; v_menor numeric;
  v_sn_json jsonb; v_lp_json jsonb; v_lr_json jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa vinculada.'; END IF;
  SELECT aliquota, deducao INTO v_aliq, v_ded FROM (VALUES
    ('I',180000,4.0,0),('I',360000,7.3,5940),('I',720000,9.5,13860),('I',1800000,10.7,22500),('I',3600000,14.3,87300),('I',4800000,19.0,378000),
    ('II',180000,4.5,0),('II',360000,7.8,5940),('II',720000,10.0,13860),('II',1800000,11.2,22500),('II',3600000,14.7,85500),('II',4800000,30.0,720000),
    ('III',180000,6.0,0),('III',360000,11.2,9360),('III',720000,13.5,17640),('III',1800000,16.0,35640),('III',3600000,21.0,125640),('III',4800000,33.0,648000),
    ('IV',180000,4.5,0),('IV',360000,9.0,8100),('IV',720000,10.2,12420),('IV',1800000,14.0,39780),('IV',3600000,22.0,183780),('IV',4800000,33.0,828000),
    ('V',180000,15.5,0),('V',360000,18.0,4500),('V',720000,19.5,9900),('V',1800000,20.5,17100),('V',3600000,23.0,62100),('V',4800000,30.5,540000)
  ) AS f(anexo, limite, aliquota, deducao)
  WHERE anexo = v_anexo AND limite >= LEAST(v_fat, 4800000)
  ORDER BY limite LIMIT 1;
  v_sn := GREATEST(v_fat * v_aliq / 100 - v_ded, 0);
  v_lp := v_fat * 0.32 * (0.15 + 0.09) + v_fat * (0.0065 + 0.03);
  v_lr := v_fat * 0.20 * (CASE WHEN v_fat * 0.20 > 240000 THEN 0.25 ELSE 0.15 END + 0.09) + v_fat * (0.0165 + 0.076);
  IF v_fat > 4800000 THEN
    v_menor := LEAST(v_lp, v_lr); v_segundo := GREATEST(v_lp, v_lr);
  ELSE
    v_menor := LEAST(v_sn,v_lp,v_lr); v_segundo := CASE WHEN v_menor=v_sn THEN LEAST(v_lp,v_lr) WHEN v_menor=v_lp THEN LEAST(v_sn,v_lr) ELSE LEAST(v_sn,v_lp) END;
  END IF;
  v_melhor := CASE WHEN v_fat > 4800000 THEN CASE WHEN v_lp <= v_lr THEN 'Lucro Presumido' ELSE 'Lucro Real' END
    WHEN v_menor = v_sn THEN 'Simples Nacional' WHEN v_menor = v_lp THEN 'Lucro Presumido' ELSE 'Lucro Real' END;
  v_sn_json := jsonb_build_object('regime','Simples Nacional','elegivel',v_fat<=4800000,'aliquotaEfetiva',CASE WHEN v_fat>0 THEN v_sn/v_fat*100 ELSE 0 END,'impostoAnual',v_sn,'impostoMensal',v_sn/12,'descricao',CASE WHEN v_fat>4800000 THEN 'Faturamento acima do limite anual do Simples Nacional' ELSE 'Anexo '||v_anexo||' — estimativa pelo faturamento informado' END,'vantagens',jsonb_build_array('Recolhimento unificado','Rotina tributária simplificada'),'desvantagens',jsonb_build_array('Limite anual de faturamento','Alíquota varia por faixa'));
  v_lp_json := jsonb_build_object('regime','Lucro Presumido','aliquotaEfetiva',CASE WHEN v_fat>0 THEN v_lp/v_fat*100 ELSE 0 END,'impostoAnual',v_lp,'impostoMensal',v_lp/12,'descricao','Estimativa para serviços com presunção de 32%','vantagens',jsonb_build_array('Previsibilidade da base','Sem limite do Simples'),'desvantagens',jsonb_build_array('Exige validação da atividade','Mais obrigações acessórias'));
  v_lr_json := jsonb_build_object('regime','Lucro Real','aliquotaEfetiva',CASE WHEN v_fat>0 THEN v_lr/v_fat*100 ELSE 0 END,'impostoAnual',v_lr,'impostoMensal',v_lr/12,'descricao','Estimativa com margem líquida de 20%','vantagens',jsonb_build_array('Considera o lucro apurado','Pode aproveitar créditos permitidos'),'desvantagens',jsonb_build_array('Exige escrituração detalhada','Resultado depende de custos e créditos reais'));
  v_sn_json := v_sn_json || jsonb_build_object('comparacoes',jsonb_build_array(jsonb_build_object('regime','Lucro Presumido','tipo',CASE WHEN v_lp-v_sn>0 THEN 'economia' ELSE 'custo_adicional' END,'valor',abs(v_lp-v_sn)),jsonb_build_object('regime','Lucro Real','tipo',CASE WHEN v_lr-v_sn>0 THEN 'economia' ELSE 'custo_adicional' END,'valor',abs(v_lr-v_sn))));
  v_lp_json := v_lp_json || jsonb_build_object('comparacoes',jsonb_build_array(jsonb_build_object('regime','Simples Nacional','tipo',CASE WHEN v_sn-v_lp>0 THEN 'economia' ELSE 'custo_adicional' END,'valor',abs(v_sn-v_lp)),jsonb_build_object('regime','Lucro Real','tipo',CASE WHEN v_lr-v_lp>0 THEN 'economia' ELSE 'custo_adicional' END,'valor',abs(v_lr-v_lp))));
  v_lr_json := v_lr_json || jsonb_build_object('comparacoes',jsonb_build_array(jsonb_build_object('regime','Simples Nacional','tipo',CASE WHEN v_sn-v_lr>0 THEN 'economia' ELSE 'custo_adicional' END,'valor',abs(v_sn-v_lr)),jsonb_build_object('regime','Lucro Presumido','tipo',CASE WHEN v_lp-v_lr>0 THEN 'economia' ELSE 'custo_adicional' END,'valor',abs(v_lp-v_lr))));
  RETURN jsonb_build_object('faturamentoAnual',v_fat,'resultados',jsonb_build_array(v_sn_json,v_lp_json,v_lr_json),'regimeSugerido',v_melhor,'economiaEstimada',GREATEST(v_segundo-v_menor,0),'recomendacaoMotivos',jsonb_build_array('Menor carga estimada entre os cenários','Revisar atividade, margem e despesas antes da decisão'),'limiteSimplesNacional',4800000);
END; $$;

CREATE OR REPLACE FUNCTION public.consultar_enquadramento_simples_json(p_faturamento_12 numeric, p_anexo text DEFAULT 'III')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_empresa_id uuid := public.current_empresa_id(); v_fat numeric := GREATEST(COALESCE(p_faturamento_12,0),0); v_anexo text := CASE WHEN p_anexo IN ('I','II','III','IV','V') THEN p_anexo ELSE 'III' END;
  v_faixa int; v_limite numeric; v_aliq numeric; v_ded numeric; v_inferior numeric;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa vinculada.'; END IF;
  SELECT faixa, limite, aliquota, deducao INTO v_faixa,v_limite,v_aliq,v_ded FROM (VALUES
    ('I',1,180000,4.0,0),('I',2,360000,7.3,5940),('I',3,720000,9.5,13860),('I',4,1800000,10.7,22500),('I',5,3600000,14.3,87300),('I',6,4800000,19.0,378000),
    ('II',1,180000,4.5,0),('II',2,360000,7.8,5940),('II',3,720000,10.0,13860),('II',4,1800000,11.2,22500),('II',5,3600000,14.7,85500),('II',6,4800000,30.0,720000),
    ('III',1,180000,6.0,0),('III',2,360000,11.2,9360),('III',3,720000,13.5,17640),('III',4,1800000,16.0,35640),('III',5,3600000,21.0,125640),('III',6,4800000,33.0,648000),
    ('IV',1,180000,4.5,0),('IV',2,360000,9.0,8100),('IV',3,720000,10.2,12420),('IV',4,1800000,14.0,39780),('IV',5,3600000,22.0,183780),('IV',6,4800000,33.0,828000),
    ('V',1,180000,15.5,0),('V',2,360000,18.0,4500),('V',3,720000,19.5,9900),('V',4,1800000,20.5,17100),('V',5,3600000,23.0,62100),('V',6,4800000,30.5,540000)
  ) f(anexo,faixa,limite,aliquota,deducao)
  WHERE anexo=v_anexo AND limite >= LEAST(v_fat, 4800000)
  ORDER BY limite LIMIT 1;
  v_inferior := CASE v_faixa WHEN 1 THEN 0 WHEN 2 THEN 180000.01 WHEN 3 THEN 360000.01 WHEN 4 THEN 720000.01 WHEN 5 THEN 1800000.01 ELSE 3600000.01 END;
  RETURN jsonb_build_object('anexo',v_anexo,'anexoLabel','Anexo '||v_anexo,'faixa',v_faixa,'limiteInferior',v_inferior,'limiteSuperior',v_limite,'aliquotaNominal',v_aliq,'aliquotaEfetiva',CASE WHEN v_fat>0 THEN GREATEST((v_fat*v_aliq/100-v_ded)/v_fat*100,0) ELSE 0 END,'valorDeduzir',v_ded,'distanciaProximaFaixa',GREATEST(v_limite-v_fat,0),'mensagem',CASE WHEN v_fat>4800000 THEN 'Faturamento acima do limite anual do Simples Nacional.' ELSE 'Enquadramento estimado no Anexo '||v_anexo||', faixa '||v_faixa||'.' END);
END; $$;

CREATE OR REPLACE FUNCTION public.get_planejamento_historico()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_empresa_id uuid := public.current_empresa_id();
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa vinculada.'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',h.id,'clienteId',h.cliente_id,'clienteNome',COALESCE(c.nome,'Cliente removido'),'dataSimulacao',h.created_at::date,'regimeAnalisado',h.regime_analisado,'regimeSugerido',h.regime_sugerido,'economiaEstimada',h.economia_estimada,'faturamentoBase',h.faturamento_base,'observacao',h.observacao) ORDER BY h.created_at DESC),'[]'::jsonb) FROM public.planejamento_tributario_historico h LEFT JOIN public.clientes c ON c.id=h.cliente_id AND c.empresa_id=v_empresa_id WHERE h.empresa_id=v_empresa_id);
END; $$;

CREATE OR REPLACE FUNCTION public.gerar_diagnostico_tributario_json(p_cliente jsonb, p_comparativo jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_empresa_id uuid := public.current_empresa_id(); v_atual text := COALESCE(p_cliente->>'regimeAtual','Não informado');
  v_recomendado text := COALESCE(p_comparativo->>'regimeSugerido',v_atual); v_imposto_atual numeric := 0; v_imposto_recomendado numeric := 0;
  v_economia numeric; v_percentual numeric; v_estrelas int; v_confianca int;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa vinculada.'; END IF;
  SELECT COALESCE((r->>'impostoAnual')::numeric,0) INTO v_imposto_atual FROM jsonb_array_elements(COALESCE(p_comparativo->'resultados','[]'::jsonb)) r WHERE r->>'regime'=v_atual LIMIT 1;
  SELECT COALESCE((r->>'impostoAnual')::numeric,0) INTO v_imposto_recomendado FROM jsonb_array_elements(COALESCE(p_comparativo->'resultados','[]'::jsonb)) r WHERE r->>'regime'=v_recomendado LIMIT 1;
  v_economia := GREATEST(COALESCE(v_imposto_atual,0)-COALESCE(v_imposto_recomendado,0),0); v_percentual := CASE WHEN v_imposto_atual>0 THEN v_economia/v_imposto_atual ELSE 0 END;
  v_estrelas := CASE WHEN v_atual=v_recomendado THEN 4 WHEN v_economia>=10000 OR v_percentual>=0.08 THEN 5 WHEN v_economia>=5000 OR v_percentual>=0.04 THEN 4 WHEN v_economia>=1500 OR v_percentual>=0.015 THEN 3 ELSE 2 END;
  v_confianca := LEAST(96,86+LEAST(8,round(v_percentual*70)::int)+CASE WHEN COALESCE((p_cliente->>'faturamento12Meses')::numeric,0)>0 THEN 2 ELSE 0 END);
  RETURN jsonb_build_object('regimeAtual',v_atual,'regimeRecomendado',v_recomendado,'economiaAnual',v_economia,
    'grauRecomendacao',CASE WHEN v_estrelas=5 THEN 'Muito alta' WHEN v_estrelas=4 THEN 'Alta' WHEN v_estrelas=3 THEN 'Moderada' ELSE 'Baixa' END,
    'estrelas',v_estrelas,'confiancaAnalise',v_confianca,
    'explicacoes',jsonb_build_array(CASE WHEN v_atual=v_recomendado THEN 'O regime atual apresentou o menor custo estimado.' ELSE 'Outro regime apresentou menor carga estimada para os dados informados.' END,'A comparação deve ser validada com atividade, margem, créditos e despesas reais antes de qualquer mudança.'),
    'pontosAtencao',jsonb_build_array('Resultado estimativo, não substitui a apuração tributária.','Recalcule sempre que faturamento, folha ou atividade mudarem.'));
END; $$;

CREATE OR REPLACE FUNCTION public.salvar_planejamento_tributario(p_cliente_id uuid, p_observacao text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_empresa_id uuid := public.current_empresa_id(); v_id uuid; v_regime_atual text;
  v_faturamento numeric := 0; v_calculo jsonb; v_regime_sugerido text; v_economia numeric;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa vinculada.'; END IF;
  SELECT tipo INTO v_regime_atual FROM public.clientes WHERE id=p_cliente_id AND empresa_id=v_empresa_id;
  IF v_regime_atual IS NULL THEN RAISE EXCEPTION 'Cliente não pertence ao escritório.'; END IF;
  IF v_regime_atual NOT IN ('Simples Nacional','Lucro Presumido','Lucro Real') THEN
    RAISE EXCEPTION 'Cliente sem regime empresarial compatível com esta análise.';
  END IF;

  WITH recebimentos AS (
    SELECT referencia_id, sum(valor) AS valor_recebido FROM public.financeiro_lancamentos
    WHERE empresa_id=v_empresa_id AND origem='cobranca' AND tipo='receita' AND status='Pago'
    GROUP BY referencia_id
  ), receitas AS (
    SELECT CASE WHEN c.status='Pago' THEN GREATEST(c.valor,COALESCE(r.valor_recebido,0))
      ELSE c.valor+COALESCE(r.valor_recebido,0) END AS valor
    FROM public.financeiro_cobrancas c LEFT JOIN recebimentos r ON r.referencia_id=c.id
    WHERE c.empresa_id=v_empresa_id AND c.cliente_empresa_id=p_cliente_id AND c.status<>'Cancelado'
      AND c.data_vencimento>=CURRENT_DATE-interval '12 months'
    UNION ALL
    SELECT valor FROM public.financeiro_lancamentos
    WHERE empresa_id=v_empresa_id AND cliente_empresa_id=p_cliente_id AND tipo='receita'
      AND origem<>'cobranca' AND status<>'Cancelado' AND data_competencia>=CURRENT_DATE-interval '12 months'
  ) SELECT COALESCE(sum(valor),0) INTO v_faturamento FROM receitas;

  v_calculo := public.calcular_planejamento_tributario(v_faturamento, 'III');
  v_regime_sugerido := COALESCE(v_calculo->>'regimeSugerido', v_regime_atual);
  v_economia := GREATEST(COALESCE((v_calculo->>'economiaEstimada')::numeric,0),0);
  INSERT INTO public.planejamento_tributario_historico(empresa_id,cliente_id,regime_analisado,regime_sugerido,economia_estimada,faturamento_base,observacao)
  VALUES(v_empresa_id,p_cliente_id,v_regime_atual,v_regime_sugerido,v_economia,v_faturamento,NULLIF(trim(p_observacao),''))
  RETURNING id INTO v_id; RETURN v_id;
END; $$;

REVOKE ALL ON FUNCTION public.get_planejamento_clientes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calcular_planejamento_tributario(numeric,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consultar_enquadramento_simples_json(numeric,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_planejamento_historico() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gerar_diagnostico_tributario_json(jsonb,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salvar_planejamento_tributario(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_planejamento_clientes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.calcular_planejamento_tributario(numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consultar_enquadramento_simples_json(numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_planejamento_historico() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerar_diagnostico_tributario_json(jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_planejamento_tributario(uuid,text) TO authenticated;
