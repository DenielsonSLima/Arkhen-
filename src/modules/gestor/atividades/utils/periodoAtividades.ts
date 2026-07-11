export interface PeriodTask {
  id: string;
  tarefa: string;
  responsavel: string;
  concluida: boolean;
  concluidaEm?: string;
  concluidaPor?: string;
}

export const getTodayISO = () => new Date().toISOString().split('T')[0];

export const getCurrentMonthKey = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
};

const getMonday = (date: Date) => {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

export const getWeekKeyFromDate = (date: Date) => {
  const monday = getMonday(date);
  return monday.toISOString().split('T')[0];
};

export const getCurrentWeekKey = () => getWeekKeyFromDate(new Date());

export const shiftDateKey = (dateKey: string, amount: number) => {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().split('T')[0];
};

export const shiftWeekKey = (weekKey: string, amount: number) => shiftDateKey(weekKey, amount * 7);

export const shiftMonthKey = (monthKey: string, amount: number) => {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const getWeekLabel = (weekKey: string) => {
  const start = new Date(`${weekKey}T00:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
};

export const getWeekInputValue = (weekKey: string) => {
  const date = new Date(`${weekKey}T00:00:00`);
  const firstThursday = new Date(date.getFullYear(), 0, 4);
  const firstMonday = getMonday(firstThursday);
  const diffDays = Math.round((date.getTime() - firstMonday.getTime()) / 86400000);
  const week = Math.floor(diffDays / 7) + 1;
  return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
};

export const getWeekKeyFromInput = (value: string) => {
  const [yearRaw, weekRaw] = value.split('-W');
  const year = Number(yearRaw);
  const week = Number(weekRaw);
  const firstThursday = new Date(year, 0, 4);
  const firstMonday = getMonday(firstThursday);
  firstMonday.setDate(firstMonday.getDate() + (week - 1) * 7);
  return firstMonday.toISOString().split('T')[0];
};

export const loadPeriodTasks = (storageKey: string, periodKey: string, defaults: PeriodTask[]) => {
  void storageKey;
  void periodKey;
  void defaults;
  return [];
};

export const getStoredPeriodTasks = (storageKey: string, periodKey: string) => {
  void storageKey;
  void periodKey;
  return [];
};

export const savePeriodTasks = (storageKey: string, periodKey: string, tasks: PeriodTask[]) => {
  void storageKey;
  void periodKey;
  void tasks;
};

export const loadPeriodNote = (storageKey: string, periodKey: string) => {
  void storageKey;
  void periodKey;
  return '';
};

export const savePeriodNote = (storageKey: string, periodKey: string, note: string) => {
  void storageKey;
  void periodKey;
  void note;
};

export const getProgress = (tasks: PeriodTask[]) => {
  const total = tasks.length;
  const done = tasks.filter((task) => task.concluida).length;
  return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
};

export const getUsuarioLogado = (fallback: string) => {
  return fallback;
};
