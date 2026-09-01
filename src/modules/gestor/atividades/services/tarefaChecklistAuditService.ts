import { supabase } from '../../../../lib/supabase';

export interface TarefaChecklistAuditEvent {
  id: string;
  taskId: string;
  stepIndex: number;
  completed: boolean;
  actorName: string;
  createdAt: string;
}

interface TarefaChecklistAuditRow {
  id?: unknown;
  tarefa_id?: unknown;
  ator_nome?: unknown;
  dados?: unknown;
  criado_em?: unknown;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ACTOR_NAME_LENGTH = 160;
const MAX_AUDIT_EVENTS_PER_TASK = 1_000;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const normalizeStepIndex = (value: unknown): number | null => {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value)
      : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
};

const normalizeCompleted = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
};

export const normalizeTarefaChecklistAuditEvent = (
  row: TarefaChecklistAuditRow,
): TarefaChecklistAuditEvent | null => {
  if (typeof row.id !== 'string' || !UUID_PATTERN.test(row.id)) return null;
  if (typeof row.tarefa_id !== 'string' || !UUID_PATTERN.test(row.tarefa_id)) return null;
  if (typeof row.criado_em !== 'string' || Number.isNaN(new Date(row.criado_em).getTime())) return null;
  if (!isRecord(row.dados)) return null;

  const stepIndex = normalizeStepIndex(row.dados.indice);
  const completed = normalizeCompleted(row.dados.concluida);
  if (stepIndex === null || completed === null) return null;

  const actorName = typeof row.ator_nome === 'string' && row.ator_nome.trim()
    ? row.ator_nome.trim().slice(0, MAX_ACTOR_NAME_LENGTH)
    : 'Usuário não identificado';

  return {
    id: row.id.trim(),
    taskId: row.tarefa_id.trim(),
    stepIndex,
    completed,
    actorName,
    createdAt: row.criado_em,
  };
};

export const tarefaChecklistAuditService = {
  async listByTask(taskId: string): Promise<TarefaChecklistAuditEvent[]> {
    if (!UUID_PATTERN.test(taskId)) throw new Error('Tarefa inválida para consulta da auditoria.');

    const { data, error } = await supabase
      .from('atividades_tarefa_eventos')
      .select('id,tarefa_id,ator_nome,dados,criado_em')
      .eq('tarefa_id', taskId)
      .eq('tipo', 'checklist')
      .order('criado_em', { ascending: false })
      .limit(MAX_AUDIT_EVENTS_PER_TASK);

    if (error) throw error;
    if (!Array.isArray(data)) return [];

    return data
      .map((row) => normalizeTarefaChecklistAuditEvent(row as TarefaChecklistAuditRow))
      .filter((event): event is TarefaChecklistAuditEvent => (
        event !== null && event.taskId === taskId
      ));
  },
};
