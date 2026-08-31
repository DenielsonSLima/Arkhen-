import React from 'react';
import { Plus } from 'lucide-react';
import { REGIMES_APLICAVEIS } from '../defaultChecklistModels';

export interface NovoModeloFormState {
  nome: string;
  descricao: string;
  etapas: string;
  tipos: string[];
}

interface NovoModeloFormModalProps {
  model: NovoModeloFormState;
  onChange: (changes: Partial<NovoModeloFormState>) => void;
  onToggleTipo: (tipo: string, checked: boolean) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export const NovoModeloFormModal: React.FC<NovoModeloFormModalProps> = ({
  model,
  onChange,
  onToggleTipo,
  onCancel,
  onSubmit,
}) => (
  <div
    className="confirm-modal-backdrop config-fluxos-modal"
    onClick={onCancel}
    style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
  >
    <div
      className="animate-slide-up"
      role="dialog"
      aria-modal="true"
      aria-labelledby="novo-modelo-title"
      onClick={(event) => event.stopPropagation()}
      style={{
        width: 'min(860px, 100%)',
        maxHeight: '90vh',
        overflowY: 'auto',
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 24px 70px rgba(15, 23, 42, 0.28)',
        padding: '24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
        <div>
          <h3 id="novo-modelo-title" style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--color-text-dark)' }}>
            Criar modelo de fechamento
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '6px 0 0 0' }}>
            Cadastre as etapas do fechamento e defina a quais regimes o modelo pode ser vinculado.
          </p>
        </div>
        <button
          type="button"
          className="btn-save-settings"
          onClick={onCancel}
          style={{ background: '#64748b', minWidth: 42, padding: '8px 10px' }}
          aria-label="Fechar modal"
        >
          ×
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 0.85fr) minmax(280px, 1fr)', gap: '14px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label htmlFor="novo-modelo-nome" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Nome do modelo</label>
          <input
            id="novo-modelo-nome"
            type="text"
            value={model.nome}
            onChange={(event) => onChange({ nome: event.target.value })}
            placeholder="Ex.: Admissão de Funcionário"
            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', color: '#111827', background: '#fff' }}
            autoFocus
          />
          <label htmlFor="novo-modelo-descricao" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Descrição</label>
          <textarea
            id="novo-modelo-descricao"
            value={model.descricao}
            onChange={(event) => onChange({ descricao: event.target.value })}
            placeholder="Resumo do objetivo do checklist"
            rows={4}
            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', color: '#111827', background: '#fff', resize: 'vertical' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label htmlFor="novo-modelo-etapas" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Etapas do checklist</label>
          <p style={{ margin: '-4px 0 0 0', color: '#64748b', fontSize: '0.75rem', lineHeight: 1.35 }}>
            Digite uma etapa por linha. Cada linha será criada como um item separado do checklist.
          </p>
          <textarea
            id="novo-modelo-etapas"
            value={model.etapas}
            onChange={(event) => onChange({ etapas: event.target.value })}
            placeholder={'Exemplo:\nConferir documentos\nGerar guia\nEnviar protocolo ao cliente'}
            rows={9}
            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', color: '#111827', background: '#fff', resize: 'vertical' }}
          />
        </div>
      </div>

      <div style={{ marginTop: '14px', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}>
        <strong style={{ fontSize: '0.8rem', color: '#0f172a', display: 'block', marginBottom: '10px' }}>Tipos / Regimes Aplicáveis</strong>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {REGIMES_APLICAVEIS.map((tipo) => (
            <label key={tipo} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer', color: '#475569' }}>
              <input
                type="checkbox"
                checked={model.tipos.includes(tipo)}
                onChange={(event) => onToggleTipo(tipo, event.target.checked)}
                style={{ width: '14px', height: '14px', accentColor: 'var(--color-gold-primary)' }}
              />
              {tipo}
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
        <button type="button" className="btn-save-settings" onClick={onCancel} style={{ background: '#64748b' }}>
          Cancelar
        </button>
        <button type="button" className="btn-add-user" onClick={onSubmit} style={{ borderRadius: '6px', padding: '0 16px' }}>
          <Plus size={16} /> Criar modelo
        </button>
      </div>
    </div>
  </div>
);
