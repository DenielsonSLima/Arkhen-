-- Centraliza as regras das calculadoras no banco. O frontend envia somente entradas
-- e apresenta o JSON devolvido pela RPC.

CREATE OR REPLACE FUNCTION public.calculo_inss_progressivo(p_base numeric)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE v_base numeric := GREATEST(COALESCE(p_base,0),0); v_total numeric := 0; v_anterior numeric := 0; v_limite numeric; v_aliquota numeric;
BEGIN
  FOR v_limite,v_aliquota IN SELECT * FROM (VALUES (1518.00::numeric,0.075::numeric),(2793.88,0.09),(4190.83,0.12),(8157.41,0.14)) f(limite,aliquota) LOOP
    EXIT WHEN v_base <= v_anterior; v_total := v_total + (LEAST(v_base,v_limite)-v_anterior)*v_aliquota; v_anterior := v_limite;
  END LOOP;
  RETURN round(LEAST(v_total,908.86),2);
END; $$;

CREATE OR REPLACE FUNCTION public.calculo_irrf(p_base numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  SELECT round(GREATEST(CASE WHEN COALESCE(p_base,0)<=2259.20 THEN 0 WHEN p_base<=2826.65 THEN p_base*0.075-169.44 WHEN p_base<=3751.05 THEN p_base*0.15-381.44 WHEN p_base<=4664.68 THEN p_base*0.225-662.77 ELSE p_base*0.275-896 END,0),2)
$$;

CREATE OR REPLACE FUNCTION public.calculo_data_segura(p_valor text, p_padrao date)
RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
BEGIN
  RETURN COALESCE(NULLIF(trim(p_valor), '')::date, p_padrao);
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
  RETURN p_padrao;
END; $$;

CREATE OR REPLACE FUNCTION public.calcular_simulacao_contabil(p_tipo text, p jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_empresa_id uuid := public.current_empresa_id(); a numeric; b numeric; c numeric; d numeric; e numeric; f numeric; g numeric; h numeric;
  v_result jsonb; v_data1 date; v_data2 date; v_dias int; v_meses int; v_anos int; v_anexo text; v_faixa int; v_aliq numeric; v_ded numeric;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa vinculada.'; END IF;

  CASE p_tipo
  WHEN 'prolabore' THEN
    a:=GREATEST(COALESCE((p->>'valor')::numeric,0),0); b:=LEAST(a*0.11,908.86); c:=public.calculo_irrf(GREATEST(a-b,0)); d:=a*COALESCE((p#>>'{regrasGerais,aliquotaInssPatronal}')::numeric/100,0.20);
    v_result:=jsonb_build_object('valorProLabore',round(a,2),'inss',round(b,2),'irrf',c,'liquido',round(a-b-c,2),'cpp',round(d,2),'custoEmpresa',round(a+d,2));
  WHEN 'das' THEN
    a:=GREATEST(COALESCE((p->>'faturamentoMensal')::numeric,0),0); b:=GREATEST(COALESCE((p->>'faturamento12Meses')::numeric,0),0); v_anexo:=CASE WHEN p->>'anexo' IN ('I','II','III','IV','V') THEN p->>'anexo' ELSE 'III' END;
    SELECT faixa,aliquota,deducao INTO v_faixa,v_aliq,v_ded FROM (VALUES
      ('I',1,180000,4.0,0),('I',2,360000,7.3,5940),('I',3,720000,9.5,13860),('I',4,1800000,10.7,22500),('I',5,3600000,14.3,87300),('I',6,999999999999::numeric,19.0,378000),
      ('II',1,180000,4.5,0),('II',2,360000,7.8,5940),('II',3,720000,10.0,13860),('II',4,1800000,11.2,22500),('II',5,3600000,14.7,85500),('II',6,999999999999::numeric,30.0,720000),
      ('III',1,180000,6.0,0),('III',2,360000,11.2,9360),('III',3,720000,13.5,17640),('III',4,1800000,16.0,35640),('III',5,3600000,21.0,125640),('III',6,999999999999::numeric,33.0,648000),
      ('IV',1,180000,4.5,0),('IV',2,360000,9.0,8100),('IV',3,720000,10.2,12420),('IV',4,1800000,14.0,39780),('IV',5,3600000,22.0,183780),('IV',6,999999999999::numeric,33.0,828000),
      ('V',1,180000,15.5,0),('V',2,360000,18.0,4500),('V',3,720000,19.5,9900),('V',4,1800000,20.5,17100),('V',5,3600000,23.0,62100),('V',6,999999999999::numeric,30.5,540000)
    ) t(anexo,faixa,limite,aliquota,deducao) WHERE anexo=v_anexo AND b<=limite ORDER BY limite LIMIT 1;
    c:=CASE WHEN b>0 THEN GREATEST((b*v_aliq/100-v_ded)/b*100,0) ELSE 0 END;
    v_result:=jsonb_build_object('faturamento12Meses',b,'faixaNumero',v_faixa,'aliquotaNominal',v_aliq,'aliquotaEfetiva',round(c,2),'valorDAS',round(a*c/100,2),'valorDeduzir',v_ded);
  WHEN 'piscofins' THEN
    a:=GREATEST(COALESCE((p->>'faturamento')::numeric,0),0); b:=GREATEST(COALESCE((p->>'creditosEntrada')::numeric,0),0); c:=COALESCE((p#>>'{regimeConfig,aliquotaPis}')::numeric,CASE WHEN p->>'regime'='cumulativo' THEN 0.65 ELSE 1.65 END)/100; d:=COALESCE((p#>>'{regimeConfig,aliquotaCofins}')::numeric,CASE WHEN p->>'regime'='cumulativo' THEN 3 ELSE 7.6 END)/100;
    e:=a*c; f:=a*d; g:=CASE WHEN COALESCE((p#>>'{regimeConfig,permiteCreditoEntrada}')::boolean,p->>'regime'='nao_cumulativo') THEN b*c ELSE 0 END; h:=CASE WHEN COALESCE((p#>>'{regimeConfig,permiteCreditoEntrada}')::boolean,p->>'regime'='nao_cumulativo') THEN b*d ELSE 0 END;
    v_result:=jsonb_build_object('regime',COALESCE(p->>'regime','cumulativo'),'faturamento',a,'creditosApurados',round(g+h,2),'debitoPIS',round(e,2),'debitoCOFINS',round(f,2),'saldoPIS',round(GREATEST(e-g,0),2),'saldoCOFINS',round(GREATEST(f-h,0),2),'totalPagar',round(GREATEST(e-g,0)+GREATEST(f-h,0),2));
  WHEN 'multas' THEN
    a:=GREATEST(COALESCE((p->>'valorOriginal')::numeric,0),0); v_data1:=public.calculo_data_segura(p->>'dataVencimento',CURRENT_DATE); v_data2:=public.calculo_data_segura(p->>'dataPagamento',CURRENT_DATE); v_dias:=GREATEST(v_data2-v_data1,0); b:=LEAST(0.1075/365*v_dias*100,999); c:=LEAST(0.33*v_dias,20);
    v_result:=jsonb_build_object('valorOriginal',a,'diasAtraso',v_dias,'jurosPercentual',round(b,2),'jurosValor',round(a*b/100,2),'multaPercentual',round(c,2),'multaValor',round(a*c/100,2),'totalPagar',round(a+a*b/100+a*c/100,2));
  WHEN 'ferias' THEN
    a:=GREATEST(COALESCE((p->>'salarioBruto')::numeric,0),0)*GREATEST(COALESCE((p->>'diasFerias')::numeric,0),0)/30; b:=a/3; c:=CASE WHEN COALESCE((p->>'abonoPecuniario')::boolean,false) THEN COALESCE((p->>'salarioBruto')::numeric,0)/3 ELSE 0 END; d:=c/3; e:=CASE WHEN COALESCE((p->>'adiantamento13')::boolean,false) THEN COALESCE((p->>'salarioBruto')::numeric,0)/2 ELSE 0 END; f:=public.calculo_inss_progressivo(a+b); g:=public.calculo_irrf(GREATEST(a+b-f-COALESCE((p->>'dependentes')::numeric,0)*189.59,0));
    v_result:=jsonb_build_object('valorFerias',round(a,2),'tercoConstitucional',round(b,2),'abonoPecuniario',round(c,2),'tercoAbono',round(d,2),'adiantamento13',round(e,2),'totalBruto',round(a+b+c+d+e,2),'inss',f,'irrf',g,'totalLiquido',round(a+b+c+d+e-f-g,2),'custoEmpresa',round(a+b+(a+b)*COALESCE((p#>>'{regrasGerais,aliquotaFgts}')::numeric/100,0.08)+c+d+e,2));
  WHEN 'tempo-empresa' THEN
    v_data1:=public.calculo_data_segura(p->>'dataAdmissao',CURRENT_DATE); v_data2:=public.calculo_data_segura(p->>'dataReferencia',CURRENT_DATE); a:=GREATEST(COALESCE((p->>'salarioBase')::numeric,0),0);
    IF v_data2<v_data1 THEN v_result:=jsonb_build_object('anos',0,'meses',0,'dias',0,'provisao13',0,'provisaoFerias',0,'provisaoTerco',0,'fgtsAcumulado',0,'multaFgtsProjetada',0,'custoTotalAcumulado',0); ELSE
      v_anos:=extract(year from age(v_data2,v_data1)); v_meses:=extract(month from age(v_data2,v_data1)); v_dias:=extract(day from age(v_data2,v_data1)); b:=v_anos*12+v_meses+CASE WHEN v_dias>=15 THEN 1 ELSE 0 END; c:=a/12*mod(b,12); d:=a/12*b; e:=d/3; f:=a*COALESCE((p#>>'{regrasGerais,aliquotaFgts}')::numeric/100,0.08)*b; g:=f*COALESCE((p#>>'{regrasGerais,multaFgtsRescisao}')::numeric/100,0.40);
      v_result:=jsonb_build_object('anos',v_anos,'meses',v_meses,'dias',v_dias,'provisao13',round(c,2),'provisaoFerias',round(d,2),'provisaoTerco',round(e,2),'fgtsAcumulado',round(f,2),'multaFgtsProjetada',round(g,2),'custoTotalAcumulado',round(c+d+e+f+g,2)); END IF;
  WHEN 'encargos-trabalhistas' THEN
    a:=GREATEST(COALESCE((p->>'salarioBruto')::numeric,0),0); b:=CASE WHEN p->>'regimeEmpresa'='simples_geral' THEN 0 ELSE a*COALESCE((p#>>'{regrasGerais,aliquotaInssPatronal}')::numeric/100,0.20) END; c:=CASE WHEN p->>'regimeEmpresa'='simples_geral' THEN 0 ELSE a*COALESCE((p->>'rat')::numeric,0)/100*COALESCE((p->>'fap')::numeric,0) END; d:=CASE WHEN p->>'regimeEmpresa'='simples_geral' THEN 0 ELSE a*COALESCE((p->>'terceiros')::numeric,0)/100 END; e:=a*COALESCE((p#>>'{regrasGerais,aliquotaFgts}')::numeric/100,0.08); f:=a*COALESCE((p#>>'{regrasGerais,provisaoFerias13}')::numeric/100,0.1944); g:=b+c+d+e+f;
    v_result:=jsonb_build_object('inssPatronal',round(b,2),'ratAjustado',round(c,2),'terceirosValor',round(d,2),'fgts',round(e,2),'provisaoFerias13',round(f,2),'totalEncargosValor',round(g,2),'totalPercentual',CASE WHEN a>0 THEN round(g/a*100,2) ELSE 0 END);
  WHEN 'simulacao-contratacao' THEN
    a:=GREATEST(COALESCE((p->>'salarioProposto')::numeric,0),0); b:=COALESCE((p->>'valeTransporte')::numeric,0)+COALESCE((p->>'valeAlimentacao')::numeric,0)+COALESCE((p->>'planoSaude')::numeric,0); c:=a*(1+COALESCE((p#>>'{regrasGerais,aliquotaInssPatronal}')::numeric/100,0.20)+0.02+0.058+COALESCE((p#>>'{regrasGerais,aliquotaFgts}')::numeric/100,0.08)+COALESCE((p#>>'{regrasGerais,provisaoFerias13}')::numeric/100,0.1944))+b; d:=a; e:=a+b+30+a*0.0833; f:=public.calculo_inss_progressivo(a); g:=public.calculo_irrf(a-f);
    v_result:=jsonb_build_object('custoCltMensal',round(c,2),'custoCltAnual',round(c*12+a*COALESCE((p#>>'{regrasGerais,aliquotaFgts}')::numeric/100,0.08)*1.33,2),'custoPjMensal',round(d,2),'custoPjAnual',round(d*12,2),'custoEstagioMensal',round(e,2),'custoEstagioAnual',round(e*12,2),'liquidoClt',round(a-f-g+b*0.7,2),'liquidoPj',round(a-a*COALESCE((p#>>'{regrasGerais,aliquotaSimplesPj}')::numeric/100,0.06)-250-public.calculo_inss_progressivo(1412)*0.11,2),'liquidoEstagio',round(a+b*0.7,2));
  WHEN 'comparativo-regime' THEN
    a:=GREATEST(COALESCE((p->>'faturamentoAnual')::numeric,0),0); b:=GREATEST(COALESCE((p->>'comprasInsumosAnual')::numeric,0),0); c:=GREATEST(COALESCE((p->>'folhaAnual')::numeric,0),0); d:=GREATEST(COALESCE((p->>'margemLucro')::numeric,0),0); e:=a*0.11; f:=a*0.1433+c*0.278; g:=GREATEST(0,LEAST(a*d/100,a-b-c-c*0.278))*0.24+GREATEST(0,a*0.0925-b*0.0925)+a*0.03;
    v_result:=jsonb_build_object('simplesNacional',round(e,2),'lucroPresumido',round(f,2),'lucroReal',round(g,2),'melhorOpcao',CASE WHEN e<=f AND e<=g THEN 'Simples Nacional' WHEN f<=g THEN 'Lucro Presumido' ELSE 'Lucro Real' END,'melhorOpcaoDesc','Comparação estimativa baseada nos dados informados. Valide o cenário antes de alterar o regime.','alertas',jsonb_build_array('A análise não substitui a apuração completa da atividade, créditos e despesas.'));
  WHEN 'simulacao-imposto' THEN
    a:=GREATEST(COALESCE((p->>'faturamentoMensal')::numeric,0),0); b:=GREATEST(COALESCE((p->>'aliquotaEstimada')::numeric,0),0); c:=a*b/100;
    IF p->>'tipoAtividade'='comercio' THEN v_result:=jsonb_build_object('impostoTotal',round(c,2),'aliquotaEfetiva',b,'detalheImpostos',jsonb_build_array(jsonb_build_object('nome','ICMS','valor',round(c*.60,2),'percentual',round(b*.60,2)),jsonb_build_object('nome','PIS','valor',round(c*.08,2),'percentual',round(b*.08,2)),jsonb_build_object('nome','COFINS','valor',round(c*.22,2),'percentual',round(b*.22,2)),jsonb_build_object('nome','IRPJ','valor',round(c*.06,2),'percentual',round(b*.06,2)),jsonb_build_object('nome','CSLL','valor',round(c*.04,2),'percentual',round(b*.04,2))));
    ELSIF p->>'tipoAtividade'='industria' THEN v_result:=jsonb_build_object('impostoTotal',round(c,2),'aliquotaEfetiva',b,'detalheImpostos',jsonb_build_array(jsonb_build_object('nome','IPI','valor',round(c*.20,2),'percentual',round(b*.20,2)),jsonb_build_object('nome','ICMS','valor',round(c*.45,2),'percentual',round(b*.45,2)),jsonb_build_object('nome','PIS','valor',round(c*.08,2),'percentual',round(b*.08,2)),jsonb_build_object('nome','COFINS','valor',round(c*.17,2),'percentual',round(b*.17,2)),jsonb_build_object('nome','IRPJ','valor',round(c*.06,2),'percentual',round(b*.06,2)),jsonb_build_object('nome','CSLL','valor',round(c*.04,2),'percentual',round(b*.04,2))));
    ELSE v_result:=jsonb_build_object('impostoTotal',round(c,2),'aliquotaEfetiva',b,'detalheImpostos',jsonb_build_array(jsonb_build_object('nome','PIS','valor',round(c*.12,2),'percentual',round(b*.12,2)),jsonb_build_object('nome','COFINS','valor',round(c*.45,2),'percentual',round(b*.45,2)),jsonb_build_object('nome','ISS','valor',round(c*.23,2),'percentual',round(b*.23,2)),jsonb_build_object('nome','IRPJ','valor',round(c*.11,2),'percentual',round(b*.11,2)),jsonb_build_object('nome','CSLL','valor',round(c*.09,2),'percentual',round(b*.09,2)))); END IF;
  WHEN 'simulacao-custos' THEN
    a:=GREATEST(COALESCE((p->>'custosFixos')::numeric,0),0); b:=100-GREATEST(COALESCE((p->>'custosVariaveisPercentual')::numeric,0),0); c:=GREATEST(COALESCE((p->>'markupDesejado')::numeric,0),0); d:=CASE WHEN b>0 THEN a/(b/100) ELSE 0 END; e:=CASE WHEN b-c>0 THEN a/((b-c)/100) ELSE 0 END;
    v_result:=jsonb_build_object('pontoEquilibrio',round(d,2),'faturamentoAlvo',round(e,2),'margemContribuicaoPercentual',round(b,2),'lucroEstimado',round(GREATEST(e*b/100-a,0),2));
  WHEN 'rescisao' THEN
    a:=GREATEST(COALESCE((p->>'salario')::numeric,0),0); v_data1:=public.calculo_data_segura(p->>'dataAdmissao',CURRENT_DATE); v_data2:=public.calculo_data_segura(p->>'dataDemissao',CURRENT_DATE); v_meses:=GREATEST((extract(year from age(v_data2,v_data1))*12+extract(month from age(v_data2,v_data1)))::int,0); v_anos:=floor(v_meses/12); b:=a/30*extract(day from v_data2); c:=a/12*(extract(month from v_data2)+1); d:=a/12*LEAST(mod(v_meses,12),11); e:=d/3; f:=CASE WHEN COALESCE((p->>'feriasVencidasPeriodos')::int,0)>0 THEN a*COALESCE((p->>'feriasVencidasPeriodos')::int,0)*CASE WHEN COALESCE((p->>'feriasVencidasEmDobro')::boolean,false) THEN 2 ELSE 1 END ELSE 0 END; g:=CASE WHEN COALESCE((p#>>'{tipoParametro,geraAvisoPrevio}')::boolean,p->>'tipo'='sem_justa_causa') AND p->>'avisoPrevioModo'='indenizado' THEN a/30*LEAST(30+v_anos*3,90) ELSE 0 END; h:=CASE WHEN COALESCE((p#>>'{tipoParametro,geraMultaFgts}')::boolean,p->>'tipo'='sem_justa_causa') THEN COALESCE((p->>'saldoFGTS')::numeric,0)*COALESCE((p#>>'{regrasGerais,multaFgtsRescisao}')::numeric/100,0.40) ELSE 0 END;
    v_result:=jsonb_build_object('tipo',p->>'tipo','salarioBaseCalculo',a,'adicionalTempoServico',0,'saldoSalario',round(b,2),'decimoTerceiroProporcional',round(c,2),'feriasProporcionais',round(d,2),'adicionalFerias',round(e,2),'feriasVencidas',round(f,2),'adicionalFeriasVencidas',round(f/3,2),'avisoPrevio',round(g,2),'avisoPrevioDesconto',CASE WHEN p->>'avisoPrevioModo'='descontado' THEN a ELSE 0 END,'multaFGTS',round(h,2),'totalBruto',round(b+c+d+e+f+f/3+g,2),'inssRescisao',round(LEAST((b+c+g)*.14,908.86),2),'irrfRescisao',public.calculo_irrf(GREATEST(b+c+g-LEAST((b+c+g)*.14,908.86),0)),'totalLiquido',round(b+c+d+e+f+f/3+g+h-CASE WHEN p->>'avisoPrevioModo'='descontado' THEN a ELSE 0 END-LEAST((b+c+g)*.14,908.86)-public.calculo_irrf(GREATEST(b+c+g-LEAST((b+c+g)*.14,908.86),0)),2));
  WHEN 'folha' THEN
    a:=GREATEST(COALESCE((p->>'salarioBruto')::numeric,0),0); b:=COALESCE((SELECT sum(COALESCE((x->>'quantidade')::numeric,0)*COALESCE((x->>'valorHora')::numeric,0)*COALESCE((x->>'multiplicador')::numeric,0)) FROM jsonb_array_elements(COALESCE(p->'horasExtras','[]'::jsonb)) x),0); c:=a*COALESCE((p->>'adicionalNoturnoPercentual')::numeric,0)/100; d:=a*COALESCE((p->>'insalubridadePercentual')::numeric,0)/100; e:=GREATEST(COALESCE((p->>'faltasDias')::numeric,0),0)*a/30; f:=GREATEST(a+COALESCE((p->>'adicionalPericulosidade')::numeric,0)+b+c+d+COALESCE((p->>'adicionalManualValor')::numeric,0)-e,0); g:=CASE WHEN p->>'tipoFuncionario'='prolabore' THEN LEAST(f*.11,908.86) WHEN p->>'tipoFuncionario'='estagiario' THEN 0 ELSE public.calculo_inss_progressivo(f) END; h:=public.calculo_irrf(GREATEST(f-g-COALESCE((p->>'dependentes')::numeric,0)*189.59-COALESCE((p->>'pensaoAlimenticia')::numeric,0),0));
    v_result:=jsonb_build_object('salarioBruto',round(f,2),'totalVencimentos',round(f,2),'descontosFuncionario',round(g+h+CASE WHEN COALESCE((p->>'valeTransporteAtivo')::boolean,false) THEN LEAST(COALESCE((p->>'valorValeTransporte')::numeric,0),f*.06) ELSE 0 END+COALESCE((p->>'valeAlimentacaoDesconto')::numeric,0)+COALESCE((p->>'planoSaudeDesconto')::numeric,0)+COALESCE((p->>'odontologicoDesconto')::numeric,0)+COALESCE((p->>'pensaoAlimenticia')::numeric,0)+COALESCE((p->>'descontoManualValor')::numeric,0),2),'encargosEmpresa',round(f*.3498+COALESCE((p->>'valeAlimentacaoEmpresa')::numeric,0)+COALESCE((p->>'planoSaudeEmpresa')::numeric,0)+COALESCE((p->>'odontologicoEmpresa')::numeric,0),2),'inss',g,'baseIRRF',round(GREATEST(f-g-COALESCE((p->>'dependentes')::numeric,0)*189.59,0),2),'irrf',h,'fgts',round(CASE WHEN p->>'tipoFuncionario' IN ('estagiario','prolabore','diretor') THEN 0 ELSE f*.08 END,2),'encargosPrevidenciarios',round(f*.2698,2),'beneficiosEmpresa',round(COALESCE((p->>'valeAlimentacaoEmpresa')::numeric,0)+COALESCE((p->>'planoSaudeEmpresa')::numeric,0)+COALESCE((p->>'odontologicoEmpresa')::numeric,0),2),'valeTransporteDesconto',CASE WHEN COALESCE((p->>'valeTransporteAtivo')::boolean,false) THEN round(LEAST(COALESCE((p->>'valorValeTransporte')::numeric,0),f*.06),2) ELSE 0 END,'valeAlimentacaoDesconto',COALESCE((p->>'valeAlimentacaoDesconto')::numeric,0),'planoSaudeDesconto',COALESCE((p->>'planoSaudeDesconto')::numeric,0),'odontologicoDesconto',COALESCE((p->>'odontologicoDesconto')::numeric,0),'pensaoAlimenticia',COALESCE((p->>'pensaoAlimenticia')::numeric,0),'faltas',round(e,2),'descontoManual',COALESCE((p->>'descontoManualValor')::numeric,0),'adicionalManual',COALESCE((p->>'adicionalManualValor')::numeric,0),'horasExtrasTotal',round(b,2),'adicionalNoturno',round(c,2),'insalubridade',round(d,2),'adicionalTempoServico',0,'salarioFamilia',0,'salarioLiquido',round(f-g-h-CASE WHEN COALESCE((p->>'valeTransporteAtivo')::boolean,false) THEN LEAST(COALESCE((p->>'valorValeTransporte')::numeric,0),f*.06) ELSE 0 END-COALESCE((p->>'valeAlimentacaoDesconto')::numeric,0)-COALESCE((p->>'planoSaudeDesconto')::numeric,0)-COALESCE((p->>'odontologicoDesconto')::numeric,0)-COALESCE((p->>'pensaoAlimenticia')::numeric,0)-COALESCE((p->>'descontoManualValor')::numeric,0),2),'custoEmpregador',round(f+f*.3498,2),'observacoes',jsonb_build_array('Resultado estimativo. Confira os parâmetros vigentes antes de concluir a folha.'),'detalhamento',jsonb_build_object('tipoFuncionarioLabel',upper(COALESCE(p->>'tipoFuncionario','CLT')),'competenciaLabel',p->>'competencia','regiaoLabel',p->>'regiao','fgtsPercentual',8,'encargosPercentual',26.98,'aliquotaIrrf',0,'faixaIrrfLabel','Conforme base calculada','atestadosAbonados',COALESCE((p->>'atestadosDias')::numeric,0)));
  ELSE RAISE EXCEPTION 'Tipo de simulação não suportado: %', p_tipo;
  END CASE;
  RETURN v_result;
END; $$;

CREATE OR REPLACE FUNCTION public.calcular_simulacoes_contabeis(p_solicitacoes jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_empresa_id uuid := public.current_empresa_id(); v_chave text; v_parametros jsonb; v_result jsonb := '{}'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa vinculada.'; END IF;
  FOR v_chave,v_parametros IN SELECT * FROM jsonb_each(COALESCE(p_solicitacoes,'{}'::jsonb)) LOOP v_result:=v_result||jsonb_build_object(v_chave,public.calcular_simulacao_contabil(v_chave,v_parametros)); END LOOP;
  RETURN v_result;
END; $$;

REVOKE ALL ON FUNCTION public.calculo_inss_progressivo(numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculo_irrf(numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculo_data_segura(text,date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calcular_simulacao_contabil(text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calcular_simulacoes_contabeis(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calcular_simulacoes_contabeis(jsonb) TO authenticated;
