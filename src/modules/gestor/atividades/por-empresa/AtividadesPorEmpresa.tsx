import React from 'react';
import { CalendarDays, Settings, Layers, AlertCircle, Clock, CheckCircle2, ClipboardList } from 'lucide-react';
import { CompanyActivityCard } from './CompanyActivityCard';

interface AtividadesPorEmpresaProps {
  globalFilter: 'todas' | 'pendentes' | 'andamento' | 'concluidas';
  setGlobalFilter: (filter: 'todas' | 'pendentes' | 'andamento' | 'concluidas') => void;
  companyGroups: any[];
  isLoading: boolean;
  setSelectedGroup: (group: any) => void;
  metrics: { total: number; completed: number; inProgress: number; pending: number };
  onShowConfig?: () => void;
}

export const AtividadesPorEmpresa: React.FC<AtividadesPorEmpresaProps> = ({
  globalFilter,
  setGlobalFilter,
  companyGroups,
  isLoading,
  setSelectedGroup,
  metrics,
  onShowConfig,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Filter Header */}
      <div className="atividades-filter-header" style={{ marginTop: 0 }}>
        <div className="atividades-title">
          <h2 style={{ color: '#0f172a', margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Atividades por Empresa</h2>
          <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '2px 0 0 0' }}>Painel operacional das rotinas de cada cliente por competência.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="competencia-auto-chip">
            <CalendarDays size={16} />
            <div>
              <span>Ciclo por empresa</span>
              <strong>Mês anterior</strong>
            </div>
          </div>

          {onShowConfig && (
            <button
              className="btn-add-user"
              onClick={onShowConfig}
              title="Gerir atividades e configurar fluxos"
              style={{ padding: '10px 14px', borderRadius: '8px' }}
            >
              <Settings size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Metrics Dashboard Row */}
      <div className="atividades-metrics-grid">
        <div className="atividade-metric-card gold">
          <span className="metric-label-small">Empresas Clientes</span>
          <span className="metric-value-large gold-text">{metrics.total}</span>
        </div>
        <div className="atividade-metric-card">
          <span className="metric-label-small">Concluídas</span>
          <span className="metric-value-large green-text">{metrics.completed}</span>
        </div>
        <div className="atividade-metric-card">
          <span className="metric-label-small">Em Andamento</span>
          <span className="metric-value-large orange-text">{metrics.inProgress}</span>
        </div>
        <div className="atividade-metric-card">
          <span className="metric-label-small">Pendentes</span>
          <span className="metric-value-large" style={{ color: '#0f172a' }}>{metrics.pending}</span>
        </div>
      </div>

      {/* Quick Filters Area */}
      <div className="atividades-tabs-container" style={{ alignSelf: 'flex-start', margin: '4px 0' }}>
        <button
          className={`atividades-tab-btn ${globalFilter === 'todas' ? 'active' : ''}`}
          onClick={() => setGlobalFilter('todas')}
        >
          <Layers size={14} style={{ opacity: 0.8 }} />
          Todas as Empresas
        </button>
        <button
          className={`atividades-tab-btn ${globalFilter === 'pendentes' ? 'active' : ''}`}
          onClick={() => setGlobalFilter('pendentes')}
        >
          <AlertCircle size={14} style={{ color: globalFilter === 'pendentes' ? '#ef4444' : '#94a3b8' }} />
          Pendentes
        </button>
        <button
          className={`atividades-tab-btn ${globalFilter === 'andamento' ? 'active' : ''}`}
          onClick={() => setGlobalFilter('andamento')}
        >
          <Clock size={14} style={{ color: globalFilter === 'andamento' ? '#f59e0b' : '#94a3b8' }} />
          Em Andamento
        </button>
        <button
          className={`atividades-tab-btn ${globalFilter === 'concluidas' ? 'active' : ''}`}
          onClick={() => setGlobalFilter('concluidas')}
        >
          <CheckCircle2 size={14} style={{ color: globalFilter === 'concluidas' ? '#10b981' : '#94a3b8' }} />
          Concluídas
        </button>
      </div>

      {/* Grid of Company Cards */}
      {isLoading ? (
        <div className="sub-loading">Carregando painel de fechamento...</div>
      ) : companyGroups.length === 0 ? (
        <div className="empty-state-card">
          <ClipboardList size={48} className="empty-state-icon" />
          <p>Nenhuma empresa encontrada com este filtro.</p>
        </div>
      ) : (
        <div className="models-preset-grid">
          {companyGroups.map((group) => (
            <CompanyActivityCard
              key={group.id}
              group={group}
              competencia={group.competencia}
              onSelect={() => setSelectedGroup(group)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
