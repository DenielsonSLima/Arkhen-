import { addDaysKey, type TarefaGestor } from '../../services/rotinasAtividadesService';
import type { ColaboradorOperacional } from '../../services/painelOperacionalService';
import { AVATARES_USUARIOS, PERFIS_USUARIOS } from './config';
import type { PeriodoFiltro, TaskSummary, UserStats, UsuarioEquipe } from './types';

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
  const prazoOperacional = task.prazoInterno || task.vencimento;
  if (periodo === 'empresas') return false;
  if (periodo === 'dia') return prazoOperacional === dataBase;
  if (periodo === 'semana') {
    const monday = getMonday(dataBase);
    const sunday = addDaysKey(monday, 6);
    return prazoOperacional >= monday && prazoOperacional <= sunday;
  }
  return prazoOperacional.slice(0, 7) === dataBase.slice(0, 7);
};

export const getUserStats = (
  responsaveis: UsuarioEquipe[],
  colaboradores: ColaboradorOperacional[],
): UserStats[] => responsaveis.map((usuario) => {
  const stats = colaboradores.find((item) => (
    usuario.configUsuarioId
      ? item.responsavelConfigUsuarioId === usuario.configUsuarioId
      : item.responsavel === usuario.nome
  ));

  return {
    id: usuario.id,
    nome: usuario.nome,
    perfil: PERFIS_USUARIOS[usuario.nome] || 'Colaborador',
    avatar: AVATARES_USUARIOS[usuario.nome] || 'U',
    total: stats?.total || 0,
    progresso: stats?.percentualConcluido || 0,
    pendentes: stats?.pendentes || 0,
    atrasadas: stats?.atrasadas || 0,
    emRisco: stats?.emRisco || 0,
    comPendencia: stats?.comPendencia || 0,
    vencendoHoje: stats?.vencendoHoje || 0,
    taxaNoPrazo: stats?.taxaNoPrazo || 0,
  };
});

export const getTaskSummary = (stats?: ColaboradorOperacional): TaskSummary => ({
  done: stats?.concluidas || 0,
  progress: stats?.emAndamento || 0,
  pending: stats?.pendentes || 0,
  late: stats?.atrasadas || 0,
  atRisk: stats?.emRisco || 0,
  withIssue: stats?.comPendencia || 0,
  dueToday: stats?.vencendoHoje || 0,
  dueSoon: stats?.vencendoSeteDias || 0,
  onTimeRate: stats?.taxaNoPrazo || 0,
  total: stats?.total || 0,
});
