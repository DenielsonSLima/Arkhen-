import React, { useState } from 'react';
import { X, CalendarDays, HelpCircle } from 'lucide-react';
import type { RotinaAtividade } from '../services/rotinasAtividadesService';

interface ModalVincularRotinaProps {
  aberto: boolean;
  onClose: () => void;
  rotinas: RotinaAtividade[];
  onVincular: (rotinaId: string, incluirFinaisDeSemana: boolean) => void;
  usuarioNome: string;
}

export const ModalVincularRotina: React.FC<ModalVincularRotinaProps> = ({
  aberto,
  onClose,
  rotinas,
  onVincular,
  usuarioNome,
}) => {
  const [selectedRotinaId, setSelectedRotinaId] = useState('');
  const [incluirFinaisDeSemana, setIncluirFinaisDeSemana] = useState(false);

  if (!aberto) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRotinaId) return;
    onVincular(selectedRotinaId, incluirFinaisDeSemana);
    setSelectedRotinaId('');
    setIncluirFinaisDeSemana(false);
  };

  return (
    <div className="modal-overlay animate-fade-in" style={styles.overlay}>
      <div className="modal-content" style={styles.modal}>
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarDays size={20} color="var(--color-gold-primary)" />
            <h3 style={styles.title}>Vincular Rotina a {usuarioNome}</h3>
          </div>
          <button onClick={onClose} style={styles.closeBtn} type="button">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div className="calc-field" style={styles.field}>
            <label style={styles.label}>Selecione a Rotina Modelo</label>
            <select
              value={selectedRotinaId}
              onChange={(e) => setSelectedRotinaId(e.target.value)}
              required
              style={styles.select}
            >
              <option value="" style={{ background: '#ffffff' }}>Selecione...</option>
              {rotinas.map((r) => (
                <option key={r.id} value={r.id} style={{ background: '#ffffff' }}>
                  {r.nome} ({r.frequencia} • {r.categoria})
                </option>
              ))}
            </select>
          </div>

          <div style={styles.weekendBox}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <HelpCircle size={20} color="var(--color-gold-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: '#0f172a', fontSize: '0.88rem', display: 'block', marginBottom: '4px' }}>
                  Executar aos Finais de Semana?
                </strong>
                <span style={{ color: '#64748b', fontSize: '0.75rem', lineHeight: '1.4' }}>
                  Por padrão, as rotinas operacionais contábeis não são geradas aos sábados e domingos para evitar gargalos nos dias em que o escritório não funciona.
                </span>
              </div>
            </div>
            <label style={styles.switchLabel}>
              <input
                type="checkbox"
                checked={incluirFinaisDeSemana}
                onChange={(e) => setIncluirFinaisDeSemana(e.target.checked)}
                style={styles.checkbox}
              />
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: incluirFinaisDeSemana ? 'var(--color-gold-dark)' : '#64748b' }}>
                {incluirFinaisDeSemana ? 'Sim, gerar aos Sábados/Domingos' : 'Não, pular Finais de Semana'}
              </span>
            </label>
          </div>

          <div style={styles.actions}>
            <button onClick={onClose} style={styles.cancelBtn} type="button">
              Cancelar
            </button>
            <button type="submit" disabled={!selectedRotinaId} style={!selectedRotinaId ? styles.disabledBtn : styles.submitBtn}>
              Vincular Rotina
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '480px',
    padding: '24px',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '12px',
  },
  title: {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#0f172a',
    fontFamily: 'var(--font-sans)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--color-gold-dark)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  select: {
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '10px 12px',
    color: '#0f172a',
    fontSize: '0.88rem',
    outline: 'none',
    cursor: 'pointer',
    width: '100%',
  },
  weekendBox: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '14px',
  },
  switchLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  checkbox: {
    accentColor: 'var(--color-gold-primary)',
    width: '16px',
    height: '16px',
    cursor: 'pointer',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '8px',
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '10px 16px',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '0.88rem',
    fontWeight: 500,
  },
  submitBtn: {
    background: 'linear-gradient(135deg, #c59235 0%, #aa7c28 100%)',
    border: 'none',
    borderRadius: '6px',
    padding: '10px 20px',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '0.88rem',
    fontWeight: 600,
    boxShadow: '0 4px 10px rgba(197, 146, 53, 0.2)',
  },
  disabledBtn: {
    backgroundColor: '#e2e8f0',
    border: 'none',
    borderRadius: '6px',
    padding: '10px 20px',
    color: '#94a3b8',
    cursor: 'not-allowed',
    fontSize: '0.88rem',
    fontWeight: 600,
  },
};
