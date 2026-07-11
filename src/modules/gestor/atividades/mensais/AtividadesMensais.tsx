import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import {
  getCurrentMonthKey,
  getProgress,
  getUsuarioLogado,
  loadPeriodNote,
  loadPeriodTasks,
  savePeriodNote,
  savePeriodTasks,
  shiftMonthKey,
  type PeriodTask,
} from '../utils/periodoAtividades';

const STORAGE_KEY = 'contabil_atividades_mensais_por_mes';
const NOTE_STORAGE_KEY = 'contabil_atividades_mensais_notas';

const DEFAULT_MONTHLY: PeriodTask[] = [
  { id: 'm-1', tarefa: 'Processar e fechar folhas de pagamento de todos os clientes', responsavel: 'Karine', concluida: false },
  { id: 'm-2', tarefa: 'Transmissão das DCTFWebs mensais', responsavel: 'João Silva', concluida: false },
  { id: 'm-3', tarefa: 'Emissão e envio de guias DAS do Simples Nacional', responsavel: 'Pedro', concluida: false },
  { id: 'm-4', tarefa: 'Fechamento fiscal e envio de impostos federais', responsavel: 'Fernanda', concluida: false },
  { id: 'm-5', tarefa: 'Conciliação e encerramento contábil mensal', responsavel: 'João Silva', concluida: false },
];

const formatMonth = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
};

export const AtividadesMensais: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [tasks, setTasks] = useState<PeriodTask[]>([]);
  const [note, setNote] = useState('');
  const [newText, setNewText] = useState('');
  const [newResp, setNewResp] = useState('João Silva');

  useEffect(() => {
    setTasks(loadPeriodTasks(STORAGE_KEY, selectedMonth, DEFAULT_MONTHLY));
    setNote(loadPeriodNote(NOTE_STORAGE_KEY, selectedMonth));
  }, [selectedMonth]);

  const saveTasks = (newTasks: PeriodTask[]) => {
    setTasks(newTasks);
    savePeriodTasks(STORAGE_KEY, selectedMonth, newTasks);
  };

  const monthProgress = useMemo(() => {
    return [-2, -1, 0, 1, 2].map((offset) => {
      const key = shiftMonthKey(selectedMonth, offset);
      const periodTasks = loadPeriodTasks(STORAGE_KEY, key, DEFAULT_MONTHLY);
      return { key, ...getProgress(periodTasks) };
    });
  }, [selectedMonth, tasks]);

  const handleToggle = (id: string, value: boolean) => {
    const usuarioLogado = getUsuarioLogado('João Silva');
    saveTasks(tasks.map((task) => (
      task.id === id
        ? {
            ...task,
            concluida: value,
            concluidaEm: value ? new Date().toLocaleString('pt-BR') : undefined,
            concluidaPor: value ? usuarioLogado : undefined,
          }
        : task
    )));
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;
    saveTasks([...tasks, { id: `m-${Date.now()}`, tarefa: newText.trim(), responsavel: newResp, concluida: false }]);
    setNewText('');
  };

  const handleNoteChange = (value: string) => {
    setNote(value);
    savePeriodNote(NOTE_STORAGE_KEY, selectedMonth, value);
  };

  const { total, done, pct } = getProgress(tasks);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="atividades-filter-header" style={{ marginTop: 0 }}>
        <div>
          <h2 style={{ color: '#0f172a', margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Atividades Mensais</h2>
          <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '2px 0 0 0' }}>Selecione meses anteriores, atuais ou futuros e acompanhe o fechamento.</p>
        </div>
        <div className="atividade-period-controls">
          <label>Mês</label>
          <button type="button" className="atividade-period-nav-btn" title="Mês anterior" onClick={() => setSelectedMonth(shiftMonthKey(selectedMonth, -1))}>
            <ChevronLeft size={16} />
          </button>
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
          <button type="button" className="atividade-period-nav-btn" title="Próximo mês" onClick={() => setSelectedMonth(shiftMonthKey(selectedMonth, 1))}>
            <ChevronRight size={16} />
          </button>
          <span className={`table-badge ${pct === 100 ? 'badge-status-concl' : 'badge-status-and'}`}>{done}/{total} ({pct}%)</span>
        </div>
      </div>

      <div className="atividade-period-progress">
        {monthProgress.map((item) => (
          <button
            type="button"
            key={item.key}
            className={`atividade-period-chip ${item.key === selectedMonth ? 'active' : ''}`}
            onClick={() => setSelectedMonth(item.key)}
          >
            <span>{formatMonth(item.key)}</span>
            <strong>{item.pct}%</strong>
            <div className="atividade-period-track"><div style={{ width: `${item.pct}%` }} /></div>
          </button>
        ))}
      </div>

      <div className="atividade-period-notes">
        <label>Anotações do mês</label>
        <textarea
          value={note}
          onChange={(e) => handleNoteChange(e.target.value)}
          placeholder="Registre fechamentos concluídos, pendências e justificativas do mês."
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start' }}>
        <div className="tab-pane" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {tasks.map((task) => (
              <div key={task.id} className="atividade-period-row">
                <label>
                  <input type="checkbox" checked={task.concluida} onChange={(e) => handleToggle(task.id, e.target.checked)} />
                  <span>
                    <strong style={{ textDecoration: task.concluida ? 'line-through' : 'none' }}>{task.tarefa}</strong>
                    <small>Responsável: {task.responsavel}</small>
                    {task.concluida && <small className="done"><CheckCircle2 size={11} /> Feito por {task.concluidaPor} às {task.concluidaEm}</small>}
                  </span>
                </label>
                <button type="button" onClick={() => saveTasks(tasks.filter((t) => t.id !== task.id))} title="Excluir">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleAdd} className="calc-form-card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '14px' }}><Plus size={16} color="#c59235" /> Adicionar Rotina Mensal</h3>
          <div className="calc-field">
            <label>Descrição da Tarefa</label>
            <input type="text" placeholder="Ex: Conciliar fechamentos..." value={newText} onChange={(e) => setNewText(e.target.value)} required />
          </div>
          <div className="calc-field">
            <label>Responsável</label>
            <select value={newResp} onChange={(e) => setNewResp(e.target.value)}>
              <option value="João Silva">João Silva</option>
              <option value="Karine">Karine</option>
              <option value="Pedro">Pedro</option>
              <option value="Fernanda">Fernanda</option>
            </select>
          </div>
          <button type="submit" className="btn-add-user" style={{ width: '100%', padding: '10px', marginTop: '10px', justifyContent: 'center' }}>
            Inserir Tarefa
          </button>
        </form>
      </div>
    </div>
  );
};
