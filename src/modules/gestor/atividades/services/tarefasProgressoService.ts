import { supabase } from '../../../../lib/supabase';

export interface TarefaProgressoOperacional {
  tarefaId: string;
  etapasTotal: number;
  etapasConcluidas: number;
  percentual: number;
}

type JsonRecord = Record<string, unknown>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const boundedInteger = (value: unknown, maximum = Number.MAX_SAFE_INTEGER) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(maximum, Math.max(0, Math.round(value)));
};

const normalizeProgress = (value: unknown): TarefaProgressoOperacional | null => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as JsonRecord;
  const tarefaId = typeof item.tarefaId === 'string' ? item.tarefaId.trim() : '';
  if (!UUID_PATTERN.test(tarefaId)) return null;

  const etapasTotal = boundedInteger(item.etapasTotal);
  return {
    tarefaId,
    etapasTotal,
    etapasConcluidas: Math.min(etapasTotal, boundedInteger(item.etapasConcluidas)),
    percentual: boundedInteger(item.percentual, 100),
  };
};

export const normalizeTarefasProgresso = (value: unknown) => {
  const result = new Map<string, TarefaProgressoOperacional>();
  if (!Array.isArray(value)) return result;

  value.forEach((entry) => {
    const progress = normalizeProgress(entry);
    if (progress) result.set(progress.tarefaId, progress);
  });
  return result;
};

export const tarefasProgressoService = {
  async getAll() {
    const { data, error } = await supabase.rpc('obter_progresso_tarefas_operacionais');
    if (error) throw error;
    return normalizeTarefasProgresso(data);
  },
};
