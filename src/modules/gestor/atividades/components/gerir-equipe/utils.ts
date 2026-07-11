import { addDaysKey, todayKey, type TarefaGestor } from '../../services/rotinasAtividadesService';
import type { CompanyActivityGroup } from '../../hooks/useAtividades';
import { AVATARES_USUARIOS, PERFIS_USUARIOS } from './config';
import type { PeriodoFiltro, TaskSummary, UserStats } from './types';

export const getPct = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0);

export const getMonday = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`);
  const day = date.getDay();
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
  return date.toISOString().split('T')[0];
};

export const shiftPeriodDate = (periodo: PeriodoFiltro, dataBase: string, amount: number) => {
  if (periodo === 'empresas') return dataBase;
  if (periodo === 'dia') return addDaysKey(dataBase, amount);
  if (periodo === 'semana') return addDaysKey(dataBase, amount * 7);

  const date = new Date(`${dataBase}T00:00:00`);
  date.setMonth(date.getMonth() + amount);
  return date.toISOString().split('T')[0];
};

export const isTaskInPeriod = (task: TarefaGestor, periodo: PeriodoFiltro, dataBase: string) => {
  if (periodo === 'empresas') return false;
  if (periodo === 'dia') return task.vencimento === dataBase;
  if (periodo === 'semana') {
    const monday = getMonday(dataBase);
    const sunday = addDaysKey(monday, 6);
    return task.vencimento >= monday && task.vencimento <= sunday;
  }
  return task.vencimento.slice(0, 7) === dataBase.slice(0, 7);
};

export const getUserStats = (
  responsaveis: string[],
  tarefas: TarefaGestor[],
  companyGroups: CompanyActivityGroup[],
): UserStats[] => responsaveis.map((nome) => {
  const userTasks = tarefas.filter((tarefa) => tarefa.responsavel === nome);
  const groups = companyGroups.filter((group) => group.responsavel === nome);
  const pendentes = userTasks.filter((tarefa) => tarefa.status !== 'Concluída').length;
  const atrasadas = userTasks.filter((tarefa) => tarefa.status !== 'Concluída' && tarefa.vencimento < todayKey()).length;
  const totalEmpresa = groups.reduce((acc, group) => acc + group.atividades.length, 0);
  const doneEmpresa = groups.reduce((acc, group) => (
    acc + group.atividades.filter((atividade) => atividade.status === 'Concluída').length
  ), 0);
  const doneTasks = userTasks.filter((tarefa) => tarefa.status === 'Concluída').length;

  return {
    nome,
    perfil: PERFIS_USUARIOS[nome] || 'Colaborador',
    avatar: AVATARES_USUARIOS[nome] || 'U',
    total: userTasks.length + totalEmpresa,
    progresso: getPct(doneTasks + doneEmpresa, userTasks.length + totalEmpresa),
    pendentes,
    atrasadas,
  };
});

export const getTaskSummary = (tasks: TarefaGestor[]): TaskSummary => ({
  done: tasks.filter((task) => task.status === 'Concluída').length,
  progress: tasks.filter((task) => task.status === 'Em andamento').length,
  late: tasks.filter((task) => task.status !== 'Concluída' && task.vencimento < todayKey()).length,
  total: tasks.length,
});
