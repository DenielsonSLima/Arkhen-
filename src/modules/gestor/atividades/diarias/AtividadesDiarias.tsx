import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import {
  getProgress,
  getTodayISO,
  getUsuarioLogado,
  loadPeriodNote,
  loadPeriodTasks,
  savePeriodNote,
  savePeriodTasks,
  shiftDateKey,
  type PeriodTask,
} from '../utils/periodoAtividades';

const STORAGE_KEY = 'contabil_atividades_diarias_por_data';
const NOTE_STORAGE_KEY = 'contabil_atividades_diarias_notas';

const DEFAULT_DAILY: PeriodTask[] = [
  { id: 'd-1', tarefa: 'Importação automática de extratos bancários', responsavel: 'João Silva', concluida: false },
  { id: 'd-2', tarefa: 'Download de Notas Fiscais de Entrada (Municipais / Estaduais)', responsavel: 'Karine', concluida: false },
  { id: 'd-3', tarefa: 'Verificação do e-CAC para alertas e pendências imediatas', responsavel: 'Pedro', concluida: false },
  { id: 'd-4', tarefa: 'Conferência de e-mails institucionais do escritório', responsavel: 'Fernanda', concluida: false },
  { id: 'd-5', tarefa: 'Envio de recibos de faturamento diários aos clientes', responsavel: 'João Silva', concluida: false },
];

const getWeekDays = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date);
  monday.setDate(diff);
  return Array.from({ length: 7 }, (_, index) => {
    const item = new Date(monday);
    item.setDate(monday.getDate() + index);
    return item.toISOString().split('T')[0];
  });
};

export const AtividadesDiarias: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(getTodayISO());
  const [tasks, setTasks] = useState<PeriodTask[]>([]);
  const [note, setNote] = useState('');
  const [newText, setNewText] = useState('');
  const [newResp, setNewResp] = useState('João Silva');

  useEffect(() => {
    setTasks(loadPeriodTasks(STORAGE_KEY, selectedDate, DEFAULT_DAILY));
    setNote(loadPeriodNote(NOTE_STORAGE_KEY, selectedDate));
  }, [selectedDate]);

  const saveTasks = (newTasks: PeriodTask[]) => {
    setTasks(newTasks);
    savePeriodTasks(STORAGE_KEY, selectedDate, newTasks);
  };

  const weekProgress = useMemo(() => {
    return getWeekDays(selectedDate).map((dateKey) => {
      const dayTasks = loadPeriodTasks(STORAGE_KEY, dateKey, DEFAULT_DAILY);
      return { dateKey, ...getProgress(dayTasks) };
    });
  }, [selectedDate, tasks]);

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
    saveTasks([...tasks, { id: `d-${Date.now()}`, tarefa: newText.trim(), responsavel: newResp, concluida: false }]);
    setNewText('');
  };

  const handleNoteChange = (value: string) => {
    setNote(value);
    savePeriodNote(NOTE_STORAGE_KEY, selectedDate, value);
  };

  const { total, done, pct } = getProgress(tasks);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="atividades-filter-header" style={{ marginTop: 0 }}>
        <div>
          <h2 style={{ color: '#0f172a', margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Atividades Diárias</h2>
          <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '2px 0 0 0' }}>Selecione dias anteriores, atuais ou futuros e acompanhe a execução.</p>
        </div>
        <div className="atividade-period-controls">
          <label>Data</label>
          <button type="button" className="atividade-period-nav-btn" title="Dia anterior" onClick={() => setSelectedDate(shiftDateKey(selectedDate, -1))}>
            <ChevronLeft size={16} />
          </button>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          <button type="button" className="atividade-period-nav-btn" title="Próximo dia" onClick={() => setSelectedDate(shiftDateKey(selectedDate, 1))}>
            <ChevronRight size={16} />
          </button>
          <span className={`table-badge ${pct === 100 ? 'badge-status-concl' : 'badge-status-and'}`}>{done}/{total} ({pct}%)</span>
        </div>
      </div>

      <div className="atividade-period-progress">
        {weekProgress.map((item) => {
          const label = new Date(`${item.dateKey}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });
          return (
            <button
              type="button"
              key={item.dateKey}
              className={`atividade-period-chip ${item.dateKey === selectedDate ? 'active' : ''}`}
              onClick={() => setSelectedDate(item.dateKey)}
            >
              <span>{label}</span>
              <strong>{item.pct}%</strong>
              <div className="atividade-period-track"><div style={{ width: `${item.pct}%` }} /></div>
            </button>
          );
        })}
      </div>

      <div className="atividade-period-notes">
        <label>Anotações do dia</label>
        <textarea
          value={note}
          onChange={(e) => handleNoteChange(e.target.value)}
          placeholder="Registre o que foi feito, o que ficou pendente e o motivo."
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
          <h3 style={{ fontSize: '0.9rem', marginBottom: '14px' }}><Plus size={16} color="#c59235" /> Adicionar Rotina Diária</h3>
          <div className="calc-field">
            <label>Descrição da Tarefa</label>
            <input type="text" placeholder="Ex: Conciliar conta Itaú..." value={newText} onChange={(e) => setNewText(e.target.value)} required />
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
