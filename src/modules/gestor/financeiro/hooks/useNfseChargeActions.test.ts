/** @vitest-environment jsdom */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CobrancaFinanceira } from '../services/financeiroService';

const mocks = vi.hoisted(() => ({ consult: vi.fn(), download: vi.fn() }));
vi.mock('../queries/useFinanceiroQueries', () => ({
  useConsultarNfseFinanceiraMutation: () => ({ mutateAsync: mocks.consult, isPending: false }),
}));
vi.mock('../services/nfseDocumentService', () => ({ downloadNfseDocument: mocks.download }));
import { useNfseChargeActions } from './useNfseChargeActions';

const charge = { id: 'charge-a', empresaId: 'tenant-a', nfseRpsNumero: '1', status: 'Pendente' } as CobrancaFinanceira;
const homologacao = { nfseId: '123', ambiente: 'homologacao', situacao: 'confirmada' };
afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); mocks.consult.mockResolvedValue(homologacao); });

describe('Escopo do resultado fiscal da cobrança', () => {
  it('troca o PDF de homologação pelo documento de produção atualizado', async () => {
    const { result, rerender } = renderHook(item => useNfseChargeActions(item), { initialProps: charge });
    await act(() => result.current.consult());
    expect(result.current.feedback?.message).toContain('homologação');
    rerender({ ...charge, nfseId: '987', nfseStatus: 'emitida' });
    expect(result.current.feedback).toBeNull();
    await act(() => result.current.download());
    expect(mocks.download).toHaveBeenCalledWith('tenant-a', 'charge-a', expect.objectContaining({ nfseId: '987', ambiente: 'producao' }));
  });

  it.each(['cancelada', 'substituida'])('descarta confirmação antiga quando o status muda para %s', async nfseStatus => {
    mocks.consult.mockResolvedValue({ ...homologacao, ambiente: 'producao' });
    const { result, rerender } = renderHook(item => useNfseChargeActions(item), {
      initialProps: { ...charge, nfseId: '123', nfseStatus: 'emitida' },
    });
    await act(() => result.current.consult());
    expect(result.current.feedback?.message).toContain('confirmada');
    rerender({ ...charge, nfseId: '123', nfseStatus });
    expect(result.current.feedback).toBeNull();
    await act(() => result.current.download());
    expect(mocks.download).toHaveBeenCalledWith('tenant-a', 'charge-a', expect.objectContaining({ nfseId: '123', situacao: nfseStatus }));
  });

  it.each(['id', 'empresaId'] as const)('descarta resposta atrasada após mudar %s sem cancelar a operação em andamento', async field => {
    let resolve!: (value: unknown) => void;
    mocks.consult.mockImplementation(() => new Promise(done => { resolve = done; }));
    const { result, rerender } = renderHook(item => useNfseChargeActions(item), { initialProps: charge });
    let operation!: Promise<void>;
    act(() => { operation = result.current.consult(); });
    rerender({ ...charge, [field]: 'different' });
    await act(async () => { resolve(homologacao); await operation; });
    expect(result.current.feedback).toBeNull();
    expect(result.current.canDownload).toBe(false);
    expect(mocks.consult).toHaveBeenCalledTimes(1);
    expect(mocks.consult).toHaveBeenCalledWith('charge-a');
  });

  it('descarta erro atrasado da cobrança anterior', async () => {
    let reject!: (error: Error) => void;
    mocks.consult.mockImplementation(() => new Promise((_done, fail) => { reject = fail; }));
    const { result, rerender } = renderHook(item => useNfseChargeActions(item), { initialProps: charge });
    let operation!: Promise<void>;
    act(() => { operation = result.current.consult(); });
    rerender({ ...charge, id: 'charge-b' });
    await act(async () => { reject(new Error('Erro da cobrança anterior')); await operation; });
    expect(result.current.feedback).toBeNull();
  });

  it('não restaura resposta antiga ao sair e voltar para a mesma cobrança', async () => {
    let resolve!: (value: unknown) => void;
    mocks.consult.mockImplementation(() => new Promise(done => { resolve = done; }));
    const { result, rerender } = renderHook(item => useNfseChargeActions(item), { initialProps: charge });
    let operation!: Promise<void>;
    act(() => { operation = result.current.consult(); });
    rerender({ ...charge, id: 'charge-b' });
    rerender(charge);
    await act(async () => { resolve(homologacao); await operation; });
    expect(result.current.feedback).toBeNull();
    expect(result.current.canDownload).toBe(false);
  });
});
