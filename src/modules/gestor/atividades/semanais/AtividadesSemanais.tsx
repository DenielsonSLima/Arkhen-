import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import {
  getCurrentWeekKey,
  getProgress,
  getUsuarioLogado,
  getWeekInputValue,
  getWeekKeyFromInput,
  getWeekLabel,
  loadPeriodNote,
  loadPeriodTasks,
  savePeriodNote,
  savePeriodTasks,
  shiftWeekKey,
  type PeriodTask,
} from '../utils/periodoAtividades';

const STORAGE_KEY = 'contabil_atividades_semanais_por_semana';
const NOTE_STORAGE_KEY = 'contabil_atividades_semanais_notas';

const DEFAULT_WEEKLY: PeriodTask[] = [
  { id: 'w-1', tarefa: 'Processar adiantamentos quinzenais (Folha)', responsavel: 'Karine', concluida: false },
  { id: 'w-2', tarefa: 'Conferência de Notas Fiscais acumuladas da semana', responsavel: 'João Silva', concluida: false },
  { id: 'w-3', tarefa: 'Relatório semanal de status de processos fiscais', responsavel: 'Pedro', concluida: false },
  { id: 'w-4', tarefa: 'Backup semanal de arquivos e XMLs fiscais', responsavel: 'Fernanda', concluida: false },
];

export const AtividadesSemanais: React.FC = () => {
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeekKey());
  const [tasks, setTasks] = useState<PeriodTask[]>([]);
  const [note, setNote] = useState('');
  const [newText, setNewText] = useState('');
  const [newResp, setNewResp] = useState('Karine');

  useEffect(() => {
    setTasks(loadPeriodTasks(STORAGE_KEY, selectedWeek, DEFAULT_WEEKLY));
    setNote(loadPeriodNote(NOTE_STORAGE_KEY, selectedWeek));
  }, [selectedWeek]);

  const saveTasks = (newTasks: PeriodTask[]) => {
    setTasks(newTasks);
    savePeriodTasks(STORAGE_KEY, selectedWeek, newTasks);
  };

  const weekProgress = useMemo(() => {
    return [-2, -1, 0, 1, 2].map((offset) => {
      const key = shiftWeekKey(selectedWeek, offset);
      const periodTasks = loadPeriodTasks(STORAGE_KEY, key, DEFAULT_WEEKLY);
      return { key, ...getProgress(periodTasks) };
    });
  }, [selectedWeek, tasks]);

  const handleToggle = (id: string, value: boolean) => {
    const usuarioLogado = getUsuarioLogado('Karine');
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
    saveTasks([...tasks, { id: `w-${Date.now()}`, tarefa: newText.trim(), responsavel: newResp, concluida: false }]);
    setNewText('');
  };

  const handleNoteChange = (value: string) => {
    setNote(value);
    savePeriodNote(NOTE_STORAGE_KEY, selectedWeek, value);
  };

  const { total, done, pct } = getProgress(tasks);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="atividades-filter-header" style={{ marginTop: 0 }}>
        <div>
          <h2 style={{ color: '#0f172a', margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Atividades Semanais</h2>
          <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '2px 0 0 0' }}>Selecione semanas anteriores, atuais ou futuras e veja se a rotina foi cumprida.</p>
        </div>
        <div className="atividade-period-controls">
          <label>Semana</label>
          <button type="button" className="atividade-period-nav-btn" title="Semana anterior" onClick={() => setSelectedWeek(shiftWeekKey(selectedWeek, -1))}>
            <ChevronLeft size={16} />
          </button>
          <input type="week" value={getWeekInputValue(selectedWeek)} onChange={(e) => setSelectedWeek(getWeekKeyFromInput(e.target.value))} />
          <button type="button" className="atividade-period-nav-btn" title="Próxima semana" onClick={() => setSelectedWeek(shiftWeekKey(selectedWeek, 1))}>
            <ChevronRight size={16} />
          </button>
          <span className={`table-badge ${pct === 100 ? 'badge-status-concl' : 'badge-status-and'}`}>{done}/{total} ({pct}%)</span>
        </div>
      </div>

      <div className="atividade-period-progress">
        {weekProgress.map((item) => (
          <button
            type="button"
            key={item.key}
            className={`atividade-period-chip ${item.key === selectedWeek ? 'active' : ''}`}
            onClick={() => setSelectedWeek(item.key)}
          >
            <span>{getWeekLabel(item.key)}</span>
            <strong>{item.pct}%</strong>
            <div className="atividade-period-track"><div style={{ width: `${item.pct}%` }} /></div>
          </button>
        ))}
      </div>

      <div className="atividade-period-notes">
        <label>Anotações da semana</label>
        <textarea
          value={note}
          onChange={(e) => handleNoteChange(e.target.value)}
          placeholder="Registre entregas, pendências e combinados da semana."
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
          <h3 style={{ fontSize: '0.9rem', marginBottom: '14px' }}><Plus size={16} color="#c59235" /> Adicionar Rotina Semanal</h3>
          <div className="calc-field">
            <label>Descrição da Tarefa</label>
            <input type="text" placeholder="Ex: Conciliar adiantamentos..." value={newText} onChange={(e) => setNewText(e.target.value)} required />
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
