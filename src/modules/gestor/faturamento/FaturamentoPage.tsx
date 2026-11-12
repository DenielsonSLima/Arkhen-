import { NationalReviewsTab } from './components/NationalReviewsTab';
import React, { useState } from 'react';
import { DashboardMesTab } from './components/DashboardMesTab';
import { RecorrenciasTab } from './components/RecorrenciasTab';
import { HistoricoNfseTab } from './components/HistoricoNfseTab';
import { InadimplenciaTab } from './components/InadimplenciaTab';
import { HistoricoFinanceiroTab } from './components/HistoricoFinanceiroTab';
import { ModelosTab } from './components/ModelosTab';
import { ConfiguracoesTab } from './components/ConfiguracoesTab';
import { ModalNovoLancamentoAvulso } from './components/ModalNovoLancamentoAvulso';
import { Calendar, Repeat, Search, AlertCircle, Activity, Plus, Settings, Files } from 'lucide-react';
import { useFaturamentoRealtime } from './hooks/useFaturamentoRealtime';
import type { InternalTabContext } from '../../../stores/internalTabsStore';
import './Faturamento.css';

export type FaturamentoTab = 'dashboard' | 'recorrencias' | 'historico-nfse' | 'inadimplencia' | 'historico-financeiro' | 'configuracoes' | 'modelos' | 'national-reviews';
export type FaturamentoViewMode = 'default';

interface FaturamentoPageProps {
  initialActiveTab?: FaturamentoTab;
  initialViewMode?: FaturamentoViewMode;
  onViewContextChange?: (context: InternalTabContext) => void;
}

export const FaturamentoPage: React.FC<FaturamentoPageProps> = ({
  initialActiveTab = 'dashboard',
  onViewContextChange
}) => {
  useFaturamentoRealtime();
  const [activeTab, setActiveTab] = useState<FaturamentoTab>(initialActiveTab);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const onViewContextChangeRef = React.useRef(onViewContextChange);

  // GestorModuleContent cria a ponte de contexto durante o render. Manter essa
  // função diretamente nas dependências do efeito formava um ciclo ao abrir o
  // módulo em uma aba interna: contexto -> render do pai -> nova função -> efeito.
  React.useLayoutEffect(() => {
    onViewContextChangeRef.current = onViewContextChange;
  }, [onViewContextChange]);

  React.useEffect(() => {
    onViewContextChangeRef.current?.({ data: { activeTab } });
  }, [activeTab]);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <Activity size={16} /> },
    { id: 'recorrencias', label: 'Recorrências', icon: <Repeat size={16} /> },
    { id: 'national-reviews', label: 'Revisões nacionais', icon: <Files size={16} /> },
    { id: 'historico-nfse', label: 'Histórico NFS-e', icon: <Search size={16} /> },
    { id: 'inadimplencia', label: 'Inadimplência', icon: <AlertCircle size={16} /> },
    { id: 'historico-financeiro', label: 'Financeiro', icon: <Calendar size={16} /> },
    { id: 'modelos', label: 'Modelos', icon: <Files size={16} /> },
    { id: 'configuracoes', label: 'Configurações', icon: <Settings size={16} /> },
  ];

  return (
    <div className="faturamento-container animate-page-fade">
      <header className="faturamento-header">
        <h1>Faturamento e Cobranças</h1>
      </header>

      <div className="faturamento-toolbar">
        <nav className="tab-buttons-header faturamento-tabs-scroll" aria-label="Seções de faturamento">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as FaturamentoTab)}
              type="button"
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`btn-tab ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.icon} <span>{tab.label}</span>
            </button>
          ))}
        </nav>
        <button type="button" onClick={() => setIsModalOpen(true)} className="faturamento-btn-primary faturamento-new-entry">
          <Plus size={16} /> Novo Lançamento
        </button>
      </div>

      <div className="faturamento-content">
        {activeTab === 'national-reviews' && <NationalReviewsTab />}
        {activeTab === 'dashboard' && <DashboardMesTab />}
        {activeTab === 'recorrencias' && <RecorrenciasTab />}
        {activeTab === 'historico-nfse' && <HistoricoNfseTab />}
        {activeTab === 'inadimplencia' && <InadimplenciaTab />}
        {activeTab === 'historico-financeiro' && <HistoricoFinanceiroTab />}
        {activeTab === 'modelos' && <ModelosTab onOpenSettings={() => setActiveTab('configuracoes')} />}
        {activeTab === 'configuracoes' && <ConfiguracoesTab />}
      </div>

      <ModalNovoLancamentoAvulso isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
