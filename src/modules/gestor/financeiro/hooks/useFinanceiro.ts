import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ContratoFinanceiro, CobrancaFinanceira, DashboardStats, LancamentoFinanceiro } from '../services/financeiroService';
import { gestaoEmpresarialService } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import type { Company } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import {
  useCancelBoletoFinanceiroMutation,
  useCancelCobrancaFinanceiraMutation,
  useCobrancasFinanceirasQuery,
  useConfirmarRecebimentoFinanceiroMutation,
  useContratosFinanceirosQuery,
  useCreateCobrancaFinanceiraMutation,
  useDeleteContratoFinanceiroMutation,
  useEmitirNfseFinanceiraMutation,
  useFinanceiroDashboardQuery,
  useLancamentosFinanceirosQuery,
  useSaveLancamentoFinanceiroMutation,
  useSaveContratoFinanceiroMutation,
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

export const useFinanceiro = () => {
  const contratosQuery = useContratosFinanceirosQuery();
  const cobrancasQuery = useCobrancasFinanceirasQuery();
  const lancamentosQuery = useLancamentosFinanceirosQuery();
  const statsQuery = useFinanceiroDashboardQuery(6);
  const companiesQuery = useQuery({
    queryKey: ['gestao-empresarial', 'companies'],
    queryFn: gestaoEmpresarialService.getCompanies,
  });

  const saveContratoMutation = useSaveContratoFinanceiroMutation();
  const deleteContratoMutation = useDeleteContratoFinanceiroMutation();
  const cancelCobrancaMutation = useCancelCobrancaFinanceiraMutation();
  const cancelBoletoMutation = useCancelBoletoFinanceiroMutation();
  const emitirNfseMutation = useEmitirNfseFinanceiraMutation();
  const confirmarRecebimentoMutation = useConfirmarRecebimentoFinanceiroMutation();
  const createCobrancaMutation = useCreateCobrancaFinanceiraMutation();
  const saveLancamentoMutation = useSaveLancamentoFinanceiroMutation();

  const contratos = contratosQuery.data || emptyContratos;
  const cobranças = cobrancasQuery.data || emptyCobrancas;
  const lancamentos = lancamentosQuery.data || emptyLancamentos;
  const companies = (companiesQuery.data || emptyCompanies) as Company[];
  const stats = statsQuery.data || emptyStats;

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

  const setTransientSuccess = (message: string, timeout = 3000) => {
    setSuccessMsg(message);
    setTimeout(() => setSuccessMsg(null), timeout);
  };

  const setTransientError = (message: string) => {
    setErrorMsg(message);
    setTimeout(() => setErrorMsg(null), 4000);
  };

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
      setTransientSuccess('Cobrança cancelada com sucesso no Asaas e no sistema.');
      setCobrancaToCancel(null);
    } catch (err) {
      setTransientError(err instanceof Error ? err.message : 'Falha ao cancelar cobrança.');
    }
  };

  const handleCancelBoleto = async (id: string) => {
    try {
      await cancelBoletoMutation.mutateAsync(id);
      setTransientSuccess('Boleto cancelado no Asaas. Link de faturamento removido.');
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

  const handleSimularRecebimento = async (id: string) => {
    try {
      await confirmarRecebimentoMutation.mutateAsync(id);
      setTransientSuccess('Pagamento confirmado via webhook.');
    } catch (err) {
      setTransientError(err instanceof Error ? err.message : 'Falha ao liquidar cobrança.');
    }
  };

  const handleCreateCobranca = async (dados: {
    clienteEmpresaId: string;
    valor: number;
    dataVencimento: string;
    descricao: string;
    meioPagamento: 'Pix' | 'Boleto' | 'Ambos';
  }) => {
    try {
      await createCobrancaMutation.mutateAsync(dados);
      setTransientSuccess('Cobrança avulsa gerada com sucesso no Asaas!');
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
    activeTab,
    setActiveTab,
    isLoading: contratosQuery.isLoading || cobrancasQuery.isLoading || lancamentosQuery.isLoading || statsQuery.isLoading || companiesQuery.isLoading,
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
    handleSaveContract,
    handleDeleteContract,
    handleCancelCobranca,
    handleCancelBoleto,
    handleEmitirNfseManual,
    handleSimularRecebimento,
    handleCreateCobranca,
    handleCreateLancamento,
  };
};
