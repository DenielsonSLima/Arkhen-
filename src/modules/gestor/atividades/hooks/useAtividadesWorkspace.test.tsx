/** @vitest-environment jsdom */

import React from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMock = vi.hoisted(() => ({
  getWorkspace: vi.fn(),
  getPodeGerenciar: vi.fn(),
  updateTarefaProgress: vi.fn(),
  updateTarefaChecklist: vi.fn(),
}));

vi.mock('../services/rotinasAtividadesService', () => ({
  rotinasAtividadesService: serviceMock,
}));

import { useAtividadesWorkspace } from './useAtividadesWorkspace';

const taskId = '77777777-7777-4777-8777-777777777777';

const makeWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: React.PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  serviceMock.getPodeGerenciar.mockResolvedValue(true);
  serviceMock.getWorkspace.mockResolvedValue({
    rotinas: [],
    tarefas: [{
      id: taskId,
      titulo: 'Conferir documentos',
      categoria: 'Fiscal',
      frequencia: 'Única',
      responsavel: 'Ana',
      cliente: 'Empresa Alfa',
      vencimento: '2026-09-05',
      prioridade: 'Média',
      status: 'Pendente',
      origem: 'Usuario',
      checklist: [{ titulo: 'Validar XML', concluida: false }],
      notas: 'Anterior',
    }],
    usuarios: [],
    usuarioAtual: null,
    clientes: [],
    modelos: [],
  });
  serviceMock.updateTarefaProgress.mockResolvedValue({});
  serviceMock.updateTarefaChecklist.mockResolvedValue({});
});

afterEach(cleanup);

describe('useAtividadesWorkspace task mutations', () => {
  it('encaminha somente o patch de progresso, sem remontar a tarefa inteira', async () => {
    const { result } = renderHook(() => useAtividadesWorkspace(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.updateTarefa(taskId, { notas: 'Atualizada' }));

    await waitFor(() => {
      expect(serviceMock.updateTarefaProgress).toHaveBeenCalledWith(taskId, {
        notas: 'Atualizada',
      });
    });
  });

  it('encaminha a etapa isolada para a RPC de checklist', async () => {
    const { result } = renderHook(() => useAtividadesWorkspace(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.toggleChecklist(taskId, 0, true));

    await waitFor(() => {
      expect(serviceMock.updateTarefaChecklist).toHaveBeenCalledWith(
        taskId,
        0,
        true,
        undefined,
        undefined,
      );
    });
  });

  it('encaminha a justificativa ao concluir a última etapa', async () => {
    const { result } = renderHook(() => useAtividadesWorkspace(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.toggleChecklist(
      taskId,
      0,
      true,
      undefined,
      'Protocolo conferido',
    ));

    await waitFor(() => {
      expect(serviceMock.updateTarefaChecklist).toHaveBeenCalledWith(
        taskId,
        0,
        true,
        undefined,
        'Protocolo conferido',
      );
    });
  });
});
