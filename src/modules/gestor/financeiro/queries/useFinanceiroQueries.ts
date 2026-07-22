import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configuracoesKeys } from '../../configuracoes/queries/configuracoesKeys';
import { faturamentoKeys } from '../../faturamento/queries/faturamentoKeys';
import {
  financeiroService,
  type CobrancaFinanceira,
  type ContasPagarParceladasInput,
  type ContratoFinanceiro,
  type LancamentoFinanceiro,
  type TransferenciaFinanceiraInput,
} from '../services/financeiroService';
import { financeiroKeys } from './financeiroKeys';

type ContratoSaveInput = Omit<ContratoFinanceiro, 'id' | 'empresaId' | 'createdAt' | 'updatedAt'> & { id?: string; gerarCobranca?: boolean };
type LancamentoSaveInput = Pick<
  LancamentoFinanceiro,
  'tipo' | 'origem' | 'descricao' | 'categoria' | 'valor' | 'dataCompetencia' | 'status'
> & Partial<Pick<LancamentoFinanceiro, 'contaBancariaId' | 'clienteEmpresaId' | 'dataPagamento' | 'referenciaId' | 'metadados'>>;

const invalidateFinanceiro = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: financeiroKeys.all });
  queryClient.invalidateQueries({ queryKey: faturamentoKeys.all });
  queryClient.invalidateQueries({ queryKey: configuracoesKeys.contasBancarias() });
  queryClient.invalidateQueries({ queryKey: configuracoesKeys.contasBancariasResumo() });
};

const FINANCEIRO_STALE_TIME_MS = 30_000;
const FINANCEIRO_STATIC_STALE_TIME_MS = 5 * 60_000;

type FinanceiroQueryOptions = {
  enabled?: boolean;
};

export const useContratosFinanceirosQuery = ({ enabled = true }: FinanceiroQueryOptions = {}) => (
  useQuery({
    queryKey: financeiroKeys.contratos(),
    queryFn: ({ signal }) => financeiroService.getContratos(signal),
    enabled,
    staleTime: FINANCEIRO_STATIC_STALE_TIME_MS,
  })
);

export const useCobrancasFinanceirasQuery = ({ enabled = true }: FinanceiroQueryOptions = {}) => (
  useQuery({
    queryKey: financeiroKeys.cobrancas(),
    queryFn: ({ signal }) => financeiroService.getCobranças(signal),
    enabled,
    staleTime: FINANCEIRO_STALE_TIME_MS,
  })
);

export const useLancamentosFinanceirosQuery = ({ enabled = true }: FinanceiroQueryOptions = {}) => (
  useQuery({
    queryKey: financeiroKeys.lancamentos(),
    queryFn: ({ signal }) => financeiroService.getLancamentos(signal),
    enabled,
    staleTime: FINANCEIRO_STALE_TIME_MS,
  })
);

export const useFinanceiroDashboardQuery = (meses = 6, { enabled = true }: FinanceiroQueryOptions = {}) => (
  useQuery({
    queryKey: financeiroKeys.dashboard(meses),
    queryFn: ({ signal }) => financeiroService.getStats(meses, signal),
    enabled,
    staleTime: FINANCEIRO_STALE_TIME_MS,
  })
);

export const useSaveContratoFinanceiroMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ContratoSaveInput) => financeiroService.saveContrato(input),
    onSuccess: () => invalidateFinanceiro(queryClient),
  });
};

export const useDeleteContratoFinanceiroMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => financeiroService.deleteContrato(id),
    onSuccess: () => invalidateFinanceiro(queryClient),
  });
};

export const useCancelCobrancaFinanceiraMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => financeiroService.cancelarCobrança(id),
    onSuccess: () => invalidateFinanceiro(queryClient),
  });
};

export const useCancelBoletoFinanceiroMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => financeiroService.cancelarBoleto(id),
    onSuccess: () => invalidateFinanceiro(queryClient),
  });
};

export const useEmitirNfseFinanceiraMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => financeiroService.emitirNfseManual(id),
    onSuccess: () => invalidateFinanceiro(queryClient),
  });
};

export const useBaixarManualCobrancaCustomMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dados: {
      cobrancaId: string;
      dataPagamento: string;
      formaPagamento: string;
      valorRecebido: number;
      desconto: number;
      juros: number;
      observacao: string;
      baixarParcial: boolean;
      contaBancariaId?: string;
    }) => financeiroService.baixarManualCobrancaCustom(dados),
    onSuccess: () => invalidateFinanceiro(queryClient),
  });
};

export const useCreateCobrancaFinanceiraMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dados: {
      clienteEmpresaId: string;
      contratoId?: string;
      valor: number;
      dataVencimento: string;
      descricao: string;
      categoria?: string;
      meioPagamento: CobrancaFinanceira['meioPagamento'];
      descontoPercentual?: number;
      jurosPercentual?: number;
      multaPercentual?: number;
      mensagemBoleto?: string;
    }) => financeiroService.gerarCobrançaManual(dados),
    onSuccess: () => invalidateFinanceiro(queryClient),
  });
};

export const useSaveLancamentoFinanceiroMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dados: LancamentoSaveInput) => financeiroService.salvarLancamento(dados),
    onSuccess: () => invalidateFinanceiro(queryClient),
  });
};

export const useTransferirEntreContasFinanceiroMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dados: TransferenciaFinanceiraInput) => financeiroService.transferirEntreContas(dados),
    onSuccess: () => invalidateFinanceiro(queryClient),
  });
};

export const useCriarContasPagarParceladasMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dados: ContasPagarParceladasInput) => financeiroService.criarContasPagarParceladas(dados),
    onSuccess: () => invalidateFinanceiro(queryClient),
  });
};

export const usePagarDespesaManualMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dados: {
      lancamentoId: string;
      contaBancariaId: string;
      dataPagamento: string;
      valorPago: number;
      desconto: number;
      juros: number;
      observacao: string;
    }) => financeiroService.pagarDespesaManual(dados),
    onSuccess: () => invalidateFinanceiro(queryClient),
  });
};
