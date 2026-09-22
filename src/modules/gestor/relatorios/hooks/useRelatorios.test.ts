/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ companies: vi.fn(), faturamento: vi.fn(), comparativo: vi.fn() }));
vi.mock('../../gestao-empresarial/services/gestaoEmpresarialService', () => ({
  gestaoEmpresarialService: { getCompanies: mocks.companies },
}));
vi.mock('../services/relatoriosService', () => ({
  relatoriosService: { getFaturamentoReport: mocks.faturamento, calcularComparativoRegimes: mocks.comparativo },
}));
import { useRelatorios } from './useRelatorios';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
const report = (totalFaturado: number) => ({
  totalFaturado, totalRecebido: 0, totalPendente: totalFaturado,
  taxaInadimplencia: 0, historicoMensal: [], clientesMaisFaturados: [],
});

describe('relatórios vinculados às entradas da geração', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.companies.mockResolvedValue([]); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('ignora retorno do cliente anterior após mudar o filtro', async () => {
    const pending = deferred<ReturnType<typeof report>>();
    mocks.faturamento.mockReturnValue(pending.promise);
    const { result } = renderHook(useRelatorios);
    let generation!: Promise<void>;
    act(() => { generation = result.current.handleGenerateReport(); });
    act(() => result.current.setSelectedCompany('cliente-b'));
    await act(async () => { pending.resolve(report(100)); await generation; });
    expect(result.current.selectedCompany).toBe('cliente-b');
    expect(result.current.faturamentoData).toBeNull();
    expect(result.current.isGenerated).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('não substitui o resultado novo por uma requisição antiga que termina depois', async () => {
    const older = deferred<ReturnType<typeof report>>();
    mocks.faturamento.mockReturnValueOnce(older.promise).mockResolvedValueOnce(report(200));
    const { result } = renderHook(useRelatorios);
    let first!: Promise<void>;
    act(() => { first = result.current.handleGenerateReport(); });
    await act(() => result.current.handleGenerateReport());
    expect(result.current.faturamentoData?.totalFaturado).toBe(200);
    await act(async () => { older.resolve(report(100)); await first; });
    expect(result.current.faturamentoData?.totalFaturado).toBe(200);
    expect(result.current.isGenerated).toBe(true);
  });

  it('invalida o comparativo e a impressão ao editar as premissas', async () => {
    mocks.comparativo.mockResolvedValue([]);
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const { result } = renderHook(useRelatorios);
    act(() => result.current.setActiveReport('tributario'));
    await act(() => result.current.handleGenerateReport());
    expect(result.current.isGenerated).toBe(true);
    act(() => result.current.setFaturamentoAnual('2000000'));
    expect(result.current.tributarioData).toBeNull();
    act(() => result.current.handlePrint());
    expect(print).not.toHaveBeenCalled();
  });

  it('expõe erro da consulta sem apresentar sucesso', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.faturamento.mockRejectedValue(new Error('Consulta indisponível'));
    const { result } = renderHook(useRelatorios);
    await act(() => result.current.handleGenerateReport());
    await waitFor(() => expect(result.current.error?.message).toBe('Consulta indisponível'));
    expect(result.current.isGenerated).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });
});
