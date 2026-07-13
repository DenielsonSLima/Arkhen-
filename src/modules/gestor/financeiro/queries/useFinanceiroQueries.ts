import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configuracoesKeys } from '../../configuracoes/queries/configuracoesKeys';
import { faturamentoKeys } from '../../faturamento/queries/faturamentoKeys';
import {
  financeiroService,
  type CobrancaFinanceira,
  type ContratoFinanceiro,
  type LancamentoFinanceiro,
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
  queryClient.invalidateQueries({ queryKey: configuracoesKeys.contasBancariasResumo() });
};

export const useContratosFinanceirosQuery = () => (
  useQuery({
    queryKey: financeiroKeys.contratos(),
    queryFn: financeiroService.getContratos,
  })
);

export const useCobrancasFinanceirasQuery = () => (
  useQuery({
    queryKey: financeiroKeys.cobrancas(),
    queryFn: financeiroService.getCobranças,
  })
);

export const useLancamentosFinanceirosQuery = () => (
  useQuery({
    queryKey: financeiroKeys.lancamentos(),
    queryFn: financeiroService.getLancamentos,
  })
);

export const useFinanceiroDashboardQuery = (meses = 6) => (
  useQuery({
    queryKey: financeiroKeys.dashboard(meses),
    queryFn: () => financeiroService.getStats(meses),
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

export const useConfirmarRecebimentoFinanceiroMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => financeiroService.simularRecebimento(id),
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
