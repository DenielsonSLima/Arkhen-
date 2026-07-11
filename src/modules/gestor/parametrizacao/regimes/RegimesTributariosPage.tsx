import React from 'react';
import {
  ShieldCheck,
  Info,
  Check,
  X,
  Award,
  Edit,
  Folder,
  FolderOpen,
  Briefcase,
  Layers,
  Percent,
  Scale,
  User,
  BadgeCheck,
} from 'lucide-react';
import { useRegimes } from './hooks/useRegimes';
import { FormCard } from '../../gestao-empresarial/forms/FormCard';
import { EditRegimeForm } from './forms/EditRegimeForm';
import '../../shared/RegimeBadges.css';

export const RegimesTributariosPage: React.FC = () => {
  const {
    regimes,
    activeRegimeId,
    setActiveRegimeId,
    activeRegime,
    isLoading,
    isSaving,
    editingRegime,
    setEditingRegime,
    showEditModal,
    setShowEditModal,
    successMsg,
    handleSaveRegime,
  } = useRegimes();

  // Mapeamento de ícones para cada regime
  const getRegimeIcon = (id: string, isActive: boolean) => {
    const size = 16;
    if (isActive) {
      switch (id) {
        case 'mei':
          return <Briefcase size={size} />;
        case 'simples':
          return <Layers size={size} />;
        case 'presumido':
          return <Percent size={size} />;
        case 'real':
          return <Scale size={size} />;
        case 'pf':
          return <User size={size} />;
        case 'isenta':
          return <BadgeCheck size={size} />;
        default:
          return <FolderOpen size={size} />;
      }
    } else {
      return <Folder size={size} style={{ opacity: 0.7 }} />;
    }
  };

  // Mapeamento de cores de borda
  const getRegimeBorderColor = (id: string) => {
    switch (id) {
      case 'mei':
        return '#2e7d32'; // Verde
      case 'simples':
        return '#4a148c'; // Roxo
      case 'presumido':
        return '#ed6c02'; // Laranja
      case 'real':
        return '#1976d2'; // Azul
      case 'pf':
        return '#aa7c28'; // Dourado/Gold
      case 'isenta':
        return '#0f766e'; // Teal
      default:
        return 'var(--color-gold-primary)';
    }
  };

  const getRegimeBadgeClass = (id: string) => {
    switch (id) {
      case 'mei':
        return 'mei';
      case 'simples':
        return 'simples';
      case 'presumido':
        return 'lucro-presumido';
      case 'real':
        return 'lucro-real';
      case 'pf':
        return 'pf';
      case 'isenta':
        return 'isenta';
      default:
        return 'default';
    }
  };

  return (
    <div className="submodule-content-card animate-fade-in">
      {/* Header */}
      <div className="table-actions-row">
        <div>
          <h2>Regimes Tributários (Enquadramentos)</h2>
          <p style={{ fontSize: '0.82rem', color: '#666', marginTop: '2px' }}>
            Consulte, organize e gerencie as regras, limites e características operacionais de cada regime tributário brasileiro.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="success-banner" style={{ marginTop: '12px' }}>
          {successMsg}
        </div>
      )}

      {/* Tabs / "Pastas Tributárias" Navigation */}
      <div
        className="parceiros-controls-bar"
        style={{
          marginTop: '16px',
          padding: '8px 12px 0 12px',
          border: '1px solid #eef1f5',
          borderBottom: 'none',
          backgroundColor: '#fafbfc',
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
          display: 'flex',
          gap: '4px',
          overflowX: 'auto',
        }}
      >
        {regimes.map((regime) => {
          const isActive = regime.id === activeRegimeId;
          const activeBorderColor = getRegimeBorderColor(regime.id);

          return (
            <button
              key={regime.id}
              className={`btn-tab ${isActive ? 'active' : ''}`}
              onClick={() => setActiveRegimeId(regime.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderTopLeftRadius: '6px',
                borderTopRightRadius: '6px',
                border: isActive ? '1px solid #eef1f5' : '1px solid transparent',
                borderBottomColor: isActive ? '#fff' : 'transparent',
                marginBottom: isActive ? '-1px' : '0',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--color-text-dark)' : '#666',
                background: isActive ? '#fff' : 'transparent',
                boxShadow: isActive ? `inset 0 3px 0 ${activeBorderColor}, 0 -1px 8px rgba(15, 23, 42, 0.04)` : 'none',
                transition: 'all 0.2s',
              }}
            >
              {getRegimeIcon(regime.id, isActive)}
              <span>{regime.title.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Display */}
      {isLoading ? (
        <div className="sub-loading" style={{ padding: '40px', textAlign: 'center' }}>
          Carregando informações do regime...
        </div>
      ) : activeRegime ? (
        <div
          className="partner-card animate-fade-in"
          style={{
            borderTop: `5px solid ${getRegimeBorderColor(activeRegime.id)}`,
            borderTopLeftRadius: '0',
            borderTopRightRadius: '0',
            backgroundColor: '#fff',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
            padding: '24px',
            marginTop: '0',
            borderLeft: '1px solid #eef1f5',
            borderRight: '1px solid #eef1f5',
            borderBottom: '1px solid #eef1f5',
          }}
        >
          {/* Header do Regime */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className={`partner-badge ${getRegimeBadgeClass(activeRegime.id)}`} style={{ fontSize: '0.78rem', padding: '4px 10px' }}>
                  {activeRegime.id.toUpperCase()}
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#555' }}>
                  Limite de Faturamento: <strong className="gold-text">{activeRegime.limit}</strong>
                </span>
              </div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '8px 0 4px 0', color: 'var(--color-text-dark)' }}>
                {activeRegime.title}
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.5', marginTop: '6px' }}>
                {activeRegime.desc}
              </p>
            </div>
            
            <button
              className="btn-add-user"
              onClick={() => {
                setEditingRegime(activeRegime);
                setShowEditModal(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Edit size={16} /> Editar Regime
            </button>
          </div>

          <div className="form-row-grid" style={{ marginTop: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {/* Positivos (O que tem / Vantagens) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                backgroundColor: 'rgba(46, 125, 50, 0.02)',
                border: '1px solid rgba(46, 125, 50, 0.08)',
                borderRadius: '8px',
                padding: '16px',
              }}
            >
              <strong style={{ fontSize: '0.85rem', color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(46, 125, 50, 0.1)', paddingBottom: '8px' }}>
                <ShieldCheck size={16} /> Vantagens e Pontos Fortes (O que tem)
              </strong>
              {activeRegime.positives.length === 0 ? (
                <span style={{ fontSize: '0.78rem', color: '#888', fontStyle: 'italic' }}>Nenhuma vantagem cadastrada.</span>
              ) : (
                activeRegime.positives.map((pos, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', fontSize: '0.8rem', color: '#334155', lineHeight: '1.4' }}>
                    <Check size={14} style={{ color: '#2e7d32', marginTop: '2px', flexShrink: 0 }} />
                    <span>{pos}</span>
                  </div>
                ))
              )}
            </div>

            {/* Negativos (O que não tem / Restrições) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                backgroundColor: 'rgba(198, 40, 40, 0.02)',
                border: '1px solid rgba(198, 40, 40, 0.08)',
                borderRadius: '8px',
                padding: '16px',
              }}
            >
              <strong style={{ fontSize: '0.85rem', color: '#c62828', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(198, 40, 40, 0.1)', paddingBottom: '8px' }}>
                <Info size={16} /> Restrições e Pontos Fracos (O que não tem)
              </strong>
              {activeRegime.negatives.length === 0 ? (
                <span style={{ fontSize: '0.78rem', color: '#888', fontStyle: 'italic' }}>Nenhuma restrição cadastrada.</span>
              ) : (
                activeRegime.negatives.map((neg, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', fontSize: '0.8rem', color: '#334155', lineHeight: '1.4' }}>
                    <X size={14} style={{ color: '#c62828', marginTop: '2px', flexShrink: 0 }} />
                    <span>{neg}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-state-card" style={{ marginTop: '20px' }}>
          <p>Nenhum regime tributário selecionado.</p>
        </div>
      )}

      {/* Info Banner Geral */}
      <div className="alert-banner" style={{ marginTop: '24px', display: 'flex', gap: '12px', backgroundColor: 'rgba(197, 146, 53, 0.05)', border: '1px solid var(--color-gold-primary)', color: 'var(--color-gold-dark)' }}>
        <Award size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
          <strong>Aviso de Planejamento Tributário:</strong> A escolha do melhor enquadramento depende de projeções de faturamento, despesas operacionais e folha de pagamento. Sempre simule os cenários detalhados no módulo de <strong>Planejamento Tributário</strong> antes de realizar a opção definitiva junto à Receita Federal.
        </div>
      </div>

      {/* Edit Modal Popup */}
      {showEditModal && editingRegime && (
        <FormCard
          title={`Editar Regime: ${editingRegime.title.split(' ')[0]}`}
          containerClassName="regime-editor-modal"
          onClose={() => {
            setShowEditModal(false);
            setEditingRegime(null);
          }}
        >
          <EditRegimeForm
            regime={editingRegime}
            onSave={handleSaveRegime}
            onCancel={() => {
              setShowEditModal(false);
              setEditingRegime(null);
            }}
            isSaving={isSaving}
          />
        </FormCard>
      )}
    </div>
  );
};
