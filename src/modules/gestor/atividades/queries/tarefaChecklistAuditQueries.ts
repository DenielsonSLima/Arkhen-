export const tarefaChecklistAuditKeys = {
  all: ['atividades', 'tarefa-checklist-auditoria'] as const,
  byTask: (taskId: string | null) => [...tarefaChecklistAuditKeys.all, taskId] as const,
};
