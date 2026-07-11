import React, { useMemo, useState } from 'react';
import { BarChart3, CalendarDays, ClipboardList, NotepadText, Users } from 'lucide-react';
import {
  getCurrentMonthKey,
  getCurrentWeekKey,
  getProgress,
  getStoredPeriodTasks,
  getTodayISO,
  loadPeriodNote,
  savePeriodNote,
  shiftDateKey,
  type PeriodTask,
} from '../utils/periodoAtividades';

const DAILY_STORAGE_KEY = 'contabil_atividades_diarias_por_data';
const WEEKLY_STORAGE_KEY = 'contabil_atividades_semanais_por_semana';
const MONTHLY_STORAGE_KEY = 'contabil_atividades_mensais_por_mes';
const SUMMARY_NOTE_KEY = 'contabil_atividades_resumo_notas';

const getEmployeeProgress = (tasks: PeriodTask[]) => {
  const map = new Map<string, { total: number; done: number }>();
  tasks.forEach((task) => {
    const current = map.get(task.responsavel) || { total: 0, done: 0 };
    current.total += 1;
    if (task.concluida) current.done += 1;
    map.set(task.responsavel, current);
  });

  return Array.from(map.entries()).map(([name, item]) => ({
    name,
    ...item,
    pct: item.total > 0 ? Math.round((item.done / item.total) * 100) : 0,
  }));
};

export const AtividadesResumo: React.FC = () => {
  const today = getTodayISO();
  const currentWeek = getCurrentWeekKey();
  const currentMonth = getCurrentMonthKey();
  const [note, setNote] = useState(() => loadPeriodNote(SUMMARY_NOTE_KEY, today));

  const summary = useMemo(() => {
    const dailyTasks = getStoredPeriodTasks(DAILY_STORAGE_KEY, today);
    const weeklyTasks = getStoredPeriodTasks(WEEKLY_STORAGE_KEY, currentWeek);
    const monthlyTasks = getStoredPeriodTasks(MONTHLY_STORAGE_KEY, currentMonth);
    const weekDays = Array.from({ length: 7 }, (_, index) => shiftDateKey(currentWeek, index));
    const dayBars = weekDays.map((dateKey) => ({
      dateKey,
      label: new Date(`${dateKey}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }),
      ...getProgress(getStoredPeriodTasks(DAILY_STORAGE_KEY, dateKey)),
    }));

    return {
      daily: getProgress(dailyTasks),
      weekly: getProgress(weeklyTasks),
      monthly: getProgress(monthlyTasks),
      dayBars,
      employees: getEmployeeProgress([...dailyTasks, ...weeklyTasks, ...monthlyTasks]),
    };
  }, [today, currentWeek, currentMonth]);

  const handleNoteChange = (value: string) => {
    setNote(value);
    savePeriodNote(SUMMARY_NOTE_KEY, today, value);
  };

  const cards = [
    { title: 'Atividades do Dia', icon: <CalendarDays size={18} />, ...summary.daily },
    { title: 'Atividades da Semana', icon: <ClipboardList size={18} />, ...summary.weekly },
    { title: 'Atividades do Mês', icon: <BarChart3 size={18} />, ...summary.monthly },
  ];

  return (
    <div className="atividade-resumo-page">
      <div className="atividades-filter-header" style={{ marginTop: 0 }}>
        <div>
          <h2 style={{ color: '#0f172a', margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Atividades Resumo</h2>
          <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '2px 0 0 0' }}>Painel do gestor para acompanhar dia, semana, mês e responsáveis.</p>
        </div>
        <span className="table-badge badge-status-and">Gestor</span>
      </div>

      <div className="atividade-resumo-cards">
        {cards.map((card) => (
          <div key={card.title} className="atividade-resumo-card">
            <div className="atividade-resumo-card-title">
              {card.icon}
              <span>{card.title}</span>
            </div>
            <strong>{card.pct}%</strong>
            <small>{card.done}/{card.total} concluídas</small>
            <div className="atividade-period-track"><div style={{ width: `${card.pct}%` }} /></div>
          </div>
        ))}
      </div>

      <div className="atividade-resumo-grid">
        <section className="atividade-resumo-panel">
          <div className="atividade-resumo-section-title">
            <CalendarDays size={18} />
            <h3>Agenda da semana</h3>
          </div>
          <div className="atividade-resumo-day-bars">
            {summary.dayBars.map((day) => (
              <div key={day.dateKey} className="atividade-resumo-day">
                <span>{day.label}</span>
                <strong>{day.pct}%</strong>
                <div className="atividade-period-track"><div style={{ width: `${day.pct}%` }} /></div>
                <small>{day.done}/{day.total}</small>
              </div>
            ))}
          </div>
          <div className="atividade-resumo-legenda">
            <span><i className="done" /> Concluído</span>
            <span><i className="progress" /> Em andamento</span>
            <span><i className="pending" /> Pendente</span>
          </div>
        </section>

        <section className="atividade-resumo-panel">
          <div className="atividade-resumo-section-title">
            <Users size={18} />
            <h3>Por funcionário</h3>
          </div>
          <div className="atividade-resumo-employees">
            {summary.employees.length === 0 && (
              <p className="atividade-resumo-empty">Abra ou cadastre rotinas diárias, semanais e mensais para alimentar o resumo.</p>
            )}
            {summary.employees.map((employee) => (
              <div key={employee.name} className="atividade-resumo-employee">
                <div>
                  <strong>{employee.name}</strong>
                  <span>{employee.done}/{employee.total} concluídas</span>
                </div>
                <b>{employee.pct}%</b>
                <div className="atividade-period-track"><div style={{ width: `${employee.pct}%` }} /></div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="atividade-period-notes">
        <label><NotepadText size={15} /> Anotações do gestor</label>
        <textarea
          value={note}
          onChange={(e) => handleNoteChange(e.target.value)}
          placeholder="Registre o que foi feito, o que não foi, gargalos por funcionário e próximos combinados."
        />
      </div>
    </div>
  );
};
