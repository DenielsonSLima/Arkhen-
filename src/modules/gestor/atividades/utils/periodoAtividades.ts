import { persistedStorage } from '../../../../lib/persistedStorage';

export interface PeriodTask {
  id: string;
  tarefa: string;
  responsavel: string;
  concluida: boolean;
  concluidaEm?: string;
  concluidaPor?: string;
}

const TASK_STORAGE_KEY = 'contabil_atividade_period_tasks_v1';
const NOTE_STORAGE_KEY = 'contabil_atividade_period_notes_v1';

const parseJson = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as T;
    return parsed;
  } catch {
    return fallback;
  }
};

const canUseStorage = () => typeof window !== 'undefined';

type PeriodStore = Record<string, Record<string, PeriodTask[]>>;
type NoteStore = Record<string, Record<string, string>>;

const readPeriodTasksStore = (): PeriodStore => {
  if (!canUseStorage()) return {};
  return parseJson(persistedStorage.getItem(TASK_STORAGE_KEY), {} as PeriodStore);
};

const writePeriodTasksStore = (value: PeriodStore) => {
  if (!canUseStorage()) return;
  persistedStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(value));
};

const readPeriodNoteStore = (): NoteStore => {
  if (!canUseStorage()) return {};
  return parseJson(persistedStorage.getItem(NOTE_STORAGE_KEY), {} as NoteStore);
};

const writePeriodNoteStore = (value: NoteStore) => {
  if (!canUseStorage()) return;
  persistedStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify(value));
};

const sanitizePeriodTask = (task: unknown): PeriodTask | null => {
  if (!task || typeof task !== 'object') return null;
  const record = task as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : '';
  const tarefa = typeof record.tarefa === 'string' ? record.tarefa : '';
  const responsavel = typeof record.responsavel === 'string' ? record.responsavel : '';
  const concluida = Boolean(record.concluida);
  if (!id || !tarefa || !responsavel) return null;

  return {
    id,
    tarefa,
    responsavel,
    concluida,
    concluidaEm: typeof record.concluidaEm === 'string' ? record.concluidaEm : undefined,
    concluidaPor: typeof record.concluidaPor === 'string' ? record.concluidaPor : undefined,
  };
};

const getStoredPeriodTasksMap = (storageKey: string): Record<string, PeriodTask[]> => {
  const store = readPeriodTasksStore();
  const periodMap = store[storageKey];
  if (!periodMap || typeof periodMap !== 'object') return {};
  return periodMap;
};

const hasStoredPeriodTasks = (storageKey: string, periodKey: string) => {
  const periodMap = getStoredPeriodTasksMap(storageKey);
  return Object.prototype.hasOwnProperty.call(periodMap, periodKey);
};

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
  const hasStored = hasStoredPeriodTasks(storageKey, periodKey);
  if (!hasStored) return defaults;
  return getStoredPeriodTasks(storageKey, periodKey);
};

export const getStoredPeriodTasks = (storageKey: string, periodKey: string) => {
  const periodMap = getStoredPeriodTasksMap(storageKey);
  const tasks = periodMap[periodKey];
  if (!Array.isArray(tasks)) return [];

  return tasks
    .map(sanitizePeriodTask)
    .filter((task): task is PeriodTask => !!task);
};

export const savePeriodTasks = (storageKey: string, periodKey: string, tasks: PeriodTask[]) => {
  const store = readPeriodTasksStore();
  if (!store[storageKey]) store[storageKey] = {};
  store[storageKey][periodKey] = tasks;
  writePeriodTasksStore(store);
};

export const loadPeriodNote = (storageKey: string, periodKey: string) => {
  const noteStore = readPeriodNoteStore();
  return noteStore[storageKey]?.[periodKey] || '';
};

export const savePeriodNote = (storageKey: string, periodKey: string, note: string) => {
  const store = readPeriodNoteStore();
  if (!store[storageKey]) store[storageKey] = {};
  store[storageKey][periodKey] = note;
  writePeriodNoteStore(store);
};

export const getProgress = (tasks: PeriodTask[]) => {
  const total = tasks.length;
  const done = tasks.filter((task) => task.concluida).length;
  return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
};

export const getUsuarioLogado = (fallback: string) => {
  return fallback;
};
