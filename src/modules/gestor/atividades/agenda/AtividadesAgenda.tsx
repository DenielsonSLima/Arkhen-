import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useAtividadesWorkspace } from '../hooks/useAtividadesWorkspace';
import { TarefaGestorList } from '../components/TarefaGestorList';
import { RESPONSAVEIS_ATIVIDADES, addDaysKey, formatDateBR, todayKey, type TarefaGestor } from '../services/rotinasAtividadesService';

type AgendaModo = 'dia' | 'semana' | 'mes';

const pct = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0);

const getMonday = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`);
  const day = date.getDay();
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
  return date.toISOString().split('T')[0];
};

const shiftPeriod = (dateKey: string, mode: AgendaModo, amount: number) => {
  if (mode === 'dia') return addDaysKey(dateKey, amount);
  if (mode === 'semana') return addDaysKey(dateKey, amount * 7);
  const date = new Date(`${dateKey}T00:00:00`);
  date.setMonth(date.getMonth() + amount);
  return date.toISOString().split('T')[0];
};

const inPeriod = (task: TarefaGestor, selectedDate: string, mode: AgendaModo) => {
  if (mode === 'dia') return task.vencimento === selectedDate;
  if (mode === 'semana') {
    const start = getMonday(selectedDate);
    const end = addDaysKey(start, 6);
    return task.vencimento >= start && task.vencimento <= end;
  }
  return task.vencimento.slice(0, 7) === selectedDate.slice(0, 7);
};

export const AtividadesAgenda: React.FC = () => {
  const { tarefas, updateTarefa, deleteTarefa, toggleChecklist } = useAtividadesWorkspace();
  const [mode, setMode] = useState<AgendaModo>('semana');
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [responsavel, setResponsavel] = useState('Todos');

  const periodTasks = useMemo(() => {
    return tarefas.filter((task) => (
      inPeriod(task, selectedDate, mode) && (responsavel === 'Todos' || task.responsavel === responsavel)
    )).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [mode, responsavel, selectedDate, tarefas]);

  const timeline = useMemo(() => {
    const start = mode === 'semana' ? getMonday(selectedDate) : selectedDate;
    const days = mode === 'mes' ? 30 : mode === 'semana' ? 7 : 1;
    return Array.from({ length: days }, (_, index) => {
      const dateKey = addDaysKey(start, index);
      const dayTasks = tarefas.filter((task) => task.vencimento === dateKey);
      const done = dayTasks.filter((task) => task.status === 'Concluída').length;
      return { dateKey, total: dayTasks.length, done, pct: pct(done, dayTasks.length) };
    });
  }, [mode, selectedDate, tarefas]);

  const done = periodTasks.filter((task) => task.status === 'Concluída').length;
  const progress = pct(done, periodTasks.length);

  return (
    <div className="atividades-redesign-page">
      <div className="atividades-redesign-header">
        <div>
          <h2>Atividades - Agenda</h2>
          <p>Veja passado, presente e próximos prazos por dia, semana ou mês.</p>
        </div>
        <span>{done}/{periodTasks.length} ({progress}%)</span>
      </div>

      <div className="atividades-toolbar">
        <div className="atividades-segmented">
          {(['dia', 'semana', 'mes'] as AgendaModo[]).map((item) => (
            <button key={item} type="button" className={mode === item ? 'active' : ''} onClick={() => setMode(item)}>
              {item === 'mes' ? 'Mês' : item.charAt(0).toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
        <button type="button" className="atividade-period-nav-btn" onClick={() => setSelectedDate(shiftPeriod(selectedDate, mode, -1))}><ChevronLeft size={16} /></button>
        <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        <button type="button" className="atividade-period-nav-btn" onClick={() => setSelectedDate(shiftPeriod(selectedDate, mode, 1))}><ChevronRight size={16} /></button>
        <select value={responsavel} onChange={(event) => setResponsavel(event.target.value)}>
          <option value="Todos">Todos os funcionários</option>
          {RESPONSAVEIS_ATIVIDADES.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
        </select>
      </div>

      <div className="atividades-agenda-strip">
        {timeline.map((day) => (
          <button key={day.dateKey} type="button" className={day.dateKey === selectedDate ? 'active' : ''} onClick={() => setSelectedDate(day.dateKey)}>
            <span><CalendarDays size={14} /> {formatDateBR(day.dateKey)}</span>
            <strong>{day.pct}%</strong>
            <small>{day.done}/{day.total}</small>
            <div className="atividade-period-track"><div style={{ width: `${day.pct}%` }} /></div>
          </button>
        ))}
      </div>

      <section className="atividades-panel-card">
        <div className="atividades-section-title"><CalendarDays size={18} /><h3>Tarefas do período</h3></div>
        <TarefaGestorList
          tarefas={periodTasks}
          emptyText="Nenhuma atividade encontrada para este período."
          onUpdate={updateTarefa}
          onDelete={deleteTarefa}
          onToggleChecklist={toggleChecklist}
        />
      </section>
    </div>
  );
};
