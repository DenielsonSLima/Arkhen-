import React, { useState } from 'react';
import type { CategoriaAtividade, PrioridadeAtividade } from '../services/rotinasAtividadesService';

interface NovaTarefaFormProps {
  onCancelar: () => void;
  onSalvar: (dados: {
    titulo: string;
    cliente: string;
    categoria: CategoriaAtividade;
    vencimento: string;
    prioridade: PrioridadeAtividade;
    checklist: string[];
    notas: string;
  }) => void;
}

export const NovaTarefaForm: React.FC<NovaTarefaFormProps> = ({ onCancelar, onSalvar }) => {
  const [titulo, setTitulo] = useState('');
  const [cliente, setCliente] = useState('Escritório');
  const [categoria, setCategoria] = useState<CategoriaAtividade>('Interna');
  const [vencimento, setVencimento] = useState(new Date().toISOString().split('T')[0]);
  const [prioridade, setPrioridade] = useState<PrioridadeAtividade>('Média');
  const [checklistRaw, setChecklistRaw] = useState('');
  const [notas, setNotas] = useState('');

  const clientes = ['Escritório'];

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
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

    setTitulo('');
    setCliente('Escritório');
    setCategoria('Interna');
    setVencimento(new Date().toISOString().split('T')[0]);
    setPrioridade('Média');
    setChecklistRaw('');
    setNotas('');
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div className="calc-field" style={styles.field}>
        <label style={styles.label}>Título da Atividade</label>
        <input
          type="text"
          required
          value={titulo}
          onChange={(event) => setTitulo(event.target.value)}
          placeholder="Ex: Conciliar Conta Corrente Itaú"
          style={styles.input}
        />
      </div>

      <div className="calc-field" style={styles.field}>
        <label style={styles.label}>Cliente / Empresa Vinculada</label>
        <select value={cliente} onChange={(event) => setCliente(event.target.value)} style={styles.select}>
          {clientes.map((item) => (
            <option key={item} value={item} style={{ background: '#ffffff' }}>{item}</option>
          ))}
        </select>
      </div>

      <div style={styles.row}>
        <div className="calc-field" style={{ ...styles.field, flex: 1 }}>
          <label style={styles.label}>Categoria</label>
          <select
            value={categoria}
            onChange={(event) => setCategoria(event.target.value as CategoriaAtividade)}
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
            onChange={(event) => setPrioridade(event.target.value as PrioridadeAtividade)}
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
          onChange={(event) => setVencimento(event.target.value)}
          style={styles.input}
        />
      </div>

      <div className="calc-field" style={styles.field}>
        <label style={styles.label}>Checklist (um item por linha)</label>
        <textarea
          value={checklistRaw}
          onChange={(event) => setChecklistRaw(event.target.value)}
          placeholder="Passo 1&#10;Passo 2&#10;Passo 3"
          style={styles.textarea}
          rows={3}
        />
      </div>

      <div className="calc-field" style={styles.field}>
        <label style={styles.label}>Descrição / Notas</label>
        <textarea
          value={notas}
          onChange={(event) => setNotas(event.target.value)}
          placeholder="Instruções adicionais..."
          style={styles.textarea}
          rows={2}
        />
      </div>

      <div style={styles.actions}>
        <button onClick={onCancelar} style={styles.cancelBtn} type="button">
          Cancelar
        </button>
        <button type="submit" style={styles.submitBtn}>
          Criar Atividade
        </button>
      </div>
    </form>
  );
};

const styles = {
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
    fontFamily: 'inherit',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '6px',
  },
  cancelBtn: {
    padding: '8px 14px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#64748b',
    cursor: 'pointer',
    fontWeight: 600,
  },
  submitBtn: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    background: 'var(--color-gold-primary)',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 700,
  },
};
