import React, { useMemo, useState, useEffect } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  Receipt,
} from 'lucide-react';
import { useFinanceiro } from './hooks/useFinanceiro';
import { useFinanceiroRealtime } from './hooks/useFinanceiroRealtime';
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
};

export const FinanceiroPage: React.FC<FinanceiroPageProps> = ({ initialTab }) => {
  useFinanceiroRealtime();
  const {
    filteredCobranças,
    stats,
    companyMap,
    isLoading,
    lancamentos,
    contasPagar,
    handleCreateLancamento,
    showManualSettlementModal,
    setShowManualSettlementModal,
    settlementCobranca,
    setSettlementCobranca,
    handleBaixarManualCobrancaCustom,
    isCustomSettlementLoading,
  } = useFinanceiro();
  const [activeTab, setActiveTab] = useState<FinanceiroTab>('caixa');

  useEffect(() => {
    if (initialTab) {
      const tabId = initialTab.startsWith('lancamentos-') || initialTab === 'transferencia' || initialTab === 'creditos' || initialTab === 'debitos' || initialTab === 'transferencias'
        ? 'lancamentos'
        : (initialTab === 'receber' ? 'receber' : initialTab === 'pagar' ? 'pagar' : 'caixa');
      setActiveTab(tabId as FinanceiroTab);
    }
  }, [initialTab]);

  const contasReceber = useMemo(() => filteredCobranças, [filteredCobranças]);

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatDate = (value: string) => {
    const parts = value.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
  };

  const getCompanyName = (companyId: string) => companyMap.get(companyId)?.nome || 'Cliente removido';
  const getCompanyDetails = (companyId: string) => companyMap.get(companyId) || { nome: 'Cliente removido', cnpj: '-' };

  const renderContent = () => {
    if (isLoading) return <div className="sub-loading">Carregando controle financeiro...</div>;

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
