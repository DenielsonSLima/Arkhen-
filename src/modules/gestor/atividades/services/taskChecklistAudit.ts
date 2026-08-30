export interface TarefaChecklistEventRow {
  tarefa_id: string;
  tipo: string;
  ator_nome: string | null;
  motivo: string | null;
  dados: unknown;
  criado_em: string;
}

interface ChecklistAuditMeta {
  concluidoEm?: string;
  concluidoPor?: string;
}

export interface TaskAuditSummary {
  checklistByIndex: Map<number, ChecklistAuditMeta | null>;
  concluidoPor?: string;
  relatoConclusao?: string;
}

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const getChecklistIndex = (value: unknown): number | null => {
  const dados = asRecord(value);
  const index = dados?.indice;
  return typeof index === 'number' && Number.isInteger(index) && index >= 0 ? index : null;
};

export const buildTaskAuditSummaries = (events: TarefaChecklistEventRow[]) => {
  const summaries = new Map<string, TaskAuditSummary>();

  events.forEach((event) => {
    const summary = summaries.get(event.tarefa_id) || {
      checklistByIndex: new Map<number, ChecklistAuditMeta | null>(),
    };
    summaries.set(event.tarefa_id, summary);

    if (event.tipo === 'checklist') {
      const index = getChecklistIndex(event.dados);
      if (index === null || summary.checklistByIndex.has(index)) return;

      const dados = asRecord(event.dados);
      summary.checklistByIndex.set(index, dados?.concluida === true
        ? {
          concluidoEm: event.criado_em,
          concluidoPor: event.ator_nome || undefined,
        }
        : null);
      return;
    }

    if (event.tipo === 'concluida' && !summary.concluidoPor) {
      summary.concluidoPor = event.ator_nome || undefined;
      summary.relatoConclusao = event.motivo?.trim() || undefined;
    }
  });

  return summaries;
};
