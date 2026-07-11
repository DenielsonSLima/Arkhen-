-- Ajustes de seguranca/performance para RPCs e FKs criados na migracao financeiro/faturamento.

CREATE INDEX IF NOT EXISTS idx_financeiro_cobrancas_cliente
  ON public.financeiro_cobrancas(cliente_empresa_id);

CREATE INDEX IF NOT EXISTS idx_financeiro_cobrancas_contrato
  ON public.financeiro_cobrancas(contrato_id);

CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_cliente
  ON public.financeiro_lancamentos(cliente_empresa_id);

REVOKE EXECUTE ON FUNCTION public.financeiro_set_updated_at() FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.cancelar_boleto_financeiro(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancelar_cobranca_financeira(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.confirmar_recebimento_financeiro(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.emitir_nfse_asaas(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.gerar_cobranca_manual_financeira(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_contas_bancarias_resumo() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_faturamento_dashboard(date, date, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_financeiro_dashboard(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.salvar_conta_bancaria(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.salvar_contrato_financeiro(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_contador_responsavel(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.cancelar_boleto_financeiro(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_cobranca_financeira(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_recebimento_financeiro(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.emitir_nfse_asaas(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerar_cobranca_manual_financeira(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contas_bancarias_resumo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_faturamento_dashboard(date, date, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financeiro_dashboard(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_conta_bancaria(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_contrato_financeiro(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_contador_responsavel(uuid) TO authenticated;
