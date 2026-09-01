import {
  OBRIGACAO_DIAS_SEMANA,
  OBRIGACAO_MESES,
  OBRIGACAO_PERIODICIDADE_LABELS,
  type ObrigacaoPeriodicidade,
} from './obrigacoes.types';

export interface ObrigacaoSchedule {
  periodicidade: ObrigacaoPeriodicidade;
  temVencimento: boolean;
  diaVencimento?: number;
  diaPrimeiraQuinzena?: number;
  diaSegundaQuinzena?: number;
  diaSemana?: number;
  dataVencimento?: string;
  mesVencimento?: number;
}

const formatIsoDate = (value?: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : 'data a definir';
};

export const formatObrigacaoSchedule = (schedule: ObrigacaoSchedule) => {
  const label = OBRIGACAO_PERIODICIDADE_LABELS[schedule.periodicidade];
  if (schedule.periodicidade === 'unica') {
    const occurrence = `Único · ocorrência em ${formatIsoDate(schedule.dataVencimento)}`;
    return schedule.temVencimento ? occurrence : `${occurrence} · sem prazo fiscal`;
  }
  if (schedule.periodicidade === 'semanal') {
    const weekday = OBRIGACAO_DIAS_SEMANA.find((item) => item.value === schedule.diaSemana);
    const execution = `Semanal · execução na ${weekday?.label ?? 'data a definir'}`;
    return schedule.temVencimento ? execution : `${execution} · sem prazo fiscal`;
  }
  if (schedule.periodicidade === 'anual') {
    const month = OBRIGACAO_MESES[(schedule.mesVencimento ?? 0) - 1];
    const day = schedule.diaVencimento ?? 'dia a definir';
    const occurrence = `Anual · ocorrência em ${day} de ${month?.toLocaleLowerCase('pt-BR') ?? 'mês a definir'}`;
    return schedule.temVencimento ? occurrence : `${occurrence} · sem prazo fiscal`;
  }
  if (schedule.periodicidade === 'diaria') {
    return schedule.temVencimento
      ? 'Diário · execução diária'
      : 'Diário · execução diária · sem prazo fiscal';
  }
  if (!schedule.temVencimento) return `${label} · sem vencimento fixo`;
  if (schedule.periodicidade === 'quinzenal') {
    return `Quinzenal · dias ${schedule.diaPrimeiraQuinzena ?? 15} e ${schedule.diaSegundaQuinzena ?? 30}`;
  }
  return `${label} · vence dia ${schedule.diaVencimento ?? 'a definir'}`;
};

export const hasMonthlyCompetenceReference = (periodicidade: ObrigacaoPeriodicidade) => (
  ['quinzenal', 'mensal', 'trimestral', 'semestral'].includes(periodicidade)
);
