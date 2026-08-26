/** @vitest-environment jsdom */

import type { PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMock = vi.hoisted(() => ({
  getModelos: vi.fn(),
  getClientes: vi.fn(),
  ensureInstancias: vi.fn(),
  getInstancias: vi.fn(),
  getFechamentoMeta: vi.fn(),
  saveFechamentoMeta: vi.fn(),
  atualizarChecklist: vi.fn(),
  atualizarValores: vi.fn(),
}));

vi.mock('../services/atividadesService', () => ({
  atividadesService: serviceMock,
}));

import { useAtividades } from './useAtividades';

const expectedActivityInvalidations = [
  ['atividades'],
  ['inicio'],
  ['agenda'],
  ['conformidade'],
];

const createHarness = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
};

const getInvalidatedKeys = (invalidateQueries: ReturnType<typeof vi.fn>) => (
  invalidateQueries.mock.calls.map(([filters]) => filters.queryKey)
);

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
    serviceMock.ensureInstancias.mockResolvedValue(0);
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
    serviceMock.saveFechamentoMeta.mockImplementation(async (_clienteId, _competencia, meta) => meta);
    serviceMock.atualizarChecklist.mockImplementation(async (_id, etapa, value) => ({
      ...serviceMock.getInstancias.mock.results[0]?.value?.[0],
      id: 'instancia-1',
      clienteId: 'cliente-1',
      modeloId: 'modelo-1',
      competencia: '06/2026',
      status: value ? 'Concluída' : 'Pendente',
      checklists: { [etapa]: value },
    }));
    serviceMock.atualizarValores.mockImplementation(async (_id, valores) => ({
      id: 'instancia-1',
      clienteId: 'cliente-1',
      modeloId: 'modelo-1',
      competencia: '06/2026',
      status: 'Pendente',
      checklists: { Conferir: false },
      valores,
    }));
  });

  it('selects the requested company once without a render feedback loop', async () => {
    const responsaveisPorGrupo = { 'cliente-1:06/2026': 'Denielson' };
    const { Wrapper } = createHarness();
    const { result } = renderHook(() => useAtividades({
      initialCompanyId: 'cliente-1',
      initialCompetencia: '2026-06',
      canMaterialize: true,
      responsaveisPorGrupo,
    }), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.selectedGroup?.id).toBe('cliente-1-06-2026');
    });

    expect(serviceMock.getModelos).toHaveBeenCalledTimes(1);
    expect(serviceMock.getClientes).toHaveBeenCalledTimes(1);
    expect(serviceMock.ensureInstancias).toHaveBeenCalledOnce();
    expect(serviceMock.ensureInstancias).toHaveBeenCalledWith('06/2026');
    expect(serviceMock.getInstancias).toHaveBeenCalledOnce();
    expect(serviceMock.getInstancias).toHaveBeenCalledWith('06/2026');
    expect(serviceMock.getFechamentoMeta).toHaveBeenCalledTimes(1);
    expect(result.current.selectedGroup?.responsavel).toBe('Denielson');
  });

  it('uses the current month when no initial competencia is provided', async () => {
    const now = new Date();
    const expectedCompetencia = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    const { Wrapper } = createHarness();
    renderHook(() => useAtividades({ canMaterialize: true }), { wrapper: Wrapper });

    await waitFor(() => {
      expect(serviceMock.ensureInstancias).toHaveBeenCalledWith(expectedCompetencia);
      expect(serviceMock.getInstancias).toHaveBeenCalledWith(expectedCompetencia);
    });
  });

  it('expõe falha de acesso sem apresentar a carga como um estado vazio válido', async () => {
    const accessError = Object.assign(new Error('permission denied'), { code: '42501' });
    serviceMock.getClientes.mockRejectedValueOnce(accessError);
    const { Wrapper } = createHarness();
    const { result } = renderHook(() => useAtividades({ canMaterialize: false }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.loadError).toBe(accessError);
    expect(result.current.companyGroups).toEqual([]);
  });

  it('expõe falha de materialização sem consultar uma lista possivelmente incompleta', async () => {
    const materializationError = new Error('materialização indisponível');
    serviceMock.ensureInstancias.mockRejectedValueOnce(materializationError);
    const { Wrapper } = createHarness();
    const { result } = renderHook(() => useAtividades({ canMaterialize: true }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.loadError).toBe(materializationError);
    expect(serviceMock.getInstancias).not.toHaveBeenCalled();
    expect(result.current.companyGroups).toEqual([]);
  });

  it('invalida todos os módulos dependentes em cada caminho de escrita', async () => {
    const { queryClient, Wrapper } = createHarness();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    serviceMock.ensureInstancias.mockResolvedValueOnce(1);
    const { result } = renderHook(() => useAtividades({
      initialCompanyId: 'cliente-1',
      initialCompetencia: '2026-06',
      canMaterialize: true,
    }), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.selectedGroup?.id).toBe('cliente-1-06-2026');
    });
    expect(getInvalidatedKeys(invalidateQueries)).toEqual(expectedActivityInvalidations);

    invalidateQueries.mockClear();
    await act(async () => {
      await result.current.handleSaveFechamentoMeta({
        finalizado: true,
        dataHora: '2026-06-30T18:00:00.000Z',
        usuario: 'Pessoa Real',
      });
    });
    expect(getInvalidatedKeys(invalidateQueries)).toEqual(expectedActivityInvalidations);

    invalidateQueries.mockClear();
    await act(async () => {
      await result.current.handleToggleStep('instancia-1', 'Conferir', true);
    });
    expect(getInvalidatedKeys(invalidateQueries)).toEqual(expectedActivityInvalidations);

    invalidateQueries.mockClear();
    await act(async () => {
      await result.current.handleSaveTaxValores('instancia-1', { valorInss: 1500 });
    });
    expect(getInvalidatedKeys(invalidateQueries)).toEqual(expectedActivityInvalidations);
  });
});
