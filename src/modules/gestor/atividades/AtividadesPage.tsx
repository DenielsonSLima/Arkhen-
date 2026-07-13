import React from 'react';
import { MinhaFilaAtividades, type MinhaFilaFiltro } from './components/MinhaFilaAtividades';
import { AbaGerirEquipe } from './components/AbaGerirEquipe';
import { AbaRotinas } from './components/AbaRotinas';
import { AtividadesPorEmpresa } from './por-empresa/AtividadesPorEmpresa';
import { AtividadeDetailView } from './components/AtividadeDetailView';
import { AtividadesControle } from './components/AtividadesControle';
import { useAtividades } from './hooks/useAtividades';
import { useAtividadesRealtime } from './hooks/useAtividadesRealtime';
import './Atividades.css';
import './AtividadesRedesign.css';

interface AtividadesPageProps {
  view?: string;
  initialQueueFilter?: MinhaFilaFiltro;
  initialCompanyId?: string;
  initialCompetencia?: string;
}

type AtividadesView = 'minha-fila' | 'equipe' | 'fechamentos' | 'modelos' | 'painel';

const LEGACY_VIEW_MAP: Record<string, { view: AtividadesView; filter?: MinhaFilaFiltro }> = {
  diarias: { view: 'minha-fila', filter: 'hoje' },
  semanais: { view: 'minha-fila', filter: 'semana' },
  mensais: { view: 'minha-fila', filter: 'mes' },
  internas: { view: 'minha-fila', filter: 'internas' },
  empresa: { view: 'fechamentos' },
  funcionario: { view: 'equipe' },
  rotinas: { view: 'modelos' },
  controle: { view: 'painel' },
};

const VIEW_INFO: Record<AtividadesView, { title: string; subtitle: string }> = {
  'minha-fila': { title: 'Minha Fila', subtitle: 'Tarefas operacionais por prazo, prioridade, status e bloqueios.' },
  equipe: { title: 'Equipe', subtitle: 'Acompanhe carga, atrasos, tarefas concluídas e pendências por colaborador.' },
  fechamentos: { title: 'Fechamentos de Clientes', subtitle: 'Visualize rotinas, competências e pendências de cada empresa.' },
  modelos: { title: 'Rotinas e Modelos', subtitle: 'Cadastre modelos de fechamento, rotinas internas e tarefas recorrentes.' },
  painel: { title: 'Painel Operacional', subtitle: 'Métricas de produtividade, gargalos, atrasos e clientes travados.' },
};

export const AtividadesPage: React.FC<AtividadesPageProps> = ({
  view = 'minha-fila',
  initialQueueFilter,
  initialCompanyId,
  initialCompetencia,
}) => {
  const normalized = LEGACY_VIEW_MAP[view] || { view: view as AtividadesView };
  const activeView: AtividadesView = VIEW_INFO[normalized.view] ? normalized.view : 'minha-fila';
  const currentInfo = VIEW_INFO[activeView];
  const queueFilter = initialQueueFilter || normalized.filter || 'hoje';

  // Carrega os estados originais do hook de atividades por empresa
  const {
    globalFilter,
    setGlobalFilter,
    companyGroups,
    isLoading,
    selectedGroup,
    setSelectedGroup,
    fechamentoMeta,
    handleSaveFechamentoMeta,
    handleToggleStep,
    handleSaveStepDate,
    handleSaveTaxValores,
    metrics,
    refresh,
  } = useAtividades({
    initialCompanyId,
    initialCompetencia,
  });

  useAtividadesRealtime(true, refresh);

  if (activeView === 'fechamentos' && selectedGroup) {
    return (
      <div className="atividades-layout-container animate-fade-in" style={{ padding: '0px' }}>
        <AtividadeDetailView
          selectedGroup={selectedGroup}
          onBack={() => setSelectedGroup(null)}
          competencia={selectedGroup.competencia}
          fechamentoMeta={fechamentoMeta}
          handleSaveFechamentoMeta={handleSaveFechamentoMeta}
          handleToggleStep={handleToggleStep}
          handleSaveStepDate={handleSaveStepDate}
          handleSaveTaxValores={handleSaveTaxValores}
        />
      </div>
    );
  }

  const renderViewContent = () => {
    switch (activeView) {
      case 'minha-fila':
        return <MinhaFilaAtividades initialFilter={queueFilter} />;
      case 'fechamentos':
        return (
          <AtividadesPorEmpresa
            globalFilter={globalFilter}
            setGlobalFilter={setGlobalFilter}
            companyGroups={companyGroups}
            isLoading={isLoading}
            setSelectedGroup={setSelectedGroup}
            metrics={metrics}
          />
        );
      case 'equipe':
        return <AbaGerirEquipe companyGroups={companyGroups} handleToggleStep={handleToggleStep} />;
      case 'modelos':
        return <AbaRotinas />;
      case 'painel':
        return <AtividadesControle />;
      default:
        return <MinhaFilaAtividades initialFilter={queueFilter} />;
    }
  };

  return (
    <div className="atividades-layout-container animate-fade-in" style={{ padding: '0px' }}>
      {/* Header Centralizado Light */}
      {activeView !== 'fechamentos' && (
        <div style={headerStyle}>
          <div>
            <h1 style={titleStyle}>{currentInfo.title}</h1>
            <p style={subtitleStyle}>{currentInfo.subtitle}</p>
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <main style={{ marginTop: activeView === 'fechamentos' ? '0px' : '20px' }}>
        {renderViewContent()}
      </main>
    </div>
  );
};

// Estilos de Layout Claro
const headerStyle = {
  borderBottom: '1px solid #e2e8f0',
  paddingBottom: '16px',
};

const titleStyle = {
  fontSize: '1.5rem',
  fontWeight: 700,
  color: '#0f172a',
  fontFamily: 'var(--font-sans)',
};

const subtitleStyle = {
  fontSize: '0.85rem',
  color: '#64748b',
  marginTop: '4px',
};
