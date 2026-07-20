import React, { useCallback, useState, useEffect } from 'react';
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  RefreshCw,
  Receipt,
} from 'lucide-react';
import { useFinanceiro } from './hooks/useFinanceiro';
import { useFinanceiroRealtime } from './hooks/useFinanceiroRealtime';
import type { InternalTabContext } from '../../../stores/internalTabsStore';
import { CaixaTab } from './components/CaixaTab';
import { ContasAReceberTab } from './components/ContasAReceberTab';
import { ContasAPagarTab } from './components/ContasAPagarTab';
import { LancamentosTab } from './components/LancamentosTab';
import { ManualSettlementModal } from './components/ManualSettlementModal';
import './Financeiro.css';

type FinanceiroTab =
  | 'caixa'
  | 'receber'
  | 'pagar'
  | 'lancamentos';

const FINANCEIRO_TABS: { id: FinanceiroTab; label: string; icon: React.ReactNode }[] = [
  { id: 'caixa', label: 'Caixa', icon: <Banknote size={16} /> },
  { id: 'receber', label: 'Contas a Receber', icon: <ArrowUpCircle size={16} /> },
  { id: 'pagar', label: 'Contas a Pagar', icon: <ArrowDownCircle size={16} /> },
  { id: 'lancamentos', label: 'Lançamentos / Extrato', icon: <Receipt size={16} /> },
];

type FinanceiroPageProps = {
  initialTab?: string;
  onViewContextChange?: (context: InternalTabContext) => void;
};

const resolveFinanceiroTab = (initialTab?: string): FinanceiroTab => {
  if (initialTab?.startsWith('lancamentos-')
    || initialTab === 'transferencia'
    || initialTab === 'transferencias'
    || initialTab === 'creditos'
    || initialTab === 'debitos') {
    return 'lancamentos';
  }
  if (initialTab === 'receber') return 'receber';
  if (initialTab === 'pagar') return 'pagar';
  return 'caixa';
};

export const FinanceiroPage: React.FC<FinanceiroPageProps> = ({ initialTab, onViewContextChange }) => {
  // Resolver a subaba antes dos hooks de dados evita montar Caixa, iniciar seu
  // dashboard e logo em seguida descartá-lo ao abrir uma aba interna específica.
  const [activeTab, setActiveTab] = useState<FinanceiroTab>(() => resolveFinanceiroTab(initialTab));
  const onViewContextChangeRef = React.useRef(onViewContextChange);
  useFinanceiroRealtime();
  const {
    filteredCobranças,
    stats,
    companyMap,
    isLoading,
    loadError,
    successMsg,
    errorMsg,
    retryLoad,
    lancamentos,
    contasPagar,
    handleCreateLancamento,
    handleTransferirEntreContas,
    handleCriarContasPagarParceladas,
    showManualSettlementModal,
    setShowManualSettlementModal,
    settlementCobranca,
    setSettlementCobranca,
    handleBaixarManualCobrancaCustom,
    isCustomSettlementLoading,
  } = useFinanceiro(activeTab);

  useEffect(() => {
    setActiveTab(resolveFinanceiroTab(initialTab));
  }, [initialTab]);

  React.useLayoutEffect(() => {
    onViewContextChangeRef.current = onViewContextChange;
  }, [onViewContextChange]);

  useEffect(() => {
    onViewContextChangeRef.current?.({ data: { activeTab } });
  }, [activeTab]);

  const contasReceber = filteredCobranças;

  const formatCurrency = useCallback((value: number) => (
    Number.isFinite(value) ? value : 0
  ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), []);

  const formatDate = useCallback((value: string) => {
    const parts = value.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
  }, []);

  const getCompanyName = useCallback(
    (companyId: string) => companyMap.get(companyId)?.nome || 'Cliente removido',
    [companyMap],
  );
  const getCompanyDetails = useCallback(
    (companyId: string) => companyMap.get(companyId) || { nome: 'Cliente removido', cnpj: '-' },
    [companyMap],
  );

  const renderContent = () => {
    if (isLoading) return <div className="sub-loading">Carregando controle financeiro...</div>;

    if (loadError) {
      return (
        <div className="financeiro-empty-state-box" role="alert">
          <AlertCircle size={36} style={{ color: '#ef4444', marginBottom: '8px' }} />
          <strong>Não foi possível carregar os dados financeiros</strong>
          <span>Confira sua conexão e tente novamente. Se o problema continuar, informe o suporte.</span>
          <button type="button" className="financeiro-dropdown-btn" onClick={() => void retryLoad()}>
            <RefreshCw size={15} />
            Tentar novamente
          </button>
        </div>
      );
    }

    if (activeTab === 'receber') {
      return (
        <ContasAReceberTab
          dados={contasReceber}
          onFormatCurrency={formatCurrency}
          onFormatDate={formatDate}
          getCompanyName={getCompanyName}
          getCompanyDetails={getCompanyDetails}
          onManualSettlement={(item) => {
            setSettlementCobranca(item);
            setShowManualSettlementModal(true);
          }}
          isManualSettlementLoading={isCustomSettlementLoading}
        />
      );
    }

    if (activeTab === 'pagar') {
      return (
        <ContasAPagarTab
          dados={contasPagar}
          onFormatCurrency={formatCurrency}
          onFormatDate={formatDate}
          onCreateContasAPagar={handleCreateLancamento}
          onCreateContasPagarParceladas={handleCriarContasPagarParceladas}
        />
      );
    }

    if (activeTab === 'lancamentos') {
      const initialFilter = initialTab?.startsWith('lancamentos-')
        ? initialTab.replace('lancamentos-', '')
        : (initialTab === 'transferencias' || initialTab === 'transferencia'
          ? 'transferencias'
          : (initialTab === 'creditos' ? 'creditos' : (initialTab === 'debitos' ? 'debitos' : 'todos')));

      return (
        <LancamentosTab
          initialFilter={initialFilter}
          lancamentos={lancamentos}
          onCreateLancamento={handleCreateLancamento}
          onTransferirEntreContas={handleTransferirEntreContas}
          onFormatCurrency={formatCurrency}
          onFormatDate={formatDate}
        />
      );
    }

    return <CaixaTab stats={stats} onFormatCurrency={formatCurrency} />;
  };

  return (
    <div className="financeiro-wrapper financeiro-container animate-fade-in">
      <div className="tab-buttons-header">
        {FINANCEIRO_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`btn-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {successMsg && <div className="financeiro-feedback success" role="status">{successMsg}</div>}
      {errorMsg && <div className="financeiro-feedback error" role="alert">{errorMsg}</div>}

      {renderContent()}

      {settlementCobranca && (
        <ManualSettlementModal
          isOpen={showManualSettlementModal}
          onClose={() => {
            setShowManualSettlementModal(false);
            setSettlementCobranca(null);
          }}
          cobranca={{
            id: settlementCobranca.id,
            valor: settlementCobranca.valor,
            descricao: settlementCobranca.descricao,
            pagadorNome: getCompanyName(settlementCobranca.clienteEmpresaId),
            pagadorCnpj: getCompanyDetails(settlementCobranca.clienteEmpresaId).cnpj,
            dataVencimento: settlementCobranca.dataVencimento,
            dataVencimentoFormatted: formatDate(settlementCobranca.dataVencimento),
            integracaoExterna: settlementCobranca.bankProvider === 'asaas',
          }}
          onSubmit={async (data) => {
            await handleBaixarManualCobrancaCustom({
              cobrancaId: settlementCobranca.id,
              ...data,
            });
          }}
          isLoading={isCustomSettlementLoading}
        />
      )}
    </div>
  );
};
