import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  tarefaChecklistAuditService,
  type TarefaChecklistAuditEvent,
} from '../services/tarefaChecklistAuditService';
import { tarefaChecklistAuditKeys } from '../queries/tarefaChecklistAuditQueries';

export { tarefaChecklistAuditKeys } from '../queries/tarefaChecklistAuditQueries';

const EMPTY_AUDIT_EVENTS: TarefaChecklistAuditEvent[] = [];

export const buildLatestAuditByStep = (
  events: TarefaChecklistAuditEvent[],
): Map<number, TarefaChecklistAuditEvent> => {
  const latestByStep = new Map<number, TarefaChecklistAuditEvent>();

  events.forEach((event) => {
    const current = latestByStep.get(event.stepIndex);
    if (!current || new Date(event.createdAt).getTime() > new Date(current.createdAt).getTime()) {
      latestByStep.set(event.stepIndex, event);
    }
  });

  return latestByStep;
};

export const useTarefaChecklistAudit = (taskId: string | null) => {
  const auditQuery = useQuery({
    queryKey: tarefaChecklistAuditKeys.byTask(taskId),
    queryFn: taskId
      ? () => tarefaChecklistAuditService.listByTask(taskId)
      : async () => EMPTY_AUDIT_EVENTS,
    enabled: Boolean(taskId),
    staleTime: 15_000,
  });
  const events = auditQuery.data || EMPTY_AUDIT_EVENTS;
  const latestByStep = useMemo(() => buildLatestAuditByStep(events), [events]);

  return {
    events,
    latestByStep,
    isLoading: auditQuery.isLoading,
    isError: auditQuery.isError,
    error: auditQuery.error,
    refetch: auditQuery.refetch,
  };
};
