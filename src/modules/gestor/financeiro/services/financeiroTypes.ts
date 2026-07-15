export interface ContratoFinanceiro {
  id: string;
  empresaId: string;
  clienteEmpresaId: string;
  descricaoServico?: string;
  valorMensal: number;
  diaVencimento: number;
  emissaoAutomaticaNfse: boolean;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CobrancaFinanceira {
  id: string;
  publicToken?: string;
  empresaId: string;
  contratoId?: string;
  clienteEmpresaId: string;
  descricao: string;
  categoria: string;
  valor: number;
  dataVencimento: string;
  status: 'Pendente' | 'Pago' | 'Vencido' | 'Cancelado';
  meioPagamento: 'Pix' | 'Boleto' | 'Ambos';
  asaasCobrancaId?: string;
  asaasNfseId?: string;
  asaasBoletoUrl?: string;
  asaasInvoiceUrl?: string;
  asaasBankSlipUrl?: string;
  asaasBillingType?: string;
  asaasStatus?: string;
  asaasAmbiente?: string;
  asaasPayload?: Record<string, unknown>;
  bankProvider?: 'asaas' | 'inter';
  bankExternalId?: string;
  pixCopyPaste?: string;
  dataPagamento?: string;
  dataCancelamento?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LancamentoFinanceiro {
  id: string;
  empresaId: string;
  contaBancariaId?: string;
  clienteEmpresaId?: string;
  tipo: 'receita' | 'despesa' | 'transferencia_entrada' | 'transferencia_saida';
  origem: 'cobranca' | 'conta_pagar' | 'outro_credito' | 'outro_debito' | 'transferencia' | 'manual';
  descricao: string;
  categoria: string;
  valor: number;
  dataCompetencia: string;
  dataPagamento?: string;
  status: 'Pendente' | 'Pago' | 'Cancelado';
  referenciaId?: string;
  metadados: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceiroChartPoint {
  name: string;
  receita: number;
  despesas: number;
  lucro: number;
}

export interface FinanceiroContaSaldo {
  id: string;
  banco: string;
  agencia: string;
  conta: string;
  saldo: number;
}

export interface FinanceiroBreakdown {
  id: string | null;
  nome: string;
  valor: number;
  percentual: number;
}

export interface DashboardStats {
  totalFaturado: number;
  totalRecebido: number;
  totalPendente: number;
  taxaInadimplencia: number;
  patrimonioLiquido: number;
  saldoDisponivel: number;
  contasReceber: number;
  contasPagar: number;
  lucroMes: number;
  receitasRecebidas: number;
  despesasPagas: number;
  desempenho: FinanceiroChartPoint[];
  contas: FinanceiroContaSaldo[];
  receitasPorParceiro: FinanceiroBreakdown[];
  despesasPorCategoria: FinanceiroBreakdown[];
}
