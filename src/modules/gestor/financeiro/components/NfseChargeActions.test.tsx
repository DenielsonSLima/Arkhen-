/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CobrancaFinanceira } from '../services/financeiroService';

const mocks = vi.hoisted(() => ({ emit: vi.fn(), consult: vi.fn(), pending: false }));
vi.mock('../queries/useFinanceiroQueries', () => ({
  useEmitirNfseFinanceiraMutation: () => ({ mutateAsync: mocks.emit, isPending: mocks.pending }),
  useConsultarNfseFinanceiraMutation: () => ({ mutateAsync: mocks.consult, isPending: mocks.pending }),
}));
import { NfseChargeActions } from './NfseChargeActions';

const charge = { id: 'charge-1', status: 'Pendente' } as CobrancaFinanceira;
afterEach(cleanup);
beforeEach(() => { mocks.emit.mockReset(); mocks.consult.mockReset(); mocks.pending = false; });

describe('Ações WebISS em Contas a Receber', () => {
  it('não oferece emissão para cobrança cancelada ou já vinculada à NFS-e', () => {
    const { rerender } = render(<NfseChargeActions charge={{ ...charge, status: 'Cancelado' }} />);
    expect(screen.queryByRole('button', { name: /Emitir ou reconciliar/ })).toBeNull();
    rerender(<NfseChargeActions charge={{ ...charge, nfseId: '123', nfseRpsNumero: '10' }} />);
    expect(screen.queryByRole('button', { name: /Emitir ou reconciliar/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Consultar ou reconciliar/ })).toBeTruthy();
  });

  it('informa resultado de homologação sem valor fiscal', async () => {
    mocks.emit.mockResolvedValue({ nfseId: 'TESTE123', ambiente: 'homologacao' });
    render(<NfseChargeActions charge={charge} />);
    fireEvent.click(screen.getByRole('button', { name: /Emitir ou reconciliar/ }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('homologação — sem valor fiscal'));
    expect(mocks.emit).toHaveBeenCalledWith('charge-1');
  });

  it('consulta explicitamente o RPS e preserva falha do servidor', async () => {
    mocks.consult.mockRejectedValue(new Error('RPS ainda não localizado no WebISS.'));
    render(<NfseChargeActions charge={{ ...charge, nfseRpsNumero: '10' }} />);
    fireEvent.click(screen.getByRole('button', { name: /Consultar ou reconciliar/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('RPS ainda não localizado'));
    expect(mocks.consult).toHaveBeenCalledWith('charge-1');
    expect(mocks.emit).not.toHaveBeenCalled();
  });

  it('desabilita ambas ações durante a operação', () => {
    mocks.pending = true;
    render(<NfseChargeActions charge={{ ...charge, nfseRpsNumero: '10' }} />);
    for (const button of screen.getAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
