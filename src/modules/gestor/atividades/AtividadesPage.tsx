import React from 'react';
import { AbaMinhasAtividades } from './components/AbaMinhasAtividades';
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
  initialCompanyId?: string;
  initialCompetencia?: string;
}

  const VIEW_INFO: Record<string, { title: string; subtitle: string }> = {
  diarias: { title: 'Atividades Diárias', subtitle: 'Checklist de tarefas operacionais do dia.' },
  semanais: { title: 'Atividades Semanais', subtitle: 'Conciliações e rotinas da semana em andamento.' },
  mensais: { title: 'Atividades Mensais', subtitle: 'Acompanhe e monitore rotinas mensais por competência.' },
  empresa: { title: 'Atividades por Empresa', subtitle: 'Visualize o fechamento e as rotinas de cada cliente.' },
  funcionario: { title: 'Atividades por Funcionário', subtitle: 'Atribua e acompanhe rotinas de cada colaborador.' },
  internas: { title: 'Atividades Internas', subtitle: 'Atividades administrativas do escritório.' },
  rotinas: { title: 'Configuração de Rotinas', subtitle: 'Cadastre e gerencie os modelos operacionais padrão.' },
  controle: { title: 'Painel de Andamento', subtitle: 'Métricas e gráficos analíticos da operação.' },
};

export const AtividadesPage: React.FC<AtividadesPageProps> = ({
  view = 'diarias',
  initialCompanyId,
  initialCompetencia,
}) => {
  const currentInfo = VIEW_INFO[view] || VIEW_INFO.diarias;

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

  // Se o gestor selecionou uma empresa para detalhar e estamos na view 'empresa'
  if (view === 'empresa' && selectedGroup) {
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
    switch (view) {
      case 'diarias':
        return <AbaMinhasAtividades initialPeriodo="dia" />;
      case 'semanais':
        return <AbaMinhasAtividades initialPeriodo="semana" />;
      case 'mensais':
        return <AbaMinhasAtividades initialPeriodo="mes" />;
      case 'empresa':
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
      case 'funcionario':
        return <AbaGerirEquipe companyGroups={companyGroups} handleToggleStep={handleToggleStep} />;
      case 'internas':
        return <AbaMinhasAtividades initialPeriodo="semana" showInternasOnly={true} />;
      case 'rotinas':
        return <AbaRotinas />;
      case 'controle':
        return <AtividadesControle />;
      default:
        return <AbaMinhasAtividades initialPeriodo="dia" />;
    }
  };

  return (
    <div className="atividades-layout-container animate-fade-in" style={{ padding: '0px' }}>
      {/* Header Centralizado Light */}
      {view !== 'empresa' && (
        <div style={headerStyle}>
          <div>
            <h1 style={titleStyle}>{currentInfo.title}</h1>
            <p style={subtitleStyle}>{currentInfo.subtitle}</p>
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <main style={{ marginTop: view === 'empresa' ? '0px' : '20px' }}>
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
