import { supabase, supabaseProjectUrl } from '../../../../lib/supabase';
import { createRuntimeId } from '../../../../lib/realtimeChannel';
import { baixarManualCobranca, type ManualSettlementInput } from './manualSettlementService';
import type {
  CobrancaFinanceira,
  ContasPagarParceladasInput,
  ContratoFinanceiro,
  DashboardStats,
  LancamentoFinanceiro,
  TransferenciaFinanceiraInput,
} from './financeiroTypes';
export type {
  CobrancaFinanceira,
  ContasPagarParceladasInput,
  ContratoFinanceiro,
  DashboardStats,
  FinanceiroBreakdown,
  FinanceiroChartPoint,
  FinanceiroContaSaldo,
  LancamentoFinanceiro,
  TransferenciaFinanceiraInput,
} from './financeiroTypes';
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
  public_token: string | null;
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
  asaas_invoice_url: string | null;
  asaas_bank_slip_url: string | null;
  asaas_billing_type: string | null;
  asaas_status: string | null;
  asaas_ambiente: string | null;
  asaas_payload: Record<string, unknown> | null;
  data_pagamento: string | null;
  data_cancelamento: string | null;
  created_at: string;
  updated_at: string;
  financeiro_cobrancas_integracoes?: CobrancaIntegracaoRow[];
}
interface CobrancaIntegracaoRow {
  provedor: 'asaas' | 'inter';
  external_id: string | null;
  tipo: string;
  boleto_url: string | null;
  pix_copia_cola: string | null;
  pix_qr_code: string | null;
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

const finiteNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const safeText = (value: unknown, fallback = ''): string => (
  typeof value === 'string' && value.trim() ? value : fallback
);

const fromContratoRow = (row: ContratoRow): ContratoFinanceiro => ({
  id: safeText(row.id),
  empresaId: safeText(row.empresa_id),
  clienteEmpresaId: safeText(row.cliente_empresa_id),
  descricaoServico: safeText(row.descricao_servico, 'Honorários contábeis'),
  valorMensal: finiteNumber(row.valor_mensal),
  diaVencimento: finiteNumber(row.dia_vencimento),
  emissaoAutomaticaNfse: Boolean(row.emissao_automatica_nfse),
  ativo: Boolean(row.ativo),
  createdAt: safeText(row.created_at),
  updatedAt: safeText(row.updated_at),
});

const fromCobrancaRow = (row: CobrancaRow): CobrancaFinanceira => {
  const integration = row.financeiro_cobrancas_integracoes?.[0];
  const interDocumentUrl = integration?.provedor === 'inter' && row.public_token && integration.tipo !== 'pix'
    ? `${supabaseProjectUrl.replace(/\/$/, '')}/functions/v1/inter-charge-document/${row.public_token}`
    : undefined;
  const pixCopyPaste = integration?.pix_copia_cola || undefined;
  const mergedPayload = pixCopyPaste
    ? { ...(row.asaas_payload || {}), pixQrCode: { payload: pixCopyPaste } }
    : row.asaas_payload || undefined;
  return {
    id: safeText(row.id),
    publicToken: row.public_token || undefined,
    empresaId: safeText(row.empresa_id),
    contratoId: row.contrato_id || undefined,
    clienteEmpresaId: safeText(row.cliente_empresa_id),
    descricao: safeText(row.descricao, 'Cobrança sem descrição'),
    categoria: safeText(row.categoria, 'Faturamento'),
    valor: finiteNumber(row.valor),
    dataVencimento: safeText(row.data_vencimento),
    status: row.status,
    meioPagamento: row.meio_pagamento,
    asaasCobrancaId: row.asaas_cobranca_id || undefined,
    asaasNfseId: row.asaas_nfse_id || undefined,
    asaasBoletoUrl: row.asaas_boleto_url || integration?.boleto_url || interDocumentUrl,
    asaasInvoiceUrl: row.asaas_invoice_url || integration?.boleto_url || interDocumentUrl,
    asaasBankSlipUrl: row.asaas_bank_slip_url || interDocumentUrl,
    asaasBillingType: row.asaas_billing_type || undefined,
    asaasStatus: row.asaas_status || undefined,
    asaasAmbiente: row.asaas_ambiente || undefined,
    asaasPayload: mergedPayload,
    bankProvider: integration?.provedor,
    bankExternalId: integration?.external_id || undefined,
    pixCopyPaste,
    dataPagamento: row.data_pagamento || undefined,
    dataCancelamento: row.data_cancelamento || undefined,
    createdAt: safeText(row.created_at),
    updatedAt: safeText(row.updated_at),
  };
};

const fromLancamentoRow = (row: LancamentoRow): LancamentoFinanceiro => ({
  id: safeText(row.id),
  empresaId: safeText(row.empresa_id),
  contaBancariaId: row.conta_bancaria_id || undefined,
  clienteEmpresaId: row.cliente_empresa_id || undefined,
  tipo: row.tipo,
  origem: row.origem,
  descricao: safeText(row.descricao, 'Lançamento sem descrição'),
  categoria: safeText(row.categoria, 'Sem categoria'),
  valor: finiteNumber(row.valor),
  dataCompetencia: safeText(row.data_competencia),
  dataPagamento: row.data_pagamento || undefined,
  status: row.status,
  referenciaId: row.referencia_id || undefined,
  metadados: row.metadados || {},
  createdAt: safeText(row.created_at),
  updatedAt: safeText(row.updated_at),
});

const toContratoPayload = (contrato: ContratoSaveInput) => ({
  id: contrato.id || '',
  cliente_empresa_id: contrato.clienteEmpresaId || '',
  descricao_servico: contrato.descricaoServico || 'Honorários contábeis',
  valor_mensal: contrato.valorMensal,
  dia_vencimento: contrato.diaVencimento,
  emissao_automatica_nfse: contrato.emissaoAutomaticaNfse,
  ativo: contrato.ativo,
  gerar_cobranca: contrato.gerarCobranca ?? false,
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

export const normalizeFinanceiroStats = (data: Partial<DashboardStats> | null): DashboardStats => {
  const desempenho = Array.isArray(data?.desempenho)
    ? data.desempenho.map((item) => ({
        name: safeText(item?.name, '-'),
        receita: finiteNumber(item?.receita),
        despesas: finiteNumber(item?.despesas),
        lucro: finiteNumber(item?.lucro),
      }))
    : [];
  const contas = Array.isArray(data?.contas)
    ? data.contas.map((item) => ({
        id: safeText(item?.id),
        banco: safeText(item?.banco, 'Banco não informado'),
        agencia: safeText(item?.agencia, '-'),
        conta: safeText(item?.conta, '-'),
        saldo: finiteNumber(item?.saldo),
      }))
    : [];
  const normalizeBreakdown = (items: DashboardStats['receitasPorParceiro'] | undefined) => (
    Array.isArray(items)
      ? items.map((item) => ({
          id: typeof item?.id === 'string' ? item.id : null,
          nome: safeText(item?.nome, 'Não informado'),
          valor: finiteNumber(item?.valor),
          percentual: finiteNumber(item?.percentual),
        }))
      : []
  );

  return {
    ...emptyStats,
    totalFaturado: finiteNumber(data?.totalFaturado),
    totalRecebido: finiteNumber(data?.totalRecebido),
    totalPendente: finiteNumber(data?.totalPendente),
    taxaInadimplencia: finiteNumber(data?.taxaInadimplencia),
    patrimonioLiquido: finiteNumber(data?.patrimonioLiquido),
    saldoDisponivel: finiteNumber(data?.saldoDisponivel),
    contasReceber: finiteNumber(data?.contasReceber),
    contasPagar: finiteNumber(data?.contasPagar),
    lucroMes: finiteNumber(data?.lucroMes),
    receitasRecebidas: finiteNumber(data?.receitasRecebidas),
    despesasPagas: finiteNumber(data?.despesasPagas),
    desempenho,
    contas,
    receitasPorParceiro: normalizeBreakdown(data?.receitasPorParceiro),
    despesasPorCategoria: normalizeBreakdown(data?.despesasPorCategoria),
  };
};
export const financeiroService = {
  async getContratos(signal?: AbortSignal): Promise<ContratoFinanceiro[]> {
    const { data, error } = await supabase
      .from('financeiro_configuracoes')
      .select('id,empresa_id,cliente_empresa_id,descricao_servico,valor_mensal,dia_vencimento,emissao_automatica_nfse,ativo,created_at,updated_at')
      .order('created_at', { ascending: false })
      .abortSignal(signal ?? new AbortController().signal);

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

  async getCobranças(signal?: AbortSignal): Promise<CobrancaFinanceira[]> {
    const { data, error } = await supabase
      .from('financeiro_cobrancas')
      .select('id,public_token,empresa_id,contrato_id,cliente_empresa_id,descricao,categoria,valor,data_vencimento,status,meio_pagamento,asaas_cobranca_id,asaas_nfse_id,asaas_boleto_url,asaas_invoice_url,asaas_bank_slip_url,asaas_billing_type,asaas_status,asaas_ambiente,asaas_payload,data_pagamento,data_cancelamento,created_at,updated_at,financeiro_cobrancas_integracoes(provedor,external_id,tipo,boleto_url,pix_copia_cola,pix_qr_code)')
      .order('data_vencimento', { ascending: false })
      .abortSignal(signal ?? new AbortController().signal);

    if (error) throw new Error(`Erro ao carregar cobranças financeiras: ${error.message}`);
    return ((data || []) as CobrancaRow[]).map(fromCobrancaRow);
  },

  async getLancamentos(signal?: AbortSignal): Promise<LancamentoFinanceiro[]> {
    const { data, error } = await supabase
      .from('financeiro_lancamentos')
      .select('id,empresa_id,conta_bancaria_id,cliente_empresa_id,tipo,origem,descricao,categoria,valor,data_competencia,data_pagamento,status,referencia_id,metadados,created_at,updated_at')
      .order('data_competencia', { ascending: false })
      .abortSignal(signal ?? new AbortController().signal);

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

  async transferirEntreContas(input: TransferenciaFinanceiraInput): Promise<void> {
    const { error } = await supabase.rpc('transferir_entre_contas_financeiro', {
      p_payload: {
        conta_origem_id: input.contaOrigemId,
        conta_destino_id: input.contaDestinoId,
        valor: input.valor,
        data: input.data,
        descricao: input.descricao,
        idempotency_key: input.idempotencyKey,
      },
    });

    if (error) throw new Error(`Erro ao transferir entre contas: ${error.message}`);
  },

  async criarContasPagarParceladas(input: ContasPagarParceladasInput): Promise<void> {
    const { error } = await supabase.rpc('criar_contas_pagar_parceladas', {
      p_payload: {
        tipo_despesa: input.tipoDespesa,
        descricao: input.descricao,
        categoria: input.categoria,
        valor_total: input.valorTotal,
        data_competencia: input.dataCompetencia,
        data_vencimento: input.dataVencimento,
        status: input.status,
        conta_bancaria_id: input.contaBancariaId || null,
        numero_parcelas: input.numeroParcelas,
        idempotency_key: input.idempotencyKey,
      },
    });

    if (error) throw new Error(`Erro ao criar contas a pagar parceladas: ${error.message}`);
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
    const { data, error } = await supabase.functions.invoke('asaas-manual-settlement', {
      body: {
        cobranca_id: cobrancaId,
      },
    });

    if (error) throw new Error(`Erro ao registrar baixa manual: ${error.message}`);
    if (!data?.ok) throw new Error(data?.error || 'Erro ao registrar baixa manual.');
  },

  async baixarManualCobrancaCustom(dados: ManualSettlementInput): Promise<void> {
    await baixarManualCobranca(dados);
  },

  async pagarDespesaManual(dados: {
    lancamentoId: string;
    contaBancariaId: string;
    dataPagamento: string;
    valorPago: number;
    desconto: number;
    juros: number;
    observacao: string;
  }): Promise<void> {
    const { error } = await supabase.rpc('pagar_despesa_financeira', {
      p_lancamento_id: dados.lancamentoId,
      p_conta_bancaria_id: dados.contaBancariaId,
      p_data_pagamento: dados.dataPagamento,
      p_valor_pago: dados.valorPago,
      p_desconto: dados.desconto,
      p_juros: dados.juros,
      p_observacao: dados.observacao,
    });

    if (error) throw new Error(`Erro ao registrar pagamento de despesa: ${error.message}`);
  },

  async getStats(meses = 6, signal?: AbortSignal): Promise<DashboardStats> {
    const { data, error } = await supabase.rpc('get_financeiro_dashboard', { p_meses: meses })
      .abortSignal(signal ?? new AbortController().signal);

    if (error) throw new Error(`Erro ao carregar dashboard financeiro: ${error.message}`);
    return normalizeFinanceiroStats(data as Partial<DashboardStats>);
  },

  async gerarCobrançaManual(dados: {
    clienteEmpresaId: string;
    contratoId?: string;
    valor: number;
    dataVencimento: string;
    descricao: string;
    categoria?: string;
    meioPagamento: 'Pix' | 'Boleto' | 'Ambos';
    descontoPercentual?: number;
    jurosPercentual?: number;
    multaPercentual?: number;
    mensagemBoleto?: string;
  }): Promise<CobrancaFinanceira> {
    const { data, error } = await supabase.functions.invoke('bank-create-charge', {
      body: {
        cliente_empresa_id: dados.clienteEmpresaId,
        contrato_id: dados.contratoId || '',
        valor: dados.valor,
        data_vencimento: dados.dataVencimento,
        descricao: dados.descricao,
        categoria: dados.categoria || 'Faturamento',
        meio_pagamento: dados.meioPagamento,
        desconto_percentual: dados.descontoPercentual || 0,
        juros_percentual: dados.jurosPercentual || 0,
        multa_percentual: dados.multaPercentual || 0,
        mensagem_boleto: dados.mensagemBoleto || '',
        external_reference: dados.contratoId || '',
        request_id: createRuntimeId('bank-charge-request'),
      },
    });

    if (error) throw new Error(`Erro ao gerar cobrança bancária: ${error.message}`);
    if (!data?.ok) throw new Error(data?.error || 'Erro ao gerar cobrança bancária.');

    const row = data.cobranca as CobrancaRow;
    if (data.integracao) row.financeiro_cobrancas_integracoes = [data.integracao as CobrancaIntegracaoRow];
    return fromCobrancaRow(row);
  },
};
