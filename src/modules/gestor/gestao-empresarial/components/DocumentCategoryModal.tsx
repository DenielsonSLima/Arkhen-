import React from 'react';
import { Check, X } from 'lucide-react';

interface DocumentCategoryModalProps {
  categoryName: string;
  validationMessage: string;
  isCreating: boolean;
  fieldStyle: React.CSSProperties;
  onCategoryNameChange: (name: string) => void;
  onClose: () => void;
  onCreate: () => void;
}

export const DocumentCategoryModal: React.FC<DocumentCategoryModalProps> = ({
  categoryName,
  validationMessage,
  isCreating,
  fieldStyle,
  onCategoryNameChange,
  onClose,
  onCreate,
}) => (
  <div
    style={{ position: 'absolute', inset: 0, zIndex: 2, background: 'rgba(15, 23, 42, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '22px' }}
    onClick={onClose}
  >
    <div
      style={{ width: '100%', maxWidth: '360px', background: '#ffffff', borderRadius: '8px', border: '1px solid rgba(197, 146, 53, 0.36)', boxShadow: '0 18px 48px rgba(15, 23, 42, 0.24)', padding: '18px' }}
      onClick={(event) => event.stopPropagation()}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
        <div>
          <h4 style={{ margin: 0, color: '#0f172a', fontSize: '0.98rem', fontWeight: 700 }}>Nova categoria</h4>
          <p style={{ margin: '3px 0 0', color: '#64748b', fontSize: '0.76rem' }}>Crie e selecione sem sair do envio.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', borderRadius: '8px', width: '30px', height: '30px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <X size={16} />
        </button>
      </div>

      <input
        type="text"
        value={categoryName}
        onChange={(event) => onCategoryNameChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onCreate();
          }
        }}
        placeholder="Ex.: Certidões trabalhistas"
        style={fieldStyle}
        autoFocus
      />

      {validationMessage && (
        <div style={{ marginTop: '8px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #fed7aa', background: '#fff7ed', color: '#c2410c', fontSize: '0.74rem', fontWeight: 700 }}>
          {validationMessage}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
        <button
          type="button"
          onClick={onClose}
          style={{ padding: '8px 14px', fontSize: '0.8rem', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff', color: '#475569', fontWeight: 700 }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onCreate}
          disabled={isCreating}
          style={{ padding: '8px 14px', fontSize: '0.8rem', background: 'var(--color-gold-gradient)', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Check size={15} /> {isCreating ? 'Criando...' : 'Criar'}
        </button>
      </div>
    </div>
  </div>
);
