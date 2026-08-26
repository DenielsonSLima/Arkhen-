import React from 'react';
import { Clock, Key, ShieldAlert, ToggleLeft, ToggleRight } from 'lucide-react';
import { SHARE_EXPIRATION_OPTIONS } from '../../../documentos/services/documentShareService';

interface DocumentTypeOption {
  id: string;
  nome: string;
}

interface CompartilhamentoPolicyFormProps {
  tempoPadrao: string;
  limitarTipos: string[];
  exigirSenhaPadrao: boolean;
  prazosExigemSenha: string[];
  documentTypes: DocumentTypeOption[];
  disabled?: boolean;
  onTempoPadraoChange: (value: string) => void;
  onToggleTipo: (id: string) => void;
  onToggleSenhaPadrao: () => void;
  onTogglePrazo: (value: string) => void;
  onSave: () => void;
}

const panelStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  fontWeight: 700,
  color: '#1e293b',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  margin: 0,
};

const descriptionStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#64748b',
  margin: 0,
  lineHeight: 1.4,
};

const optionStyle = (checked: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '9px 12px',
  borderRadius: '8px',
  border: checked ? '1px solid #fde68a' : '1px solid #e2e8f0',
  backgroundColor: checked ? '#fffdf5' : '#ffffff',
  color: checked ? '#1e293b' : '#475569',
  fontSize: '0.8rem',
  fontWeight: checked ? 600 : 500,
  cursor: 'pointer',
});

export const CompartilhamentoPolicyForm: React.FC<CompartilhamentoPolicyFormProps> = ({
  tempoPadrao,
  limitarTipos,
  exigirSenhaPadrao,
  prazosExigemSenha,
  documentTypes,
  disabled = false,
  onTempoPadraoChange,
  onToggleTipo,
  onToggleSenhaPadrao,
  onTogglePrazo,
  onSave,
}) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '10px' }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <section style={panelStyle}>
        <h3 style={titleStyle}>
          <Clock size={18} color="var(--color-gold-primary)" />
          Tempo de expiração de links
        </h3>
        <p style={descriptionStyle}>Defina por quanto tempo um documento compartilhado ficará disponível.</p>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
          Tempo de expiração padrão
          <select
            aria-label="Tempo de expiração padrão"
            value={tempoPadrao}
            onChange={(event) => onTempoPadraoChange(event.target.value)}
            disabled={disabled}
            style={{ display: 'block', width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: '#ffffff', color: '#111827' }}
          >
            {SHARE_EXPIRATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </section>

      <section style={panelStyle}>
        <h3 style={titleStyle}>
          <ShieldAlert size={18} color="var(--color-gold-primary)" />
          Documentos com proteção recomendada
        </h3>
        <p style={descriptionStyle}>Marque os tipos sensíveis que devem receber destaque de proteção ao compartilhar.</p>
        <div style={{ display: 'grid', gap: '9px' }}>
          {documentTypes.map((type) => {
            const checked = limitarTipos.includes(type.id);
            return (
              <label key={type.id} style={optionStyle(checked)}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleTipo(type.id)}
                  disabled={disabled}
                  style={{ accentColor: 'var(--color-gold-primary)' }}
                />
                {type.nome}
              </label>
            );
          })}
        </div>
      </section>
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <section style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
          <div>
            <h3 style={titleStyle}>
              <Key size={18} color="var(--color-gold-primary)" />
              Senhas temporárias automáticas
            </h3>
            <p style={{ ...descriptionStyle, marginTop: '8px' }}>Exija uma chave para todo link ou apenas para prazos específicos.</p>
          </div>
          <button
            type="button"
            aria-label="Exigir senha em todos os compartilhamentos"
            aria-pressed={exigirSenhaPadrao}
            onClick={onToggleSenhaPadrao}
            disabled={disabled}
            style={{ background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', padding: 0 }}
          >
            {exigirSenhaPadrao
              ? <ToggleRight size={40} color="var(--color-gold-primary)" />
              : <ToggleLeft size={40} color="#cbd5e1" />}
          </button>
        </div>

        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
          <strong style={{ display: 'block', marginBottom: '9px', color: '#475569', fontSize: '0.75rem' }}>Exigir senha nos prazos:</strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
            {SHARE_EXPIRATION_OPTIONS.map((option) => {
              const checked = prazosExigemSenha.includes(option);
              return (
                <label key={option} style={optionStyle(checked)}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onTogglePrazo(option)}
                    disabled={disabled}
                    style={{ accentColor: 'var(--color-gold-primary)' }}
                  />
                  {option}
                </label>
              );
            })}
          </div>
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onSave}
          disabled={disabled}
          style={{ padding: '10px 20px', backgroundColor: 'var(--color-gold-primary)', color: '#ffffff', fontSize: '0.85rem', fontWeight: 600, border: 'none', borderRadius: '8px', cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          Salvar configurações
        </button>
      </div>
    </div>
  </div>
);
