import React, { useState, useRef } from 'react';
import { Calculator, Clock, User, Pencil } from 'lucide-react';
import type { CompanyActivity } from '../hooks/useAtividades';

interface ChecklistTabProps {
  atv: CompanyActivity;
  handleToggleStep: (instanciaId: string, etapa: string, value: boolean) => Promise<void>;
  handleSaveStepDate: (instanciaId: string, etapa: string, dateStr: string) => Promise<void>;
  handleSaveTaxValores: (instanciaId: string, valores: { valorInss: number; valorIrrf: number; valorReinf: number }) => Promise<void>;
}

// Sub-componente que exibe o badge de conclusão sem o input nativo visível
interface CheckedBadgeProps {
  etapa: string;
  instanciaId: string;
  userName?: string;
  dateValue?: string;
  onSaveDate: (instanciaId: string, etapa: string, dateStr: string) => Promise<void>;
}

const CheckedBadge: React.FC<CheckedBadgeProps> = ({ etapa, instanciaId, userName, dateValue, onSaveDate }) => {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatDate = (val?: string) => {
    if (!val) return '—';
    try {
      const d = new Date(val);
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return val;
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSaveDate(instanciaId, etapa, e.target.value);
    setEditing(false);
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flex: '0 0 auto',
        backgroundColor: '#ffffff',
        border: '1px solid #cbd5e1',
        padding: '4px 10px',
        borderRadius: '6px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        flexWrap: 'nowrap',
      }}
    >
      {/* Usuário que marcou */}
      {userName && (
        <span style={{ fontSize: '0.72rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, paddingRight: '8px', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
          <User size={11} style={{ color: 'var(--color-gold-primary)', flexShrink: 0 }} />
          {userName}
        </span>
      )}
      {/* Data/hora — texto formatado */}
      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, whiteSpace: 'nowrap' }}>
        <Clock size={11} style={{ color: 'var(--color-gold-primary)', flexShrink: 0 }} />
        Feito em: <strong style={{ color: '#334155', marginLeft: '2px' }}>{formatDate(dateValue)}</strong>
      </span>
      {/* Botão para editar data — mostra o input escondido ao clicar */}
      <button
        type="button"
        onClick={handleEditClick}
        title="Editar data/hora"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', display: 'flex', alignItems: 'center', color: '#94a3b8' }}
      >
        <Pencil size={11} />
      </button>
      {editing && (
        <input
          ref={inputRef}
          type="datetime-local"
          defaultValue={dateValue || ''}
          onBlur={() => setEditing(false)}
          onChange={handleChange}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
        />
      )}
    </div>
  );
};


export const ChecklistTab: React.FC<ChecklistTabProps> = ({
  atv,
  handleToggleStep,
  handleSaveStepDate,
  handleSaveTaxValores,
}) => {
  // States for tax inputs
  const [valInss, setValInss] = useState('0.00');
  const [valIrrf, setValIrrf] = useState('0.00');
  const [valReinf, setValReinf] = useState('0.00');
  const [isEditingTax, setIsEditingTax] = useState(false);

  // Open tax values editor
  const openTaxEditor = () => {
    setIsEditingTax(true);
    setValInss(atv.valores?.valorInss?.toString() || '0.00');
    setValIrrf(atv.valores?.valorIrrf?.toString() || '0.00');
    setValReinf(atv.valores?.valorReinf?.toString() || '0.00');
  };

  const handleSaveTax = (e: React.FormEvent) => {
    e.preventDefault();
    handleSaveTaxValores(atv.instanciaId, {
      valorInss: parseFloat(valInss) || 0,
      valorIrrf: parseFloat(valIrrf) || 0,
      valorReinf: parseFloat(valReinf) || 0,
    });
    setIsEditingTax(false);
  };

  const formatCurrency = (val?: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0);
  };

  return (
    <div className="tab-pane animate-fade-in" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)' }}>
      {/* Tab Title Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
          Etapas de Fechamento: {atv.modeloNome}
        </h3>
        <span className={`table-badge ${atv.status === 'Concluída' ? 'badge-status-concl' : atv.status === 'Em andamento' ? 'badge-status-and' : 'badge-status-p'}`}>
          {atv.status} ({atv.progresso}%)
        </span>
      </div>

      {/* Inline values editor (DCTFWeb) */}
      {atv.modeloId === 'dctfweb' && (
        <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
            <Calculator size={14} style={{ color: 'var(--color-gold-primary)' }} />
            Valores Consolidados de Tributos
          </span>

          {isEditingTax ? (
            <form onSubmit={handleSaveTax} className="config-form" style={{ padding: 0, margin: 0, border: 'none', background: 'none' }}>
              <div className="form-row-grid" style={{ gap: '10px', gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div className="form-item-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.72rem', color: '#475569' }}>INSS (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={valInss}
                    onChange={(e) => setValInss(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                </div>
                <div className="form-item-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.72rem', color: '#475569' }}>IRRF (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={valIrrf}
                    onChange={(e) => setValIrrf(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                </div>
                <div className="form-item-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.72rem', color: '#475569' }}>REINF (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={valReinf}
                    onChange={(e) => setValReinf(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button type="button" className="btn-cancel" onClick={() => setIsEditingTax(false)} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                  Cancelar
                </button>
                <button type="submit" className="btn-save-settings" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                  Salvar Alterações
                </button>
              </div>
            </form>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '0.78rem' }}>
                <div>INSS: <strong style={{ color: 'var(--color-gold-dark)', display: 'block', fontSize: '0.95rem', marginTop: '2px' }}>{formatCurrency(atv.valores?.valorInss)}</strong></div>
                <div>IRRF: <strong style={{ color: 'var(--color-gold-dark)', display: 'block', fontSize: '0.95rem', marginTop: '2px' }}>{formatCurrency(atv.valores?.valorIrrf)}</strong></div>
                <div>REINF: <strong style={{ color: 'var(--color-gold-dark)', display: 'block', fontSize: '0.95rem', marginTop: '2px' }}>{formatCurrency(atv.valores?.valorReinf)}</strong></div>
              </div>
              <button
                type="button"
                className="btn-save-settings"
                style={{ marginTop: '12px', padding: '6px 12px', fontSize: '0.72rem' }}
                onClick={openTaxEditor}
              >
                Lançar / Editar Valores Fiscais
              </button>
            </div>
          )}
        </div>
      )}

      {/* Checklist items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {Object.keys(atv.checklists).map((etapa) => {
          const checked = atv.checklists[etapa];
          return (
            <div
              key={etapa}
              className={`checklist-step-row ${checked ? 'completed' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                gap: '10px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                backgroundColor: checked ? '#f0fdf4' : '#ffffff',
                transition: 'all 0.2s',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 250px' }}>
                <input
                  type="checkbox"
                  id={`step-${atv.instanciaId}-${etapa}`}
                  checked={checked}
                  onChange={(e) => handleToggleStep(atv.instanciaId, etapa, e.target.checked)}
                  style={{
                    width: '16px',
                    height: '16px',
                    accentColor: 'var(--color-gold-primary)',
                    cursor: 'pointer'
                  }}
                />
                <label
                  htmlFor={`step-${atv.instanciaId}-${etapa}`}
                  style={{ fontSize: '0.82rem', fontWeight: 500, color: '#0f172a', cursor: 'pointer', flex: 1 }}
                >
                  {etapa}
                </label>
              </div>

              {checked && (
                <CheckedBadge
                  etapa={etapa}
                  instanciaId={atv.instanciaId}
                  userName={atv.checklistUsers?.[etapa]}
                  dateValue={atv.checklistDates?.[etapa]}
                  onSaveDate={handleSaveStepDate}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
