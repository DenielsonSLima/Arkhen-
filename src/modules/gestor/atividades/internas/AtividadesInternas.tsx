import React, { useState } from 'react';
import { CheckCircle2, ClipboardList, Plus, Trash2 } from 'lucide-react';

interface AtividadeInterna {
  id: string;
  titulo: string;
  setor: string;
  responsavel: string;
  concluida: boolean;
}

export const AtividadesInternas: React.FC = () => {
  const [atividades, setAtividades] = useState<AtividadeInterna[]>([]);
  const [titulo, setTitulo] = useState('');
  const [setor, setSetor] = useState('Operacional');
  const [responsavel, setResponsavel] = useState('João Silva');

  const saveAtividades = (next: AtividadeInterna[]) => {
    setAtividades(next);
  };

  const handleAdd = (event: React.FormEvent) => {
    event.preventDefault();
    if (!titulo.trim()) return;
    saveAtividades([
      ...atividades,
      { id: `int-${Date.now()}`, titulo: titulo.trim(), setor, responsavel, concluida: false },
    ]);
    setTitulo('');
  };

  const done = atividades.filter((atividade) => atividade.concluida).length;
  const pct = atividades.length > 0 ? Math.round((done / atividades.length) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="atividades-filter-header" style={{ marginTop: 0 }}>
        <div className="atividades-title">
          <h2 style={{ color: '#0f172a', margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Atividades Internas</h2>
          <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '2px 0 0 0' }}>
            Tarefas administrativas e operacionais do escritório, separadas das obrigações de clientes.
          </p>
        </div>
        <span className={`table-badge ${pct === 100 ? 'badge-status-concl' : 'badge-status-and'}`}>
          {done}/{atividades.length} ({pct}%)
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start' }}>
        <div className="submodule-content-card" style={{ padding: '20px' }}>
          {atividades.length === 0 ? (
            <div className="empty-state-card">
              <ClipboardList size={38} className="empty-state-icon" />
              <p>Nenhuma atividade interna cadastrada.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {atividades.map((atividade) => (
                <div
                  key={atividade.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    background: atividade.concluida ? '#f0fdf4' : '#ffffff',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={atividade.concluida}
                      onChange={(event) => saveAtividades(atividades.map((item) => (
                        item.id === atividade.id ? { ...item, concluida: event.target.checked } : item
                      )))}
                      style={{ accentColor: 'var(--color-gold-primary)' }}
                    />
                    <span>
                      <strong style={{ display: 'block', color: '#0f172a', textDecoration: atividade.concluida ? 'line-through' : 'none' }}>
                        {atividade.titulo}
                      </strong>
                      <small style={{ color: '#64748b' }}>{atividade.setor} • {atividade.responsavel}</small>
                    </span>
                  </label>
                  {atividade.concluida && <CheckCircle2 size={16} color="#10b981" />}
                  <button
                    type="button"
                    className="btn-remove-stage"
                    onClick={() => saveAtividades(atividades.filter((item) => item.id !== atividade.id))}
                    title="Excluir"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleAdd} className="calc-form-card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '14px' }}>
            <Plus size={16} color="#c59235" /> Nova Atividade Interna
          </h3>
          <div className="calc-field">
            <label>Descrição</label>
            <input value={titulo} onChange={(event) => setTitulo(event.target.value)} placeholder="Ex: Conferir caixa de entrada" />
          </div>
          <div className="calc-field">
            <label>Setor</label>
            <select value={setor} onChange={(event) => setSetor(event.target.value)}>
              <option value="Operacional">Operacional</option>
              <option value="Documentos">Documentos</option>
              <option value="Protocolos">Protocolos</option>
              <option value="Financeiro">Financeiro</option>
            </select>
          </div>
          <div className="calc-field">
            <label>Responsável</label>
            <select value={responsavel} onChange={(event) => setResponsavel(event.target.value)}>
              <option value="João Silva">João Silva</option>
              <option value="Karine">Karine</option>
              <option value="Pedro">Pedro</option>
              <option value="Fernanda">Fernanda</option>
            </select>
          </div>
          <button type="submit" className="btn-add-user" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
            Inserir
          </button>
        </form>
      </div>
    </div>
  );
};
