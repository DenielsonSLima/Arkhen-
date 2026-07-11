import React, { useState } from 'react';
import { X, PlusCircle } from 'lucide-react';
import type { CategoriaAtividade, PrioridadeAtividade } from '../services/rotinasAtividadesService';

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
  const [titulo, setTitulo] = useState('');
  const [cliente, setCliente] = useState('Escritório');
  const [categoria, setCategoria] = useState<CategoriaAtividade>('Interna');
  const [vencimento, setVencimento] = useState(new Date().toISOString().split('T')[0]);
  const [prioridade, setPrioridade] = useState<PrioridadeAtividade>('Média');
  const [checklistRaw, setChecklistRaw] = useState('');
  const [notas, setNotas] = useState('');

  const clientes = ['Escritório'];

  if (!aberto) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;

    const checklist = checklistRaw
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

    onSalvar({
      titulo,
      cliente,
      categoria,
      vencimento,
      prioridade,
      checklist: checklist.length > 0 ? checklist : ['Executar atividade'],
      notas,
    });

    // Reset state
    setTitulo('');
    setCliente('Escritório');
    setCategoria('Interna');
    setVencimento(new Date().toISOString().split('T')[0]);
    setPrioridade('Média');
    setChecklistRaw('');
    setNotas('');
  };

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

        <form onSubmit={handleSubmit} style={styles.form}>
          <div className="calc-field" style={styles.field}>
            <label style={styles.label}>Título da Atividade</label>
            <input
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Conciliar Conta Corrente Itaú"
              style={styles.input}
            />
          </div>

          <div className="calc-field" style={styles.field}>
            <label style={styles.label}>Cliente / Empresa Vinculada</label>
            <select
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              style={styles.select}
            >
              {clientes.map((c) => (
                <option key={c} value={c} style={{ background: '#ffffff' }}>{c}</option>
              ))}
            </select>
          </div>

          <div style={styles.row}>
            <div className="calc-field" style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>Categoria</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as CategoriaAtividade)}
                style={styles.select}
              >
                <option value="Interna" style={{ background: '#ffffff' }}>Interna</option>
                <option value="Cliente" style={{ background: '#ffffff' }}>Cliente</option>
                <option value="Fiscal" style={{ background: '#ffffff' }}>Fiscal</option>
                <option value="Folha" style={{ background: '#ffffff' }}>Folha</option>
                <option value="Contábil" style={{ background: '#ffffff' }}>Contábil</option>
                <option value="Controle" style={{ background: '#ffffff' }}>Controle</option>
              </select>
            </div>

            <div className="calc-field" style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>Prioridade</label>
              <select
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value as PrioridadeAtividade)}
                style={styles.select}
              >
                <option value="Baixa" style={{ background: '#ffffff' }}>Baixa</option>
                <option value="Média" style={{ background: '#ffffff' }}>Média</option>
                <option value="Alta" style={{ background: '#ffffff' }}>Alta</option>
              </select>
            </div>
          </div>

          <div className="calc-field" style={styles.field}>
            <label style={styles.label}>Data de Vencimento</label>
            <input
              type="date"
              required
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
              style={styles.input}
            />
          </div>

          <div className="calc-field" style={styles.field}>
            <label style={styles.label}>Checklist (Um item por linha - opcional)</label>
            <textarea
              value={checklistRaw}
              onChange={(e) => setChecklistRaw(e.target.value)}
              placeholder="Passo 1&#10;Passo 2&#10;Passo 3"
              style={styles.textarea}
              rows={3}
            />
          </div>

          <div className="calc-field" style={styles.field}>
            <label style={styles.label}>Descrição / Notas</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Instruções adicionais..."
              style={styles.textarea}
              rows={2}
            />
          </div>

          <div style={styles.actions}>
            <button onClick={onClose} style={styles.cancelBtn} type="button">
              Cancelar
            </button>
            <button type="submit" style={styles.submitBtn}>
              Criar Atividade
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
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '14px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '5px',
  },
  row: {
    display: 'flex',
    gap: '12px',
  },
  label: {
    fontSize: '0.72rem',
    color: 'var(--color-gold-dark)',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  input: {
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '8px 10px',
    color: '#0f172a',
    fontSize: '0.82rem',
    outline: 'none',
    width: '100%',
  },
  select: {
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '8px 10px',
    color: '#0f172a',
    fontSize: '0.82rem',
    outline: 'none',
    width: '100%',
    cursor: 'pointer',
  },
  textarea: {
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '8px 10px',
    color: '#0f172a',
    fontSize: '0.82rem',
    outline: 'none',
    resize: 'vertical' as const,
    width: '100%',
  },
  actions: {
    display: 'flex',
    gap: '10px',
    marginTop: '6px',
  },
  submitBtn: {
    background: 'linear-gradient(135deg, #c59235 0%, #aa7c28 100%)',
    border: 'none',
    borderRadius: '6px',
    padding: '10px 16px',
    color: '#ffffff',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    flex: 1,
    boxShadow: '0 2px 6px rgba(197, 146, 53, 0.2)',
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '10px 16px',
    color: '#64748b',
    fontSize: '0.82rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
};
