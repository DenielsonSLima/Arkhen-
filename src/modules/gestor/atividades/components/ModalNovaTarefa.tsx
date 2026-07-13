import React from 'react';
import { PlusCircle, X } from 'lucide-react';
import type { CategoriaAtividade, PrioridadeAtividade } from '../services/rotinasAtividadesService';
import { NovaTarefaForm } from '../forms/NovaTarefaForm';

interface ModalNovaTarefaProps {
  aberto: boolean;
  onClose: () => void;
  onSalvar: (dados: {
    titulo: string;
    cliente: string;
    categoria: CategoriaAtividade;
    vencimento: string;
    prioridade: PrioridadeAtividade;
    checklist: string[];
    notas: string;
  }) => void;
  usuarioNome: string;
}

export const ModalNovaTarefa: React.FC<ModalNovaTarefaProps> = ({
  aberto,
  onClose,
  onSalvar,
  usuarioNome,
}) => {
  if (!aberto) return null;

  return (
    <div className="modal-overlay animate-fade-in" style={styles.overlay}>
      <div className="modal-content" style={styles.modal}>
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PlusCircle size={20} color="var(--color-gold-primary)" />
            <h3 style={styles.title}>Nova Tarefa para {usuarioNome}</h3>
          </div>
          <button onClick={onClose} style={styles.closeBtn} type="button">
            <X size={18} />
          </button>
        </div>

        <NovaTarefaForm onCancelar={onClose} onSalvar={onSalvar} />
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
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    width: '100%',
    maxWidth: '480px',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '18px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '12px',
  },
  title: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#0f172a',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
  },
};
