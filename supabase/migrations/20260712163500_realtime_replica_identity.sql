-- Set replica identity to FULL for financeiro tables to enable Supabase Realtime updates on RLS-protected tables.

ALTER TABLE public.financeiro_configuracoes REPLICA IDENTITY FULL;
ALTER TABLE public.financeiro_cobrancas REPLICA IDENTITY FULL;
ALTER TABLE public.financeiro_lancamentos REPLICA IDENTITY FULL;
ALTER TABLE public.configuracoes_contas_bancarias REPLICA IDENTITY FULL;
