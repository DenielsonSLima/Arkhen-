import React, { useMemo, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  MinusCircle,
  PlusCircle,
  RefreshCw,
} from 'lucide-react';
import { useFinanceiro } from './hooks/useFinanceiro';
import { CaixaTab } from './components/CaixaTab';
import { ContasAReceberTab } from './components/ContasAReceberTab';
import { ContasAPagarTab } from './components/ContasAPagarTab';
import { TransferenciaEntreContasTab } from './components/TransferenciaEntreContasTab';
import { OutrosCreditosTab } from './components/OutrosCreditosTab';
import { OutrosDebitosTab } from './components/OutrosDebitosTab';
import './Financeiro.css';

type FinanceiroTab =
  | 'caixa'
  | 'receber'
  | 'pagar'
  | 'transferencia'
  | 'outros-creditos'
  | 'outros-debitos';

const FINANCEIRO_TABS: { id: FinanceiroTab; label: string; icon: React.ReactNode }[] = [
  { id: 'caixa', label: 'Caixa', icon: <Banknote size={16} /> },
  { id: 'receber', label: 'Contas a Receber', icon: <ArrowUpCircle size={16} /> },
  { id: 'pagar', label: 'Contas a Pagar', icon: <ArrowDownCircle size={16} /> },
  { id: 'transferencia', label: 'Transferência entre Contas', icon: <RefreshCw size={16} /> },
  { id: 'outros-creditos', label: 'Outros Créditos', icon: <PlusCircle size={16} /> },
  { id: 'outros-debitos', label: 'Outros Débitos', icon: <MinusCircle size={16} /> },
];

export const FinanceiroPage: React.FC = () => {
  const { filteredCobranças, stats, companyMap, isLoading } = useFinanceiro();
  const [activeTab, setActiveTab] = useState<FinanceiroTab>('caixa');

  const contasReceber = useMemo(() => filteredCobranças, [filteredCobranças]);

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatDate = (value: string) => {
    const parts = value.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
  };

  const getCompanyName = (companyId: string) => companyMap.get(companyId)?.nome || 'Cliente removido';

  const renderContent = () => {
    if (isLoading) return <div className="sub-loading">Carregando controle financeiro...</div>;

    if (activeTab === 'receber') {
      return (
        <ContasAReceberTab
          dados={contasReceber}
          onFormatCurrency={formatCurrency}
          onFormatDate={formatDate}
          getCompanyName={getCompanyName}
        />
      );
    }

    if (activeTab === 'pagar') {
      return <ContasAPagarTab onFormatCurrency={formatCurrency} onFormatDate={formatDate} />;
    }

    if (activeTab === 'transferencia') {
      return <TransferenciaEntreContasTab onFormatCurrency={formatCurrency} onFormatDate={formatDate} />;
    }

    if (activeTab === 'outros-creditos') {
      return <OutrosCreditosTab onFormatCurrency={formatCurrency} onFormatDate={formatDate} />;
    }

    if (activeTab === 'outros-debitos') {
      return <OutrosDebitosTab onFormatCurrency={formatCurrency} onFormatDate={formatDate} />;
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
    </div>
  );
};
