import { supabase } from '../../../../lib/supabase';

export interface FaturamentoDashboardFilters {
  dataInicial: string;
  dataFinal: string;
  clienteEmpresaId?: string | null;
  status?: string | null;
}

export interface FaturamentoDashboardStats {
  nfseAEmitir: number;
  nfseEmitidas: number;
  nfseCanceladas: number;
  cobrancasGeradas: number;
  contasReceber: number;
  totalPrevisto: number;
  totalRecebido: number;
  totalAberto: number;
  totalAtraso: number;
}

export interface FaturamentoRecorrenciaHistorico {
  id: string;
  data: string;
  valor: number;
  status: string;
  tipo: string;
}

export interface FaturamentoRecorrencia {
  id: string;
  cliente: string;
  servico: string;
  valor: number;
  dia: string;
  status: 'Ativo' | 'Inativo' | 'Pausado';
  emissaoNfse: boolean;
  cobranca: boolean;
  situacao: 'em_dia' | 'inadimplente';
  diasAtraso?: number;
  historico: FaturamentoRecorrenciaHistorico[];
}

export type FaturamentoNfseStatus = 'A Emitir' | 'Emitida' | 'Cancelada' | 'Rejeitada' | 'Rascunho';

export interface FaturamentoNfse {
  id: string;
  numero: string;
  parceiro: string;
  emissao: string;
  valor: number;
  status: FaturamentoNfseStatus;
  tipo: 'Automática' | 'Manual';
}

export interface FaturamentoInadimplencia {
  id: string;
  parceiro: string;
  valor: number;
  vencimento: string;
  dias: number;
  ultimoContato: string;
}

export interface FaturamentoParametros {
  codigoServicoNfse: string;
  aliquotaIss: number;
  retencaoInss: number;
  regimeTributacao: 'simples' | 'lucro_presumido' | 'lucro_real';
  observacaoNfse: string;
  mensagemEmailCobranca: string;
}

export const faturamentoParametrosPadrao: FaturamentoParametros = {
  codigoServicoNfse: '17.19',
  aliquotaIss: 2,
  retencaoInss: 0,
  regimeTributacao: 'simples',
  observacaoNfse: 'Referente a prestação de serviços do mês [MES_ATUAL]. Valor aproximado dos tributos: [TRIBUTOS_APROX].',
  mensagemEmailCobranca: 'Olá [NOME_CLIENTE], a fatura referente aos serviços de [MES_ATUAL] está disponível. O vencimento será em [DATA_VENCIMENTO].',
};

const normalizeParametros = (value: Partial<FaturamentoParametros> | null): FaturamentoParametros => ({
  ...faturamentoParametrosPadrao,
  ...(value || {}),
  aliquotaIss: Number(value?.aliquotaIss ?? faturamentoParametrosPadrao.aliquotaIss),
  retencaoInss: Number(value?.retencaoInss ?? faturamentoParametrosPadrao.retencaoInss),
});

const emptyStats: FaturamentoDashboardStats = {
  nfseAEmitir: 0,
  nfseEmitidas: 0,
  nfseCanceladas: 0,
  cobrancasGeradas: 0,
  contasReceber: 0,
  totalPrevisto: 0,
  totalRecebido: 0,
  totalAberto: 0,
  totalAtraso: 0,
};

const normalizeStats = (data: Partial<FaturamentoDashboardStats> | null): FaturamentoDashboardStats => ({
  ...emptyStats,
  ...(data || {}),
  nfseAEmitir: Number(data?.nfseAEmitir || 0),
  nfseEmitidas: Number(data?.nfseEmitidas || 0),
  nfseCanceladas: Number(data?.nfseCanceladas || 0),
  cobrancasGeradas: Number(data?.cobrancasGeradas || 0),
  contasReceber: Number(data?.contasReceber || 0),
  totalPrevisto: Number(data?.totalPrevisto || 0),
  totalRecebido: Number(data?.totalRecebido || 0),
  totalAberto: Number(data?.totalAberto || 0),
  totalAtraso: Number(data?.totalAtraso || 0),
});

export const faturamentoService = {
  async getParametros(signal: AbortSignal): Promise<FaturamentoParametros> {
    const { data, error } = await supabase.rpc('listar_parametros_faturamento').abortSignal(signal);
    if (error) throw new Error(`Erro ao carregar configurações de faturamento: ${error.message}`);
    return normalizeParametros(data as Partial<FaturamentoParametros> | null);
  },

  async saveParametros(parametros: FaturamentoParametros): Promise<FaturamentoParametros> {
    const { data, error } = await supabase.rpc('salvar_parametros_faturamento', {
      p_payload: parametros,
    });
    if (error) throw new Error(`Erro ao salvar configurações de faturamento: ${error.message}`);
    return normalizeParametros(data as Partial<FaturamentoParametros> | null);
  },

  async getDashboard(filters: FaturamentoDashboardFilters, signal: AbortSignal): Promise<FaturamentoDashboardStats> {
    const { data, error } = await supabase.rpc('get_faturamento_dashboard', {
      p_data_inicial: filters.dataInicial,
      p_data_final: filters.dataFinal,
      p_cliente_empresa_id: filters.clienteEmpresaId || null,
      p_status: filters.status || 'Todos',
    }).abortSignal(signal);

    if (error) throw new Error(`Erro ao carregar dashboard de faturamento: ${error.message}`);
    return normalizeStats(data as Partial<FaturamentoDashboardStats>);
  },

  async getRecorrencias(signal: AbortSignal): Promise<FaturamentoRecorrencia[]> {
    const { data, error } = await supabase.rpc('get_faturamento_recorrencias').abortSignal(signal);
    if (error) throw new Error(`Erro ao carregar recorrências: ${error.message}`);
    return (Array.isArray(data) ? data : []) as FaturamentoRecorrencia[];
  },

  async getNfse(filters: { status?: string; search?: string }, signal: AbortSignal): Promise<FaturamentoNfse[]> {
    const { data, error } = await supabase.rpc('get_faturamento_nfse', {
      p_status: filters.status || 'Todas',
      p_search: filters.search || '',
    }).abortSignal(signal);

    if (error) throw new Error(`Erro ao carregar histórico de NFS-e: ${error.message}`);
    return (Array.isArray(data) ? data : []) as FaturamentoNfse[];
  },

  async getInadimplencia(filters: { minDias?: number; search?: string }, signal: AbortSignal): Promise<FaturamentoInadimplencia[]> {
    const { data, error } = await supabase.rpc('get_faturamento_inadimplencia', {
      p_min_dias: filters.minDias || 0,
      p_search: filters.search || '',
    }).abortSignal(signal);

    if (error) throw new Error(`Erro ao carregar inadimplência: ${error.message}`);
    return (Array.isArray(data) ? data : []) as FaturamentoInadimplencia[];
  },
};
