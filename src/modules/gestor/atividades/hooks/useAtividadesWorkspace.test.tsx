/** @vitest-environment jsdom */

import React from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMock = vi.hoisted(() => ({
  getWorkspace: vi.fn(),
  getPodeGerenciar: vi.fn(),
  atribuirResponsavelRotina: vi.fn(),
  atribuirResponsavelRotinasEmLote: vi.fn(),
  updateTarefaProgress: vi.fn(),
  updateTarefaChecklist: vi.fn(),
}));

vi.mock('../services/rotinasAtividadesService', () => ({
  rotinasAtividadesService: serviceMock,
}));

import { useAtividadesWorkspace } from './useAtividadesWorkspace';
import type { RotinaAtividade } from '../services/rotinasAtividadesService';
import { tarefaChecklistAuditKeys } from '../queries/tarefaChecklistAuditQueries';
import { protocolosKeys } from '../../protocolos/queries/protocolosQueries';

const taskId = '77777777-7777-4777-8777-777777777777';

const makeQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

const makeWrapper = (queryClient = makeQueryClient()) => (
  ({ children }: React.PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
);

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
  serviceMock.atribuirResponsavelRotina.mockResolvedValue({});
  serviceMock.atribuirResponsavelRotinasEmLote.mockResolvedValue({
    total: 0,
    atualizadas: [],
    falhas: [],
  });
});

afterEach(cleanup);

describe('useAtividadesWorkspace task mutations', () => {
  it('expõe mutações aguardáveis para o drawer controlar pending e erros', async () => {
    serviceMock.updateTarefaProgress.mockResolvedValueOnce({ id: taskId });
    serviceMock.updateTarefaChecklist.mockResolvedValueOnce({ id: taskId });
    const { result } = renderHook(() => useAtividadesWorkspace(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateTarefaAsync(taskId, { observacaoFalta: 'Documento ausente' });
      await result.current.toggleChecklistAsync(taskId, 0, true);
    });

    expect(serviceMock.updateTarefaProgress).toHaveBeenCalledWith(taskId, {
      observacaoFalta: 'Documento ausente',
    });
    expect(serviceMock.updateTarefaChecklist).toHaveBeenCalledWith(
      taskId,
      0,
      true,
      undefined,
      undefined,
    );
  });

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

  it('invalida atividades, painel, auditoria e protocolos após o toggle', async () => {
    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useAtividadesWorkspace(), {
      wrapper: makeWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.toggleChecklist(taskId, 0, true));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: tarefaChecklistAuditKeys.byTask(taskId),
        exact: true,
      });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['atividades'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: protocolosKeys.all });
  });
});

describe('useAtividadesWorkspace responsibility mutations', () => {
  it('atualiza imediatamente a rotina e apenas tarefas abertas, preservando concluídas', async () => {
    const rotina: RotinaAtividade = {
      id: '11111111-1111-4111-8111-111111111111',
      nome: 'DCTFWeb',
      categoria: 'Fiscal',
      frequencia: 'Mensal',
      intervaloDias: 30,
      responsavel: 'Ana',
      cliente: 'Empresa Alfa',
      proximaExecucao: '2026-10-15',
      prioridade: 'Média',
      ativa: true,
      checklist: [],
      observacoes: '',
    };
    let finishAssignment: (() => void) | undefined;
    serviceMock.getWorkspace.mockResolvedValueOnce({
      rotinas: [rotina],
      tarefas: [
        { id: 'aberta', rotinaId: rotina.id, status: 'Pendente', responsavel: 'Ana' },
        { id: 'concluida', rotinaId: rotina.id, status: 'Concluída', responsavel: 'Ana' },
      ],
      usuarios: [{ configUsuarioId: 'config-bruno', userId: 'auth-bruno', nome: 'Bruno' }],
      usuarioAtual: null,
      clientes: [],
      modelos: [],
    });
    serviceMock.atribuirResponsavelRotina.mockImplementationOnce(() => (
      new Promise<void>((resolve) => { finishAssignment = resolve; })
    ));
    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useAtividadesWorkspace(), {
      wrapper: makeWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      void result.current.assignResponsibleAsync({ rotina, responsibleId: 'config-bruno' });
    });

    await waitFor(() => expect(result.current.rotinas[0].responsavel).toBe('Bruno'));
    expect(result.current.tarefas.find((item) => item.id === 'aberta')?.responsavel).toBe('Bruno');
    expect(result.current.tarefas.find((item) => item.id === 'concluida')?.responsavel).toBe('Ana');

    await act(async () => { finishAssignment?.(); });
  });
});
