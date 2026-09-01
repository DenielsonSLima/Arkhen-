import type {
  StatusAtividadeGestor,
  TarefaGestor,
} from '../services/rotinasAtividadesService';

export interface TarefaChecklistProgress {
  completed: number;
  total: number;
  percentage: number;
}

export const addMonthsKey = (dateKey: string, months: number): string => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const targetMonth = new Date(year, month - 1 + months, 1);
  const targetYear = targetMonth.getFullYear();
  const targetMonthIndex = targetMonth.getMonth();
  const lastDay = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
  const targetDay = Math.min(day, lastDay);

  return [
    targetYear,
    String(targetMonthIndex + 1).padStart(2, '0'),
    String(targetDay).padStart(2, '0'),
  ].join('-');
};

export const getTarefaChecklistProgress = (
  tarefa: Pick<TarefaGestor, 'etapasTotal' | 'etapasConcluidas' | 'percentual'>,
): TarefaChecklistProgress => ({
  completed: tarefa.etapasConcluidas ?? 0,
  total: tarefa.etapasTotal ?? 0,
  percentage: tarefa.percentual ?? 0,
});

export const formatPersistedCompletionDateTime = (value?: string): string | null => {
  if (!value) return null;

  const completionDate = new Date(value);
  if (Number.isNaN(completionDate.getTime())) return null;

  const date = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(completionDate);
  const time = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(completionDate);

  return `${date} às ${time}`;
};

export const isTarefaReadOnly = (status: StatusAtividadeGestor) => (
  status === 'Aguardando revisão'
  || status === 'Concluída'
  || status === 'Cancelada'
);

export const isTarefaFinalizada = (status: StatusAtividadeGestor) => (
  status === 'Concluída' || status === 'Cancelada'
);

export const isTarefaAtrasada = (
  tarefa: Pick<TarefaGestor, 'status' | 'vencimento'>,
  referencia: string,
) => !isTarefaFinalizada(tarefa.status) && tarefa.vencimento < referencia;
