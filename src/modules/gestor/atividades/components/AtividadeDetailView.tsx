import React, { useState } from 'react';
import { ArrowLeft, ShieldCheck, Users, UserCheck, Receipt, Calendar as CalendarIcon, Hammer, ClipboardList } from 'lucide-react';
import type { CompanyActivityGroup } from '../hooks/useAtividades';
import type { ValoresCompetenciaAtividade } from '../services/atividadesService';
import { renderCompanyLogo } from '../por-empresa/CompanyActivityCard';
import { ResumoAuditoriaTab } from './ResumoAuditoriaTab';
import { ChecklistTab } from './ChecklistTab';

interface AtividadeDetailViewProps {
  selectedGroup: CompanyActivityGroup;
  onBack: () => void;
  competencia: string;
  fechamentoMeta: { finalizado: boolean; dataHora: string; usuario: string } | null;
  handleSaveFechamentoMeta: (meta: { finalizado: boolean; dataHora: string; usuario: string }) => Promise<void>;
  handleToggleStep: (instanciaId: string, etapa: string, value: boolean) => Promise<void>;
  handleSaveStepDate: (instanciaId: string, etapa: string, dateStr: string) => Promise<void>;
  handleSaveTaxValores: (instanciaId: string, valores: ValoresCompetenciaAtividade) => Promise<void>;
}

export const getActivityIcon = (modeloId: string, status: string, size = 15) => {
  let color = '#94a3b8'; // pending gray
  if (status === 'Concluída') color = '#10b981'; // emerald green
  else if (status === 'Em andamento') color = '#f59e0b'; // amber orange
  else if (status === 'Pendente') color = '#ef4444'; // rose red

  switch (modeloId) {
    case 'folha':
    case 'folha-pagamento':
      return <Users size={size} style={{ color }} />;
    case 'prolabore':
    case 'pro-labore':
      return <UserCheck size={size} style={{ color }} />;
    case 'dctfweb':
    case 'dctfweb-tributos-federais':
      return <Receipt size={size} style={{ color }} />;
    case 'obrigacoes':
    case 'obrigacoes-mensais':
      return <CalendarIcon size={size} style={{ color }} />;
    case 'obras':
      return <Hammer size={size} style={{ color }} />;
    default:
      return <ClipboardList size={size} style={{ color }} />;
  }
};

export const AtividadeDetailView: React.FC<AtividadeDetailViewProps> = ({
  selectedGroup,
  onBack,
  competencia,
  fechamentoMeta,
  handleSaveFechamentoMeta,
  handleToggleStep,
  handleSaveStepDate,
  handleSaveTaxValores,
}) => {
  const [activeDetailTab, setActiveDetailTab] = useState('resumo');

  // SVG Circular progress math
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (selectedGroup.progressoGeral / 100) * circumference;

  return (
    <div className="atividades-layout-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Voltar & Breadcrumbs Bar */}
      <div className="atividades-filter-header" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              className="btn-add-user"
              onClick={onBack}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', color: '#0f172a', border: '1px solid #e2e8f0', boxShadow: 'none' }}
            >
            <ArrowLeft size={16} /> Voltar para Atividades
            </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#64748b' }}>
            <span>Painel</span>
            <span>/</span>
            <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedGroup.clienteNome}</span>
          </div>
        </div>
      </div>

      {/* 2. Premium Full-Width Header Banner */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '20px'
      }}>
        {/* Left Side: Logo & Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: '1 1 300px' }}>
          {renderCompanyLogo(selectedGroup.logo, selectedGroup.clienteNome, selectedGroup.regime, 'large')}
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: '1.2' }}>
              {selectedGroup.clienteNome}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              <span className={`partner-badge ${selectedGroup.regime === 'Simples Nacional' ? 'mei' : selectedGroup.regime === 'Lucro Presumido' ? 'lucro-presumido' : 'lucro-real'}`} style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                {selectedGroup.regime}
              </span>
              {fechamentoMeta?.finalizado && (
                <span style={{ color: '#2e7d32', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(76, 175, 80, 0.08)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(76, 175, 80, 0.15)' }}>
                  <ShieldCheck size={12} /> Homologado
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Middle Side: Horizontal Metadata Info */}
        <div className="detail-meta-horizontal" style={{
          display: 'flex',
          gap: '24px',
          flex: '1 1 350px',
          borderLeft: '1px solid #f1f5f9',
          borderRight: '1px solid #f1f5f9',
          padding: '0 24px',
          fontSize: '0.85rem',
          color: '#475569',
          justifyContent: 'space-around'
        }}>
          <div>
            <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>CNPJ</span>
            <strong style={{ color: '#0f172a' }}>{selectedGroup.cnpj}</strong>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Competência</span>
            <strong style={{ color: '#0f172a' }}>{competencia}</strong>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Responsável</span>
            <strong style={{ color: '#0f172a' }}>{selectedGroup.responsavel}</strong>
          </div>
        </div>

        {/* Right Side: Circular Progress Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: '0 0 200px', justifyContent: 'flex-end' }}>
          <div style={{ position: 'relative', width: '56px', height: '56px' }}>
            <svg style={{ transform: 'rotate(-90deg)', width: '56px', height: '56px' }}>
              <circle
                cx="28"
                cy="28"
                r={radius}
                stroke="#f1f5f9"
                strokeWidth="5"
                fill="transparent"
              />
              <circle
                cx="28"
                cy="28"
                r={radius}
                stroke={selectedGroup.progressoGeral === 100 ? '#10b981' : 'var(--color-gold-primary)'}
                strokeWidth="5"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
              />
            </svg>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#0f172a'
            }}>
              {selectedGroup.progressoGeral}%
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>
              Progresso
            </span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: selectedGroup.progressoGeral === 100 ? '#2e7d32' : 'var(--color-gold-dark)' }}>
              {selectedGroup.progressoGeral === 100 ? 'Tudo Concluído' : 'Em andamento'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Workspace Area: Tabs and Tab Contents */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Tab navigation */}
        <div className="atividades-tabs-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          <button
            className={`atividades-tab-btn ${activeDetailTab === 'resumo' ? 'active' : ''}`}
            onClick={() => setActiveDetailTab('resumo')}
          >
            <ShieldCheck size={15} style={{ color: activeDetailTab === 'resumo' ? '#aa7c28' : '#64748b' }} />
            Resumo & Auditoria
          </button>
          {selectedGroup.atividades.map((atv) => (
            <button
              key={atv.instanciaId}
              className={`atividades-tab-btn ${activeDetailTab === atv.modeloId ? 'active' : ''}`}
              onClick={() => setActiveDetailTab(atv.modeloId)}
            >
              {getActivityIcon(atv.modeloId, atv.status)}
              {atv.modeloNome}
            </button>
          ))}
        </div>

        {/* Tab Content rendering */}
        {activeDetailTab === 'resumo' ? (
          <ResumoAuditoriaTab
            selectedGroup={selectedGroup}
            competencia={competencia}
            fechamentoMeta={fechamentoMeta}
            handleSaveFechamentoMeta={handleSaveFechamentoMeta}
            getActivityIcon={getActivityIcon}
            onSelectTab={setActiveDetailTab}
          />
        ) : (
          selectedGroup.atividades.map((atv) => {
            if (activeDetailTab !== atv.modeloId) return null;
            return (
              <ChecklistTab
                key={atv.instanciaId}
                atv={atv}
                handleToggleStep={handleToggleStep}
                handleSaveStepDate={handleSaveStepDate}
                handleSaveTaxValores={handleSaveTaxValores}
              />
            );
          })
        )}
      </div>
    </div>
  );
};
