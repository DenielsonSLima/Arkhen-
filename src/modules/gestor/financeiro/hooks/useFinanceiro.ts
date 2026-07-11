import { useState, useEffect, useMemo } from 'react';
import { financeiroService } from '../services/financeiroService';
import type { ContratoFinanceiro, CobrancaFinanceira, DashboardStats } from '../services/financeiroService';
import { gestaoEmpresarialService } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import type { Company } from '../../gestao-empresarial/services/gestaoEmpresarialService';

export const useFinanceiro = () => {
  // Data States
  const [contratos, setContratos] = useState<ContratoFinanceiro[]>([]);
  const [cobranças, setCobranças] = useState<CobrancaFinanceira[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalFaturado: 0,
    totalRecebido: 0,
    totalPendente: 0,
    taxaInadimplencia: 0
  });

  // UI / Navigation States
  const [activeTab, setActiveTab] = useState<'contratos' | 'cobranças'>('cobranças');
  const [isLoading, setIsLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [subTab, setSubTab] = useState<'atual' | 'pendentes' | 'atraso' | 'todos'>('todos');

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Pendente' | 'Pago' | 'Vencido' | 'Cancelado'>('Todos');

  // Modal / Confirm States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddCobrancaModal, setShowAddCobrancaModal] = useState(false);
  const [editingContract, setEditingContract] = useState<ContratoFinanceiro | null>(null);
  const [cobrancaToCancel, setCobrancaToCancel] = useState<CobrancaFinanceira | null>(null);
  const [boletoToCancel, setBoletoToCancel] = useState<CobrancaFinanceira | null>(null);
  const [contractToDelete, setContractToDelete] = useState<ContratoFinanceiro | null>(null);

  // Initialize and load data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cList, bList, comps, dashboardStats] = await Promise.all([
        financeiroService.getContratos(),
        financeiroService.getCobranças(),
        gestaoEmpresarialService.getCompanies(),
        financeiroService.getStats()
      ]);
      setContratos(cList);
      setCobranças(bList);
      setCompanies(comps);
      setStats(dashboardStats);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Falha ao carregar dados do módulo financeiro.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map to easily lookup company details
  const companyMap = useMemo(() => {
    const map = new Map<string, { nome: string; cnpj: string }>();
    companies.forEach(c => {
      map.set(c.id, { nome: c.nome, cnpj: c.cnpj });
    });
    return map;
  }, [companies]);

  // Filters and Computes
  const filteredContratos = useMemo(() => {
    return contratos.filter(c => {
      const details = companyMap.get(c.clienteEmpresaId);
      const cName = details?.nome.toLowerCase() || '';
      const cCnpj = details?.cnpj.replace(/\D/g, '') || '';
      const q = searchQuery.toLowerCase();
      const qClean = q.replace(/\D/g, '');

      const matchesSearch = cName.includes(q) || cCnpj.includes(qClean);
      return matchesSearch;
    });
  }, [contratos, searchQuery, companyMap]);

  const filteredCobranças = useMemo(() => {
    return cobranças.filter(c => {
      const details = companyMap.get(c.clienteEmpresaId);
      const cName = details?.nome.toLowerCase() || '';
      const cCnpj = details?.cnpj.replace(/\D/g, '') || '';
      const q = searchQuery.toLowerCase();
      const qClean = q.replace(/\D/g, '');

      // Search Query Filter
      const matchesSearch = cName.includes(q) || cCnpj.includes(qClean);

      // Status Filter
      const matchesStatus = statusFilter === 'Todos' || c.status === statusFilter;

      // Date Range Filter (based on dataVencimento)
      let matchesDates = true;
      if (startDate) {
        matchesDates = matchesDates && c.dataVencimento >= startDate;
      }
      if (endDate) {
        matchesDates = matchesDates && c.dataVencimento <= endDate;
      }

      // Sub-tab Filter
      let matchesSubTab = true;
      if (subTab === 'atual') {
        const today = new Date();
        const yyyyMm = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
        matchesSubTab = c.dataVencimento.startsWith(yyyyMm);
      } else if (subTab === 'pendentes') {
        matchesSubTab = c.status === 'Pendente';
      } else if (subTab === 'atraso') {
        matchesSubTab = c.status === 'Vencido';
      }

      return matchesSearch && matchesStatus && matchesDates && matchesSubTab;
    });
  }, [cobranças, searchQuery, statusFilter, startDate, endDate, subTab, companyMap]);

  // Operations
  const handleSaveContract = async (contractData: Omit<ContratoFinanceiro, 'id' | 'empresaId' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    try {
      await financeiroService.saveContrato(contractData);
      setSuccessMsg(contractData.id ? 'Contrato atualizado com sucesso!' : 'Contrato e faturamento criados com sucesso!');
      setShowAddModal(false);
      setEditingContract(null);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao salvar contrato.');
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  const handleDeleteContract = async (id: string) => {
    try {
      await financeiroService.deleteContrato(id);
      setSuccessMsg('Contrato excluído com sucesso!');
      setContractToDelete(null);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao excluir contrato.');
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  const handleCancelCobranca = async (id: string) => {
    try {
      await financeiroService.cancelarCobrança(id);
      setSuccessMsg('Cobrança cancelada com sucesso no Asaas e no sistema.');
      setCobrancaToCancel(null);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao cancelar cobrança.');
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  const handleCancelBoleto = async (id: string) => {
    try {
      await financeiroService.cancelarBoleto(id);
      setSuccessMsg('Boleto cancelado no Asaas. Link de faturamento removido.');
      setBoletoToCancel(null);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao cancelar boleto.');
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  const handleEmitirNfseManual = async (id: string) => {
    try {
      const nfseId = await financeiroService.emitirNfseManual(id);
      setSuccessMsg(`Nota Fiscal de Serviço (NFS-e) emitida com sucesso! ID: ${nfseId}`);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao emitir NFS-e.');
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  const handleSimularRecebimento = async (id: string) => {
    try {
      await financeiroService.simularRecebimento(id);
      setSuccessMsg('Pagamento confirmado via simulação de webhook.');
      await loadData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao liquidar cobrança.');
      setTimeout(() => setErrorMsg(null), 4000);
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
      await financeiroService.gerarCobrançaManual(dados);
      setSuccessMsg('Cobrança avulsa gerada com sucesso no Asaas!');
      setShowAddCobrancaModal(false);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao gerar cobrança avulsa.');
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  return {
    contratos,
    cobranças,
    filteredContratos,
    filteredCobranças,
    companies,
    stats,
    companyMap,

    // UI States
    activeTab,
    setActiveTab,
    isLoading,
    successMsg,
    errorMsg,
    viewMode,
    setViewMode,
    subTab,
    setSubTab,

    // Filters
    searchQuery,
    setSearchQuery,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    statusFilter,
    setStatusFilter,

    // Modais
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

    // Actions
    handleSaveContract,
    handleDeleteContract,
    handleCancelCobranca,
    handleCancelBoleto,
    handleEmitirNfseManual,
    handleSimularRecebimento,
    handleCreateCobranca,
  };
};
