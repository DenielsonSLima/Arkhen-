import React, { useState } from 'react';
import { DashboardMesTab } from './components/DashboardMesTab';
import { RecorrenciasTab } from './components/RecorrenciasTab';
import { HistoricoNfseTab } from './components/HistoricoNfseTab';
import { InadimplenciaTab } from './components/InadimplenciaTab';
import { HistoricoFinanceiroTab } from './components/HistoricoFinanceiroTab';
import { ConfiguracoesTab } from './components/ConfiguracoesTab';
import { ModalNovoLancamentoAvulso } from './components/ModalNovoLancamentoAvulso';
import { Calendar, Repeat, Search, AlertCircle, Activity, Plus, Settings } from 'lucide-react';
import './Faturamento.css';

export type FaturamentoTab = 'dashboard' | 'recorrencias' | 'historico-nfse' | 'inadimplencia' | 'historico-financeiro' | 'configuracoes';
export type FaturamentoViewMode = 'default';

interface FaturamentoPageProps {
  initialActiveTab?: FaturamentoTab;
  initialViewMode?: FaturamentoViewMode;
  onViewContextChange?: (context: any) => void;
}

export const FaturamentoPage: React.FC<FaturamentoPageProps> = ({
  initialActiveTab = 'dashboard',
  onViewContextChange
}) => {
  const [activeTab, setActiveTab] = useState<FaturamentoTab>(initialActiveTab);
  const [isModalOpen, setIsModalOpen] = useState(false);

  React.useEffect(() => {
    if (onViewContextChange) {
      onViewContextChange({ data: { activeTab } });
    }
  }, [activeTab, onViewContextChange]);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <Activity size={16} /> },
    { id: 'recorrencias', label: 'Recorrências', icon: <Repeat size={16} /> },
    { id: 'historico-nfse', label: 'Histórico NFS-e', icon: <Search size={16} /> },
    { id: 'inadimplencia', label: 'Inadimplência', icon: <AlertCircle size={16} /> },
    { id: 'historico-financeiro', label: 'Financeiro', icon: <Calendar size={16} /> },
    { id: 'configuracoes', label: 'Configurações', icon: <Settings size={16} /> },
  ];

  return (
    <div className="faturamento-container animate-page-fade">
      <div className="faturamento-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Faturamento e Cobranças</h1>
          <p>Gestão de notas fiscais, contratos e inadimplência</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="faturamento-btn-primary">
          <Plus size={16} />
          Novo Lançamento
        </button>
      </div>

      <div className="tab-buttons-header faturamento-tabs-scroll">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as FaturamentoTab)}
            className={`btn-tab ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.icon} <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="faturamento-content">
        {activeTab === 'dashboard' && <DashboardMesTab />}
        {activeTab === 'recorrencias' && <RecorrenciasTab />}
        {activeTab === 'historico-nfse' && <HistoricoNfseTab />}
        {activeTab === 'inadimplencia' && <InadimplenciaTab />}
        {activeTab === 'historico-financeiro' && <HistoricoFinanceiroTab />}
        {activeTab === 'configuracoes' && <ConfiguracoesTab />}
      </div>

      <ModalNovoLancamentoAvulso isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
