-- Migração para criação do Módulo Financeiro

-- 1. Tabela de Configurações de Faturamento de Clientes (Contratos)
CREATE TABLE IF NOT EXISTS public.financeiro_configuracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL, -- Identificador da empresa logada (escritório contábil/tenant)
    cliente_empresa_id UUID NOT NULL, -- Empresa cliente que está sendo faturada
    valor_mensal NUMERIC(10, 2) NOT NULL CHECK (valor_mensal >= 0),
    dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 28),
    emissao_automatica_nfse BOOLEAN DEFAULT FALSE NOT NULL,
    ativo BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.financeiro_configuracoes ENABLE ROW LEVEL SECURITY;

-- 2. Tabela de Cobranças (Histórico / Contas a Receber)
CREATE TABLE IF NOT EXISTS public.financeiro_cobrancas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL, -- Identificador da empresa logada (escritório contábil/tenant)
    cliente_empresa_id UUID NOT NULL, -- Empresa cliente vinculada
    valor NUMERIC(10, 2) NOT NULL CHECK (valor >= 0),
    data_vencimento DATE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('Pendente', 'Pago', 'Vencido', 'Cancelado')),
    asaas_cobranca_id VARCHAR(100),
    asaas_nfse_id VARCHAR(100),
    asaas_boleto_url VARCHAR(255),
    data_pagamento TIMESTAMPTZ,
    data_cancelamento TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.financeiro_cobrancas ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS de Segurança baseadas no perfil do usuário
-- Assume que existe uma tabela 'perfis' que relaciona 'user_id' do 'auth.uid()' com a 'empresa_id' do usuário logado.

CREATE POLICY financeiro_configuracoes_policy ON public.financeiro_configuracoes
    FOR ALL
    TO authenticated
    USING (empresa_id = (SELECT empresa_id FROM public.perfis WHERE user_id = auth.uid()));

CREATE POLICY financeiro_cobrancas_policy ON public.financeiro_cobrancas
    FOR ALL
    TO authenticated
    USING (empresa_id = (SELECT empresa_id FROM public.perfis WHERE user_id = auth.uid()));

-- 4. Função RPC: Cancelar Cobrança Financeira
CREATE OR REPLACE FUNCTION public.cancelar_cobranca_financeira(
    p_cobranca_id UUID,
    p_empresa_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_rows_updated INTEGER;
BEGIN
    -- Validação: Garantir que a cobrança pertence à empresa/tenant logado
    UPDATE public.financeiro_cobrancas
    SET 
        status = 'Cancelado',
        data_cancelamento = now(),
        updated_at = now()
    WHERE id = p_cobranca_id 
      AND empresa_id = p_empresa_id
      AND status != 'Pago';
      
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    
    IF v_rows_updated > 0 THEN
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Função RPC: Cancelar Boleto Financeiro (Mantém a cobrança ativa mas cancela a emissão do boleto/status de envio no Asaas)
CREATE OR REPLACE FUNCTION public.cancelar_boleto_financeiro(
    p_cobranca_id UUID,
    p_empresa_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_rows_updated INTEGER;
BEGIN
    UPDATE public.financeiro_cobrancas
    SET 
        asaas_boleto_url = NULL,
        updated_at = now()
    WHERE id = p_cobranca_id 
      AND empresa_id = p_empresa_id
      AND status = 'Pendente';
      
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    
    IF v_rows_updated > 0 THEN
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Função RPC: Emitir NFS-e Asaas (Simulação do gatilho de emissão manual)
CREATE OR REPLACE FUNCTION public.emitir_nfse_asaas(
    p_cobranca_id UUID,
    p_empresa_id UUID
)
RETURNS VARCHAR(100) AS $$
DECLARE
    v_nfse_id VARCHAR(100);
    v_status VARCHAR(20);
BEGIN
    -- Verifica se a cobrança existe e é válida para faturar
    SELECT status INTO v_status 
    FROM public.financeiro_cobrancas 
    WHERE id = p_cobranca_id AND empresa_id = p_empresa_id;
    
    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Cobrança não encontrada ou acesso negado.';
    END IF;

    IF v_status = 'Cancelado' THEN
        RAISE EXCEPTION 'Não é possível emitir nota fiscal para uma cobrança cancelada.';
    END IF;

    -- Simulação de ID gerado pelo Asaas
    v_nfse_id := 'nfse_' || encode(digest(p_cobranca_id::text || now()::text, 'sha256'), 'hex');
    
    UPDATE public.financeiro_cobrancas
    SET 
        asaas_nfse_id = v_nfse_id,
        updated_at = now()
    WHERE id = p_cobranca_id 
      AND empresa_id = p_empresa_id;

    RETURN v_nfse_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
