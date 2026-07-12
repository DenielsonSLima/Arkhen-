-- O frontend deve consumir apenas RPCs sanitizadas da integracao fiscal.
-- As tabelas guardam referencias de segredo e logs operacionais, entao ficam sem acesso direto.

DROP POLICY IF EXISTS configuracoes_integracao_fiscal_policy ON public.configuracoes_integracao_fiscal;
DROP POLICY IF EXISTS configuracoes_integracao_fiscal_logs_select_policy ON public.configuracoes_integracao_fiscal_logs;
DROP POLICY IF EXISTS configuracoes_integracao_fiscal_logs_insert_policy ON public.configuracoes_integracao_fiscal_logs;

ALTER TABLE public.configuracoes_integracao_fiscal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_integracao_fiscal_logs ENABLE ROW LEVEL SECURITY;
