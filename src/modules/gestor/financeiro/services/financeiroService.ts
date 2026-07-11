import { supabase } from '../../../../lib/supabase';

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

interface ContratoRow {
  id: string;
  empresa_id: string;
  cliente_empresa_id: string | null;
  descricao_servico: string;
  valor_mensal: number | string;
  dia_vencimento: number;
  emissao_automatica_nfse: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

interface CobrancaRow {
  id: string;
  empresa_id: string;
  contrato_id: string | null;
  cliente_empresa_id: string | null;
  descricao: string;
  categoria: string;
  valor: number | string;
  data_vencimento: string;
  status: CobrancaFinanceira['status'];
  meio_pagamento: CobrancaFinanceira['meioPagamento'];
  asaas_cobranca_id: string | null;
  asaas_nfse_id: string | null;
  asaas_boleto_url: string | null;
  data_pagamento: string | null;
  data_cancelamento: string | null;
  created_at: string;
  updated_at: string;
}

interface LancamentoRow {
  id: string;
  empresa_id: string;
  conta_bancaria_id: string | null;
  cliente_empresa_id: string | null;
  tipo: LancamentoFinanceiro['tipo'];
  origem: LancamentoFinanceiro['origem'];
  descricao: string;
  categoria: string;
  valor: number | string;
  data_competencia: string;
  data_pagamento: string | null;
  status: LancamentoFinanceiro['status'];
  referencia_id: string | null;
  metadados: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

type ContratoSaveInput = Omit<ContratoFinanceiro, 'id' | 'empresaId' | 'createdAt' | 'updatedAt'> & { id?: string; gerarCobranca?: boolean };
type LancamentoSaveInput = Pick<
  LancamentoFinanceiro,
  'tipo' | 'origem' | 'descricao' | 'categoria' | 'valor' | 'dataCompetencia' | 'status'
> & Partial<Pick<LancamentoFinanceiro, 'contaBancariaId' | 'clienteEmpresaId' | 'dataPagamento' | 'referenciaId' | 'metadados'>>;

const emptyStats: DashboardStats = {
  totalFaturado: 0,
  totalRecebido: 0,
  totalPendente: 0,
  taxaInadimplencia: 0,
  patrimonioLiquido: 0,
  saldoDisponivel: 0,
  contasReceber: 0,
  contasPagar: 0,
  lucroMes: 0,
  receitasRecebidas: 0,
  despesasPagas: 0,
  desempenho: [],
  contas: [],
  receitasPorParceiro: [],
  despesasPorCategoria: [],
};

const fromContratoRow = (row: ContratoRow): ContratoFinanceiro => ({
  id: row.id,
  empresaId: row.empresa_id,
  clienteEmpresaId: row.cliente_empresa_id || '',
  descricaoServico: row.descricao_servico,
  valorMensal: Number(row.valor_mensal || 0),
  diaVencimento: row.dia_vencimento,
  emissaoAutomaticaNfse: row.emissao_automatica_nfse,
  ativo: row.ativo,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const fromCobrancaRow = (row: CobrancaRow): CobrancaFinanceira => ({
  id: row.id,
  empresaId: row.empresa_id,
  contratoId: row.contrato_id || undefined,
  clienteEmpresaId: row.cliente_empresa_id || '',
  descricao: row.descricao,
  categoria: row.categoria,
  valor: Number(row.valor || 0),
  dataVencimento: row.data_vencimento,
  status: row.status,
  meioPagamento: row.meio_pagamento,
  asaasCobrancaId: row.asaas_cobranca_id || undefined,
  asaasNfseId: row.asaas_nfse_id || undefined,
  asaasBoletoUrl: row.asaas_boleto_url || undefined,
  dataPagamento: row.data_pagamento || undefined,
  dataCancelamento: row.data_cancelamento || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const fromLancamentoRow = (row: LancamentoRow): LancamentoFinanceiro => ({
  id: row.id,
  empresaId: row.empresa_id,
  contaBancariaId: row.conta_bancaria_id || undefined,
  clienteEmpresaId: row.cliente_empresa_id || undefined,
  tipo: row.tipo,
  origem: row.origem,
  descricao: row.descricao,
  categoria: row.categoria,
  valor: Number(row.valor || 0),
  dataCompetencia: row.data_competencia,
  dataPagamento: row.data_pagamento || undefined,
  status: row.status,
  referenciaId: row.referencia_id || undefined,
  metadados: row.metadados || {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toContratoPayload = (contrato: ContratoSaveInput) => ({
  id: contrato.id || '',
  cliente_empresa_id: contrato.clienteEmpresaId || '',
  descricao_servico: contrato.descricaoServico || 'Honorários contábeis',
  valor_mensal: contrato.valorMensal,
  dia_vencimento: contrato.diaVencimento,
  emissao_automatica_nfse: contrato.emissaoAutomaticaNfse,
  ativo: contrato.ativo,
  gerar_cobranca: contrato.gerarCobranca ?? true,
});

const toLancamentoPayload = (lancamento: LancamentoSaveInput) => ({
  conta_bancaria_id: lancamento.contaBancariaId || '',
  cliente_empresa_id: lancamento.clienteEmpresaId || '',
  tipo: lancamento.tipo,
  origem: lancamento.origem,
  descricao: lancamento.descricao,
  categoria: lancamento.categoria,
  valor: lancamento.valor,
  data_competencia: lancamento.dataCompetencia,
  data_pagamento: lancamento.dataPagamento || '',
  status: lancamento.status,
  referencia_id: lancamento.referenciaId || '',
  metadados: lancamento.metadados || {},
});

const normalizeStats = (data: Partial<DashboardStats> | null): DashboardStats => ({
  ...emptyStats,
  ...(data || {}),
  totalFaturado: Number(data?.totalFaturado || 0),
  totalRecebido: Number(data?.totalRecebido || 0),
  totalPendente: Number(data?.totalPendente || 0),
  taxaInadimplencia: Number(data?.taxaInadimplencia || 0),
  patrimonioLiquido: Number(data?.patrimonioLiquido || 0),
  saldoDisponivel: Number(data?.saldoDisponivel || 0),
  contasReceber: Number(data?.contasReceber || 0),
  contasPagar: Number(data?.contasPagar || 0),
  lucroMes: Number(data?.lucroMes || 0),
  receitasRecebidas: Number(data?.receitasRecebidas || 0),
  despesasPagas: Number(data?.despesasPagas || 0),
  desempenho: data?.desempenho || [],
  contas: data?.contas || [],
  receitasPorParceiro: data?.receitasPorParceiro || [],
  despesasPorCategoria: data?.despesasPorCategoria || [],
});

export const financeiroService = {
  async getContratos(): Promise<ContratoFinanceiro[]> {
    const { data, error } = await supabase
      .from('financeiro_configuracoes')
      .select('id,empresa_id,cliente_empresa_id,descricao_servico,valor_mensal,dia_vencimento,emissao_automatica_nfse,ativo,created_at,updated_at')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Erro ao carregar contratos financeiros: ${error.message}`);
    return ((data || []) as ContratoRow[]).map(fromContratoRow);
  },

  async saveContrato(contrato: ContratoSaveInput): Promise<ContratoFinanceiro> {
    const { data, error } = await supabase.rpc('salvar_contrato_financeiro', {
      p_payload: toContratoPayload(contrato),
    });

    if (error) throw new Error(`Erro ao salvar contrato financeiro: ${error.message}`);
    return fromContratoRow(data as ContratoRow);
  },

  async deleteContrato(id: string): Promise<void> {
    const { error } = await supabase
      .from('financeiro_configuracoes')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Erro ao excluir contrato financeiro: ${error.message}`);
  },

  async getCobranças(): Promise<CobrancaFinanceira[]> {
    const { data, error } = await supabase
      .from('financeiro_cobrancas')
      .select('id,empresa_id,contrato_id,cliente_empresa_id,descricao,categoria,valor,data_vencimento,status,meio_pagamento,asaas_cobranca_id,asaas_nfse_id,asaas_boleto_url,data_pagamento,data_cancelamento,created_at,updated_at')
      .order('data_vencimento', { ascending: false });

    if (error) throw new Error(`Erro ao carregar cobranças financeiras: ${error.message}`);
    return ((data || []) as CobrancaRow[]).map(fromCobrancaRow);
  },

  async getLancamentos(): Promise<LancamentoFinanceiro[]> {
    const { data, error } = await supabase
      .from('financeiro_lancamentos')
      .select('id,empresa_id,conta_bancaria_id,cliente_empresa_id,tipo,origem,descricao,categoria,valor,data_competencia,data_pagamento,status,referencia_id,metadados,created_at,updated_at')
      .order('data_competencia', { ascending: false });

    if (error) throw new Error(`Erro ao carregar lançamentos financeiros: ${error.message}`);
    return ((data || []) as LancamentoRow[]).map(fromLancamentoRow);
  },

  async salvarLancamento(lancamento: LancamentoSaveInput): Promise<LancamentoFinanceiro> {
    const { data, error } = await supabase.rpc('salvar_lancamento_financeiro', {
      p_payload: toLancamentoPayload(lancamento),
    });

    if (error) throw new Error(`Erro ao salvar lançamento financeiro: ${error.message}`);
    return fromLancamentoRow(data as LancamentoRow);
  },

  async cancelarCobrança(cobrancaId: string): Promise<void> {
    const { data, error } = await supabase.rpc('cancelar_cobranca_financeira', {
      p_cobranca_id: cobrancaId,
    });

    if (error) throw new Error(`Erro ao cancelar cobrança: ${error.message}`);
    if (!data) throw new Error('Cobrança não encontrada ou já paga.');
  },

  async cancelarBoleto(cobrancaId: string): Promise<void> {
    const { data, error } = await supabase.rpc('cancelar_boleto_financeiro', {
      p_cobranca_id: cobrancaId,
    });

    if (error) throw new Error(`Erro ao cancelar boleto: ${error.message}`);
    if (!data) throw new Error('Apenas boletos pendentes podem ser cancelados.');
  },

  async emitirNfseManual(cobrancaId: string): Promise<string> {
    const { data, error } = await supabase.rpc('emitir_nfse_asaas', {
      p_cobranca_id: cobrancaId,
    });

    if (error) throw new Error(`Erro ao emitir NFS-e: ${error.message}`);
    return String(data);
  },

  async simularRecebimento(cobrancaId: string): Promise<void> {
    const { data, error } = await supabase.rpc('confirmar_recebimento_financeiro', {
      p_cobranca_id: cobrancaId,
    });

    if (error) throw new Error(`Erro ao confirmar recebimento: ${error.message}`);
    if (!data) throw new Error('Cobrança não encontrada ou cancelada.');
  },

  async getStats(meses = 6): Promise<DashboardStats> {
    const { data, error } = await supabase.rpc('get_financeiro_dashboard', {
      p_meses: meses,
    });

    if (error) throw new Error(`Erro ao carregar dashboard financeiro: ${error.message}`);
    return normalizeStats(data as Partial<DashboardStats>);
  },

  async gerarCobrançaManual(dados: {
    clienteEmpresaId: string;
    valor: number;
    dataVencimento: string;
    descricao: string;
    meioPagamento: 'Pix' | 'Boleto' | 'Ambos';
  }): Promise<void> {
    const { error } = await supabase.rpc('gerar_cobranca_manual_financeira', {
      p_payload: {
        cliente_empresa_id: dados.clienteEmpresaId,
        valor: dados.valor,
        data_vencimento: dados.dataVencimento,
        descricao: dados.descricao,
        meio_pagamento: dados.meioPagamento,
      },
    });

    if (error) throw new Error(`Erro ao gerar cobrança avulsa: ${error.message}`);
  },
};
