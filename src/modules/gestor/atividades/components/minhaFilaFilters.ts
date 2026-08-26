export type MinhaFilaFiltro = 'hoje' | 'semana' | 'mes' | 'atrasadas' | 'internas';

export const MINHA_FILA_FILTROS: Array<{ id: MinhaFilaFiltro; label: string }> = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mês' },
  { id: 'atrasadas', label: 'Atrasadas' },
  { id: 'internas', label: 'Internas' },
];
