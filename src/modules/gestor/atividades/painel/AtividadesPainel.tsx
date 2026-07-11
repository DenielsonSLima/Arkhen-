import React, { useMemo } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, Users } from 'lucide-react';
import type { CompanyActivityGroup } from '../hooks/useAtividades';
import { useAtividadesWorkspace } from '../hooks/useAtividadesWorkspace';
import { addDaysKey, todayKey, type TarefaGestor } from '../services/rotinasAtividadesService';
import { TarefaGestorList } from '../components/TarefaGestorList';

interface AtividadesPainelProps {
  companyGroups: CompanyActivityGroup[];
}

const pct = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0);

const isInRange = (task: TarefaGestor, start: string, end: string) => task.vencimento >= start && task.vencimento <= end;

export const AtividadesPainel: React.FC<AtividadesPainelProps> = ({ companyGroups }) => {
  const { tarefas, rotinas, updateTarefa, deleteTarefa, toggleChecklist } = useAtividadesWorkspace();
  const today = todayKey();
  const weekEnd = addDaysKey(today, 6);
  const monthEnd = addDaysKey(today, 30);

  const data = useMemo(() => {
    const todayTasks = tarefas.filter((task) => task.vencimento === today);
    const weekTasks = tarefas.filter((task) => isInRange(task, today, weekEnd));
    const monthTasks = tarefas.filter((task) => isInRange(task, today, monthEnd));
    const lateTasks = tarefas.filter((task) => task.vencimento < today && task.status !== 'Concluída');
    const employees = new Map<string, { total: number; done: number }>();

    tarefas.forEach((task) => {
      const current = employees.get(task.responsavel) || { total: 0, done: 0 };
      current.total += 1;
      if (task.status === 'Concluída') current.done += 1;
      employees.set(task.responsavel, current);
    });

    companyGroups.forEach((group) => {
      const current = employees.get(group.responsavel) || { total: 0, done: 0 };
      current.total += group.atividades.length;
      current.done += group.atividades.filter((activity) => activity.status === 'Concluída').length;
      employees.set(group.responsavel, current);
    });

    return {
      todayTasks,
      weekTasks,
      monthTasks,
      lateTasks,
      employees: Array.from(employees.entries()).map(([name, item]) => ({ name, ...item, pct: pct(item.done, item.total) })),
      upcoming: [...tarefas].sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 6),
    };
  }, [companyGroups, monthEnd, tarefas, today, weekEnd]);

  const cards = [
    { label: 'Hoje', icon: <CalendarDays size={18} />, total: data.todayTasks.length, done: data.todayTasks.filter((task) => task.status === 'Concluída').length },
    { label: 'Semana', icon: <ClipboardList size={18} />, total: data.weekTasks.length, done: data.weekTasks.filter((task) => task.status === 'Concluída').length },
    { label: '30 dias', icon: <CheckCircle2 size={18} />, total: data.monthTasks.length, done: data.monthTasks.filter((task) => task.status === 'Concluída').length },
    { label: 'Atrasadas', icon: <AlertTriangle size={18} />, total: data.lateTasks.length, done: 0 },
  ];

  return (
    <div className="atividades-redesign-page">
      <div className="atividades-redesign-header">
        <div>
          <h2>Atividades - Painel</h2>
          <p>Resumo executivo das rotinas, prazos, responsáveis e pendências do escritório.</p>
        </div>
        <span>{rotinas.filter((rotina) => rotina.ativa).length} rotinas ativas</span>
      </div>

      <div className="atividades-overview-grid">
        {cards.map((card) => {
          const progress = card.label === 'Atrasadas' ? 0 : pct(card.done, card.total);
          return (
            <section key={card.label} className="atividades-overview-card">
              <div>{card.icon}<span>{card.label}</span></div>
              <strong>{card.label === 'Atrasadas' ? card.total : `${progress}%`}</strong>
              <small>{card.label === 'Atrasadas' ? 'exigem ação' : `${card.done}/${card.total} concluídas`}</small>
              <div className="atividade-period-track"><div style={{ width: `${progress}%` }} /></div>
            </section>
          );
        })}
      </div>

      <div className="atividades-two-column">
        <section className="atividades-panel-card">
          <div className="atividades-section-title"><ClipboardList size={18} /><h3>Próximas entregas</h3></div>
          <TarefaGestorList
            tarefas={data.upcoming}
            emptyText="Nenhuma tarefa gerada para os próximos dias."
            onUpdate={updateTarefa}
            onDelete={deleteTarefa}
            onToggleChecklist={toggleChecklist}
          />
        </section>

        <section className="atividades-panel-card">
          <div className="atividades-section-title"><Users size={18} /><h3>Equipe</h3></div>
          <div className="atividades-team-progress">
            {data.employees.map((employee) => (
              <div key={employee.name}>
                <span>{employee.name}</span>
                <strong>{employee.pct}%</strong>
                <small>{employee.done}/{employee.total} tarefas</small>
                <div className="atividade-period-track"><div style={{ width: `${employee.pct}%` }} /></div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
