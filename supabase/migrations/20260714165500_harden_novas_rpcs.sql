-- Revoga concessões automáticas do PostgREST; somente usuários autenticados
-- podem executar as RPCs gerenciais e de cálculo.

REVOKE ALL ON FUNCTION public.get_financeiro_dashboard(integer) FROM anon;
REVOKE ALL ON FUNCTION public.get_faturamento_dashboard(date,date,uuid,text) FROM anon;

REVOKE ALL ON FUNCTION public.get_relatorio_faturamento_json(uuid,date,date) FROM anon;
REVOKE ALL ON FUNCTION public.get_relatorio_conformidade_json(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_relatorio_pessoal_json(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.calcular_comparativo_regimes_json(numeric,numeric) FROM anon;

REVOKE ALL ON FUNCTION public.get_planejamento_clientes() FROM anon;
REVOKE ALL ON FUNCTION public.calcular_planejamento_tributario(numeric,text) FROM anon;
REVOKE ALL ON FUNCTION public.consultar_enquadramento_simples_json(numeric,text) FROM anon;
REVOKE ALL ON FUNCTION public.get_planejamento_historico() FROM anon;
REVOKE ALL ON FUNCTION public.gerar_diagnostico_tributario_json(jsonb,jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.salvar_planejamento_tributario(uuid,text) FROM anon;

REVOKE ALL ON FUNCTION public.calculo_inss_progressivo(numeric) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.calculo_irrf(numeric) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.calculo_data_segura(text,date) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.calcular_simulacao_contabil(text,jsonb) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.calcular_simulacoes_contabeis(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.calcular_simulacoes_contabeis(jsonb) TO authenticated;

REVOKE ALL ON TABLE public.planejamento_tributario_historico FROM anon, authenticated;
