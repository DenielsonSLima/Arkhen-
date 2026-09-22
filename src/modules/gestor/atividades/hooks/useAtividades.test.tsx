/** @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMock = vi.hoisted(() => ({
  getModelos: vi.fn(),
  getClientes: vi.fn(),
  ensureInstancias: vi.fn(),
  getInstancias: vi.fn(),
  getFechamentoMeta: vi.fn(),
  saveCliente: vi.fn(),
  saveInstancia: vi.fn(),
  saveValoresTarefa: vi.fn(),
}));

vi.mock('../services/atividadesService', () => ({
  atividadesService: serviceMock,
}));

const operational = vi.hoisted(() => ({ updateChecklist: vi.fn() }));
vi.mock('../services/tarefasOperacionaisService', () => ({ tarefasOperacionaisService: operational }));

import { useAtividades } from './useAtividades';

const wrapper = ({ children }: React.PropsWithChildren) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;

describe('useAtividades internal-tab context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMock.getModelos.mockResolvedValue([
      { id: 'modelo-1', codigo: 'modelo-1', nome: 'Rotina fiscal', tipos: [] },
    ]);
    serviceMock.getClientes.mockResolvedValue([
      {
        id: 'cliente-1',
        nome: 'Empresa teste',
        cnpj: '00000000000100',
        regime: 'Simples Nacional',
        tipoEstabelecimento: 'Matriz',
        modelosAtivos: ['modelo-1'],
      },
    ]);
    serviceMock.ensureInstancias.mockResolvedValue(undefined);
    serviceMock.getInstancias.mockResolvedValue([
      {
        id: 'instancia-1',
        clienteId: 'cliente-1',
        modeloId: 'modelo-1',
        competencia: '06/2026',
        status: 'Pendente',
        checklists: { Conferir: false },
      },
    ]);
    serviceMock.getFechamentoMeta.mockResolvedValue({
      finalizado: false,
      dataHora: '',
      usuario: '',
    });
  });

  it('selects the requested company once without a render feedback loop', async () => {
    const { result } = renderHook(() => useAtividades({
      initialCompanyId: 'cliente-1',
      initialCompetencia: '06/2026',
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.selectedGroup?.id).toBe('cliente-1-06-2026');
    });

    expect(serviceMock.getModelos).toHaveBeenCalledTimes(1);
    expect(serviceMock.getClientes).toHaveBeenCalledTimes(1);
    expect(serviceMock.getFechamentoMeta).toHaveBeenCalledTimes(1);
  });

  it('keeps a new company without implicit routines until the user selects them', async () => {
    serviceMock.getClientes.mockResolvedValueOnce([
      {
        id: 'cliente-sem-rotinas',
        nome: 'Empresa sem rotinas',
        cnpj: '00000000000200',
        regime: 'Simples Nacional',
        tipoEstabelecimento: 'Matriz',
        modelosAtivos: [],
      },
    ]);
    serviceMock.getInstancias.mockResolvedValue([]);

    const { result } = renderHook(() => useAtividades(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(serviceMock.saveCliente).not.toHaveBeenCalled();
    expect(result.current.companyGroups).toEqual([]);
  });
  it('retains old pending periods without materializing new instances on read', async () => {
    serviceMock.getInstancias.mockResolvedValue([{ id: 'old', clienteId: 'cliente-1', modeloId: 'modelo-1', competencia: '01/2024', status: 'Pendente', checklists: { Conferir: false } }]);
    const { result } = renderHook(() => useAtividades(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.companyGroups[0].competencia).toBe('01/2024');
    expect(serviceMock.ensureInstancias).not.toHaveBeenCalled();
  });

  it('does not display tax values as saved when persistence is rejected', async () => {
    serviceMock.getInstancias.mockResolvedValue([{ id: 'instancia-1', clienteId: 'cliente-1', modeloId: 'modelo-1', competencia: '06/2026', fonte: 'tarefa', status: 'Pendente', checklists: { Conferir: false } }]);
    serviceMock.saveValoresTarefa.mockRejectedValue(new Error('Sem permissão'));
    const { result } = renderHook(() => useAtividades(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await expect(result.current.handleSaveTaxValores('instancia-1', { valorPis: 123 })).rejects.toThrow('Sem permissão'); });
    expect(result.current.companyGroups[0].atividades[0].valores).toBeUndefined();
    expect(result.current.error?.message).toBe('Sem permissão');
  });

  it('uses original checklist index and never marks awaiting review as concluded', async () => {
    serviceMock.getInstancias.mockResolvedValue([{ id: 'task', clienteId: 'cliente-1', modeloId: 'modelo-1', competencia: '06/2026', fonte: 'tarefa', status: 'Aguardando revisão', checklists: { Alfa: true, Zeta: true }, checklistIndices: { Alfa: 1, Zeta: 0 } }]);
    operational.updateChecklist.mockRejectedValue(new Error('Reabra a tarefa'));
    const { result } = renderHook(() => useAtividades(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.companyGroups[0].statusGeral).toBe('Em andamento');
    await act(async () => result.current.handleToggleStep('task', 'Alfa', false));
    expect(operational.updateChecklist).toHaveBeenCalledWith('task', 1, false);
    expect(result.current.companyGroups[0].atividades[0].checklists.Alfa).toBe(true);
  });

  it('refuses legacy changes explicitly without attempting a denied write', async () => {
    const { result } = renderHook(() => useAtividades(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => result.current.handleToggleStep('instancia-1', 'Conferir', true));
    expect(result.current.error?.message).toContain('migração');
    await act(async () => { await expect(result.current.handleSaveTaxValores('instancia-1', { valorPis: 10 })).rejects.toThrow('migração'); });
    expect(serviceMock.saveInstancia).not.toHaveBeenCalled();
    expect(serviceMock.saveValoresTarefa).not.toHaveBeenCalled();
    expect(result.current.companyGroups[0].atividades[0].checklists.Conferir).toBe(false);
  });

});
