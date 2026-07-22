import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  ContasPagarParceladasInput,
  ContratoFinanceiro,
  CobrancaFinanceira,
  DashboardStats,
  LancamentoFinanceiro,
  TransferenciaFinanceiraInput,
} from '../services/financeiroService';
import { gestaoEmpresarialService } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import type { Company } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import {
  useCancelBoletoFinanceiroMutation,
  useCancelCobrancaFinanceiraMutation,
  useCobrancasFinanceirasQuery,
  useBaixarManualCobrancaCustomMutation,
  useContratosFinanceirosQuery,
  useCreateCobrancaFinanceiraMutation,
  useCriarContasPagarParceladasMutation,
  useDeleteContratoFinanceiroMutation,
  useEmitirNfseFinanceiraMutation,
  useFinanceiroDashboardQuery,
  useLancamentosFinanceirosQuery,
  useSaveLancamentoFinanceiroMutation,
  useSaveContratoFinanceiroMutation,
  useTransferirEntreContasFinanceiroMutation,
} from '../queries/useFinanceiroQueries';

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
const emptyContratos: ContratoFinanceiro[] = [];
const emptyCobrancas: CobrancaFinanceira[] = [];
const emptyLancamentos: LancamentoFinanceiro[] = [];
const emptyCompanies: Company[] = [];

export type FinanceiroView = 'caixa' | 'receber' | 'pagar' | 'lancamentos';

export const useFinanceiro = (activeView: FinanceiroView = 'caixa') => {
  // A página permanece montada quando é usada como aba interna. Carregar todos
  // os conjuntos de dados a cada ativação gerava cinco requests concorrentes e
  // reabria observers que nem eram usados pela subaba visível.
  const needsCobrancas = activeView === 'receber';
  const needsLancamentos = activeView === 'pagar' || activeView === 'lancamentos';
  const needsDashboard = activeView === 'caixa';
  const contratosQuery = useContratosFinanceirosQuery({ enabled: false });
  const cobrancasQuery = useCobrancasFinanceirasQuery({ enabled: needsCobrancas });
  const lancamentosQuery = useLancamentosFinanceirosQuery({ enabled: needsLancamentos });
  const statsQuery = useFinanceiroDashboardQuery(6, { enabled: needsDashboard });
  const companiesQuery = useQuery({
    queryKey: ['gestao-empresarial', 'companies'],
    queryFn: gestaoEmpresarialService.getCompanies,
    enabled: needsCobrancas,
    staleTime: 5 * 60_000,
  });

  const saveContratoMutation = useSaveContratoFinanceiroMutation();
  const deleteContratoMutation = useDeleteContratoFinanceiroMutation();
  const cancelCobrancaMutation = useCancelCobrancaFinanceiraMutation();
  const cancelBoletoMutation = useCancelBoletoFinanceiroMutation();
  const emitirNfseMutation = useEmitirNfseFinanceiraMutation();
  const baixarManualCobrancaCustomMutation = useBaixarManualCobrancaCustomMutation();
  const createCobrancaMutation = useCreateCobrancaFinanceiraMutation();
  const saveLancamentoMutation = useSaveLancamentoFinanceiroMutation();
  const transferirEntreContasMutation = useTransferirEntreContasFinanceiroMutation();
  const criarContasPagarParceladasMutation = useCriarContasPagarParceladasMutation();

  const contratos = contratosQuery.data || emptyContratos;
  const cobranças = cobrancasQuery.data || emptyCobrancas;
  const lancamentos = lancamentosQuery.data || emptyLancamentos;
  const companies = (companiesQuery.data || emptyCompanies) as Company[];
  const stats = statsQuery.data || emptyStats;
  const activeQueries = needsCobrancas
    ? [cobrancasQuery, companiesQuery]
    : needsLancamentos
      ? [lancamentosQuery]
      : [statsQuery];
  const loadError = activeQueries
    .map((query) => query.error)
    .find((error): error is Error => error instanceof Error) || null;

  const [activeTab, setActiveTab] = useState<'contratos' | 'cobranças'>('cobranças');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [subTab, setSubTab] = useState<'atual' | 'pendentes' | 'atraso' | 'todos'>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Pendente' | 'Pago' | 'Vencido' | 'Cancelado'>('Todos');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddCobrancaModal, setShowAddCobrancaModal] = useState(false);
  const [editingContract, setEditingContract] = useState<ContratoFinanceiro | null>(null);
  const [cobrancaToCancel, setCobrancaToCancel] = useState<CobrancaFinanceira | null>(null);
  const [boletoToCancel, setBoletoToCancel] = useState<CobrancaFinanceira | null>(null);
  const [contractToDelete, setContractToDelete] = useState<ContratoFinanceiro | null>(null);
  const [showManualSettlementModal, setShowManualSettlementModal] = useState(false);
  const [settlementCobranca, setSettlementCobranca] = useState<CobrancaFinanceira | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setTransientSuccess = useCallback((message: string, timeout = 3000) => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    setSuccessMsg(message);
    successTimerRef.current = setTimeout(() => {
      successTimerRef.current = null;
      setSuccessMsg(null);
    }, timeout);
  }, []);

  const setTransientError = useCallback((message: string) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setErrorMsg(message);
    errorTimerRef.current = setTimeout(() => {
      errorTimerRef.current = null;
      setErrorMsg(null);
    }, 4000);
  }, []);

  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
  }, []);

  const companyMap = useMemo(() => {
    const map = new Map<string, { nome: string; cnpj: string }>();
    companies.forEach((company) => {
      map.set(company.id, { nome: company.nome, cnpj: company.cnpj });
    });
    return map;
  }, [companies]);

  const filteredContratos = useMemo(() => {
    return contratos.filter((contrato) => {
      const details = companyMap.get(contrato.clienteEmpresaId);
      const cName = details?.nome.toLowerCase() || '';
      const cCnpj = details?.cnpj.replace(/\D/g, '') || '';
      const q = searchQuery.toLowerCase();
      const qClean = q.replace(/\D/g, '');
      return cName.includes(q) || cCnpj.includes(qClean);
    });
  }, [contratos, searchQuery, companyMap]);

  const filteredCobranças = useMemo(() => {
    return cobranças.filter((cobranca) => {
      const details = companyMap.get(cobranca.clienteEmpresaId);
      const cName = details?.nome.toLowerCase() || '';
      const cCnpj = details?.cnpj.replace(/\D/g, '') || '';
      const q = searchQuery.toLowerCase();
      const qClean = q.replace(/\D/g, '');
      const matchesSearch = cName.includes(q) || cCnpj.includes(qClean);
      const matchesStatus = statusFilter === 'Todos' || cobranca.status === statusFilter;
      const matchesStart = !startDate || cobranca.dataVencimento >= startDate;
      const matchesEnd = !endDate || cobranca.dataVencimento <= endDate;

      let matchesSubTab = true;
      if (subTab === 'atual') {
        const today = new Date();
        const yyyyMm = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
        matchesSubTab = cobranca.dataVencimento.startsWith(yyyyMm);
      } else if (subTab === 'pendentes') {
        matchesSubTab = cobranca.status === 'Pendente';
      } else if (subTab === 'atraso') {
        matchesSubTab = cobranca.status === 'Vencido';
      }

      return matchesSearch && matchesStatus && matchesStart && matchesEnd && matchesSubTab;
    });
  }, [cobranças, searchQuery, statusFilter, startDate, endDate, subTab, companyMap]);

  const contasPagar = useMemo(
    () => lancamentos.filter((item) => item.tipo === 'despesa' && item.origem === 'conta_pagar'),
    [lancamentos],
  );

  const transferencias = useMemo(
    () => lancamentos.filter((item) => item.origem === 'transferencia'),
    [lancamentos],
  );

  const outrosCreditos = useMemo(
    () => lancamentos.filter((item) => item.tipo === 'receita' && item.origem === 'outro_credito'),
    [lancamentos],
  );

  const outrosDebitos = useMemo(
    () => lancamentos.filter((item) => item.tipo === 'despesa' && item.origem === 'outro_debito'),
    [lancamentos],
  );

  const handleSaveContract = async (contractData: Omit<ContratoFinanceiro, 'id' | 'empresaId' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    try {
      await saveContratoMutation.mutateAsync(contractData);
      setTransientSuccess(contractData.id ? 'Contrato atualizado com sucesso!' : 'Contrato e faturamento criados com sucesso!');
      setShowAddModal(false);
      setEditingContract(null);
    } catch (err) {
      setTransientError(err instanceof Error ? err.message : 'Falha ao salvar contrato.');
    }
  };

  const handleDeleteContract = async (id: string) => {
    try {
      await deleteContratoMutation.mutateAsync(id);
      setTransientSuccess('Contrato excluído com sucesso!');
      setContractToDelete(null);
    } catch (err) {
      setTransientError(err instanceof Error ? err.message : 'Erro ao excluir contrato.');
    }
  };

  const handleCancelCobranca = async (id: string) => {
    try {
      await cancelCobrancaMutation.mutateAsync(id);
      setTransientSuccess('Cobrança cancelada no Banco Inter e no sistema.');
      setCobrancaToCancel(null);
    } catch (err) {
      setTransientError(err instanceof Error ? err.message : 'Falha ao cancelar cobrança.');
    }
  };

  const handleCancelBoleto = async (id: string) => {
    try {
      await cancelBoletoMutation.mutateAsync(id);
      setTransientSuccess('Cobrança cancelada no Banco Inter. Documento removido.');
      setBoletoToCancel(null);
    } catch (err) {
      setTransientError(err instanceof Error ? err.message : 'Falha ao cancelar boleto.');
    }
  };

  const handleEmitirNfseManual = async (id: string) => {
    try {
      const nfseId = await emitirNfseMutation.mutateAsync(id);
      setTransientSuccess(`Nota Fiscal de Serviço (NFS-e) emitida com sucesso! ID: ${nfseId}`, 4000);
    } catch (err) {
      setTransientError(err instanceof Error ? err.message : 'Falha ao emitir NFS-e.');
    }
  };

  const handleBaixarManualCobrancaCustom = async (dados: {
    cobrancaId: string;
    dataPagamento: string;
    formaPagamento: string;
    valorRecebido: number;
    desconto: number;
    juros: number;
    observacao: string;
    baixarParcial: boolean;
    contaBancariaId?: string;
  }) => {
    try {
      await baixarManualCobrancaCustomMutation.mutateAsync(dados);
      setTransientSuccess('Baixa manual registrada com sucesso!');
      setShowManualSettlementModal(false);
      setSettlementCobranca(null);
    } catch (err) {
      setTransientError(err instanceof Error ? err.message : 'Falha ao registrar baixa manual.');
    }
  };

  const handleCreateCobranca = async (dados: {
    clienteEmpresaId: string;
    valor: number;
    dataVencimento: string;
    descricao: string;
    meioPagamento: 'Pix' | 'Boleto' | 'Ambos';
    descontoPercentual?: number;
    jurosPercentual?: number;
    multaPercentual?: number;
    mensagemBoleto?: string;
  }) => {
    try {
      await createCobrancaMutation.mutateAsync(dados);
      setTransientSuccess('Cobrança avulsa gerada com sucesso no Banco Inter!');
      setShowAddCobrancaModal(false);
    } catch (err) {
      setTransientError(err instanceof Error ? err.message : 'Falha ao gerar cobrança avulsa.');
    }
  };

  const handleCreateLancamento = async (dados: Pick<
    LancamentoFinanceiro,
    'tipo' | 'origem' | 'descricao' | 'categoria' | 'valor' | 'dataCompetencia' | 'status'
  > & Partial<Pick<LancamentoFinanceiro, 'contaBancariaId' | 'clienteEmpresaId' | 'dataPagamento' | 'referenciaId' | 'metadados'>>) => {
    try {
      await saveLancamentoMutation.mutateAsync(dados);
      setTransientSuccess('Lançamento financeiro registrado com sucesso.');
    } catch (err) {
      setTransientError(err instanceof Error ? err.message : 'Falha ao registrar lançamento financeiro.');
    }
  };

  const handleTransferirEntreContas = async (dados: TransferenciaFinanceiraInput) => {
    try {
      await transferirEntreContasMutation.mutateAsync(dados);
      setTransientSuccess('Transferência registrada com sucesso.');
    } catch (err) {
      setTransientError(err instanceof Error ? err.message : 'Falha ao transferir entre contas.');
      throw err;
    }
  };

  const handleCriarContasPagarParceladas = async (dados: ContasPagarParceladasInput) => {
    try {
      await criarContasPagarParceladasMutation.mutateAsync(dados);
      setTransientSuccess('Parcelas registradas com sucesso.');
    } catch (err) {
      setTransientError(err instanceof Error ? err.message : 'Falha ao criar parcelas.');
      throw err;
    }
  };

  const retryLoad = async () => {
    if (needsCobrancas) {
      await Promise.all([cobrancasQuery.refetch(), companiesQuery.refetch()]);
      return;
    }
    if (needsLancamentos) {
      await lancamentosQuery.refetch();
      return;
    }
    await statsQuery.refetch();
  };

  return {
    contratos,
    cobranças,
    lancamentos,
    contasPagar,
    transferencias,
    outrosCreditos,
    outrosDebitos,
    filteredContratos,
    filteredCobranças,
    companies,
    stats,
    companyMap,
    loadError,
    retryLoad,
    activeTab,
    setActiveTab,
    isLoading: activeQueries.some((query) => query.isLoading),
    successMsg,
    errorMsg,
    viewMode,
    setViewMode,
    subTab,
    setSubTab,
    searchQuery,
    setSearchQuery,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    statusFilter,
    setStatusFilter,
    showAddModal,
    setShowAddModal,
    showAddCobrancaModal,
    setShowAddCobrancaModal,
    editingContract,
    setEditingContract,
    cobrancaToCancel,
    setCobrancaToCancel,
    boletoToCancel,
    setBoletoToCancel,
    contractToDelete,
    setContractToDelete,
    showManualSettlementModal,
    setShowManualSettlementModal,
    settlementCobranca,
    setSettlementCobranca,
    handleSaveContract,
    handleDeleteContract,
    handleCancelCobranca,
    handleCancelBoleto,
    handleEmitirNfseManual,
    handleBaixarManualCobrancaCustom,
    isCustomSettlementLoading: baixarManualCobrancaCustomMutation.isPending,
    handleCreateCobranca,
    handleCreateLancamento,
    handleTransferirEntreContas,
    handleCriarContasPagarParceladas,
  };
};
