/** @vitest-environment jsdom */

import React from 'react';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TarefaChecklistAuditEvent } from '../services/tarefaChecklistAuditService';

const serviceMock = vi.hoisted(() => ({ listByTask: vi.fn() }));

vi.mock('../services/tarefaChecklistAuditService', () => ({
  tarefaChecklistAuditService: serviceMock,
}));

import {
  buildLatestAuditByStep,
  tarefaChecklistAuditKeys,
  useTarefaChecklistAudit,
} from './useTarefaChecklistAudit';

const taskId = '77777777-7777-4777-8777-777777777777';
const event = (overrides: Partial<TarefaChecklistAuditEvent>): TarefaChecklistAuditEvent => ({
  id: 'evento-base',
  taskId,
  stepIndex: 0,
  completed: true,
  actorName: 'Ana',
  createdAt: '2026-09-01T12:53:05-03:00',
  ...overrides,
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
const wrapper = ({ children }: React.PropsWithChildren) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  queryClient.clear();
  vi.clearAllMocks();
});

afterEach(cleanup);

describe('useTarefaChecklistAudit', () => {
  it('só carrega a auditoria quando o drawer possui uma tarefa aberta', async () => {
    serviceMock.listByTask.mockResolvedValueOnce([event({})]);
    const { result, rerender } = renderHook(
      ({ currentTaskId }) => useTarefaChecklistAudit(currentTaskId),
      { initialProps: { currentTaskId: null as string | null }, wrapper },
    );

    expect(serviceMock.listByTask).not.toHaveBeenCalled();
    expect(result.current.latestByStep.size).toBe(0);

    rerender({ currentTaskId: taskId });

    await waitFor(() => expect(result.current.latestByStep.get(0)?.actorName).toBe('Ana'));
    expect(serviceMock.listByTask).toHaveBeenCalledWith(taskId);
    expect(tarefaChecklistAuditKeys.byTask(taskId)).toEqual([
      'atividades',
      'tarefa-checklist-auditoria',
      taskId,
    ]);
  });
});

describe('buildLatestAuditByStep', () => {
  it('mantém somente o evento mais recente de cada etapa, inclusive reabertura', () => {
    const latestByStep = buildLatestAuditByStep([
      event({ id: 'concluiu', completed: true, createdAt: '2026-09-01T12:00:00-03:00' }),
      event({ id: 'reabriu', completed: false, createdAt: '2026-09-01T13:00:00-03:00' }),
      event({ id: 'outra-etapa', stepIndex: 1, createdAt: '2026-09-01T12:30:00-03:00' }),
    ]);

    expect(latestByStep.get(0)).toMatchObject({ id: 'reabriu', completed: false });
    expect(latestByStep.get(1)?.id).toBe('outra-etapa');
  });
});
