-- Migração para criação do Módulo de Relatórios

-- 1. RPC: Relatório de Faturamento e Inadimplência
CREATE OR REPLACE FUNCTION public.get_relatorio_faturamento(
    p_empresa_id UUID,
    p_data_inicio DATE,
    p_data_fim DATE
)
RETURNS TABLE (
    mes TEXT,
    valor_faturado NUMERIC(10,2),
    valor_recebido NUMERIC(10,2),
    valor_pendente NUMERIC(10,2),
    taxa_inadimplencia NUMERIC(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        to_char(c.data_vencimento, 'MM/YYYY') AS mes,
        COALESCE(SUM(c.valor), 0) AS valor_faturado,
        COALESCE(SUM(CASE WHEN c.status = 'Pago' THEN c.valor ELSE 0 END), 0) AS valor_recebido,
        COALESCE(SUM(CASE WHEN c.status IN ('Pendente', 'Vencido') THEN c.valor ELSE 0 END), 0) AS valor_pendente,
        CASE 
            WHEN SUM(CASE WHEN c.status IN ('Pago', 'Vencido') THEN c.valor ELSE 0 END) > 0 
            THEN (SUM(CASE WHEN c.status = 'Vencido' THEN c.valor ELSE 0 END) / SUM(CASE WHEN c.status IN ('Pago', 'Vencido') THEN c.valor ELSE 0 END)) * 100
            ELSE 0 
        END::NUMERIC(5,2) AS taxa_inadimplencia
    FROM public.financeiro_cobrancas c
    WHERE c.empresa_id = p_empresa_id
      AND c.data_vencimento BETWEEN p_data_inicio AND p_data_fim
      AND c.status != 'Cancelado'
    GROUP BY to_char(c.data_vencimento, 'MM/YYYY'), date_trunc('month', c.data_vencimento)
    ORDER BY date_trunc('month', c.data_vencimento) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RPC: Relatório de Conformidade de Obrigações (Atividades)
CREATE OR REPLACE FUNCTION public.get_relatorio_conformidade(
    p_empresa_id UUID
)
RETURNS TABLE (
    total_obrigacoes BIGINT,
    concluidas BIGINT,
    pendentes BIGINT,
    atrasadas BIGINT,
    taxa_conformidade NUMERIC(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(id)::BIGINT AS total_obrigacoes,
        SUM(CASE WHEN status = 'Concluída' THEN 1 ELSE 0 END)::BIGINT AS concluidas,
        SUM(CASE WHEN status = 'Pendente' AND data_vencimento >= CURRENT_DATE THEN 1 ELSE 0 END)::BIGINT AS pendentes,
        SUM(CASE WHEN status = 'Pendente' AND data_vencimento < CURRENT_DATE THEN 1 ELSE 0 END)::BIGINT AS atrasadas,
        CASE 
            WHEN COUNT(id) > 0 
            THEN (SUM(CASE WHEN status = 'Concluída' THEN 1 ELSE 0 END)::NUMERIC / COUNT(id)::NUMERIC) * 100
            ELSE 0 
        END::NUMERIC(5,2) AS taxa_conformidade
    FROM public.atividades
    WHERE empresa_id = p_empresa_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC: Relatório de Custos e Quadro de Pessoal
CREATE OR REPLACE FUNCTION public.get_relatorio_custo_pessoal(
    p_empresa_id UUID
)
RETURNS TABLE (
    cliente_nome VARCHAR(150),
    total_funcionarios BIGINT,
    funcionarios_ativos BIGINT,
    custo_folha NUMERIC(12,2),
    media_salarial NUMERIC(10,2),
    documentos_pendentes BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.nome AS cliente_nome,
        COUNT(f.id)::BIGINT AS total_funcionarios,
        SUM(CASE WHEN f.status = 'Ativo' THEN 1 ELSE 0 END)::BIGINT AS funcionarios_ativos,
        COALESCE(SUM(CASE WHEN f.status = 'Ativo' THEN f.salario ELSE 0 END), 0)::NUMERIC(12,2) AS custo_folha,
        COALESCE(AVG(CASE WHEN f.status = 'Ativo' THEN f.salario ELSE NULL END), 0)::NUMERIC(10,2) AS media_salarial,
        COUNT(CASE WHEN d.status = 'Pendente' THEN 1 ELSE NULL END)::BIGINT AS documentos_pendentes
    FROM public.empresas e
    LEFT JOIN public.funcionarios f ON f.empresa_cliente_id = e.id
    LEFT JOIN public.documentos_funcionarios d ON d.funcionario_id = f.id
    WHERE e.parent_empresa_id = p_empresa_id -- Assume relacionamento hierárquico de tenant/clientes
    GROUP BY e.id, e.nome
    ORDER BY custo_folha DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC: Simulação/Comparativo de Regimes Tributários
-- Realiza o cálculo simulado de imposto sobre faturamento anual presumido
CREATE OR REPLACE FUNCTION public.calcular_comparativo_regimes(
    p_faturamento_anual NUMERIC(12,2),
    p_custo_folha_anual NUMERIC(12,2),
    p_cnae_codigo VARCHAR(10)
)
RETURNS TABLE (
    regime TEXT,
    aliquota_efetiva NUMERIC(5,2),
    imposto_total NUMERIC(12,2),
    custo_previdenciario NUMERIC(12,2),
    custo_total NUMERIC(12,2),
    vantagem_relativa TEXT
) AS $$
DECLARE
    v_imposto_simples NUMERIC(12,2) := 0;
    v_imposto_presumido NUMERIC(12,2) := 0;
    v_imposto_real NUMERIC(12,2) := 0;
    
    v_cpp_simples NUMERIC(12,2) := 0;
    v_cpp_presumido NUMERIC(12,2) := 0;
    v_cpp_real NUMERIC(12,2) := 0;
    
    v_menor_custo NUMERIC(12,2);
BEGIN
    -- 4.1 Simples Nacional (Estimado com Alíquota Média de Anexo III - 10%)
    v_imposto_simples := p_faturamento_anual * 0.10;
    v_cpp_simples := 0; -- Já incluso na guia unificada do DAS
    
    -- 4.2 Lucro Presumido (Presunção de 32% sobre Serviços, IRPJ/CSLL=4.8%, PIS/COFINS=3.65%, ISS=5% -> total ~13.45%)
    v_imposto_presumido := p_faturamento_anual * 0.1345;
    v_cpp_presumido := p_custo_folha_anual * 0.20; -- CPP de 20% patronal
    
    -- 4.3 Lucro Real (Alíquota real aproximada baseada em margem de lucro de 15%. IRPJ/CSLL=34% de 15% faturamento = 5.1%, PIS/COFINS=9.25%, ISS=5% -> total ~19.35%)
    v_imposto_real := p_faturamento_anual * 0.1935;
    v_cpp_real := p_custo_folha_anual * 0.20; -- CPP de 20% patronal

    -- Determina o melhor regime tributário
    v_menor_custo := LEAST(
        v_imposto_simples + v_cpp_simples,
        v_imposto_presumido + v_cpp_presumido,
        v_imposto_real + v_cpp_real
    );

    -- Retorna os dados agregados para comparação
    RETURN NEXT ROW(
        'Simples Nacional',
        10.00::NUMERIC(5,2),
        v_imposto_simples,
        v_cpp_simples,
        v_imposto_simples + v_cpp_simples,
        CASE WHEN (v_imposto_simples + v_cpp_simples) = v_menor_custo THEN 'Mais Recomendado' ELSE 'Menos Recomendado' END
    );
    
    RETURN NEXT ROW(
        'Lucro Presumido',
        (13.45 + (v_cpp_presumido / p_faturamento_anual * 100))::NUMERIC(5,2),
        v_imposto_presumido,
        v_cpp_presumido,
        v_imposto_presumido + v_cpp_presumido,
        CASE WHEN (v_imposto_presumido + v_cpp_presumido) = v_menor_custo THEN 'Mais Recomendado' ELSE 'Menos Recomendado' END
    );
    
    RETURN NEXT ROW(
        'Lucro Real',
        (19.35 + (v_cpp_real / p_faturamento_anual * 100))::NUMERIC(5,2),
        v_imposto_real,
        v_cpp_real,
        v_imposto_real + v_cpp_real,
        CASE WHEN (v_imposto_real + v_cpp_real) = v_menor_custo THEN 'Mais Recomendado' ELSE 'Menos Recomendado' END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
