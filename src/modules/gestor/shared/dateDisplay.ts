const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const;

export const formatCompetencia = (value: string | null | undefined) => {
  if (!value) return '—';
  const match = /^(\d{4})-(0[1-9]|1[0-2])/.exec(value);
  if (!match) return value;
  return `${MESES[Number(match[2]) - 1]} / ${match[1]}`;
};

export const formatDateBr = (value: string | null | undefined) => {
  if (!value) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
};

