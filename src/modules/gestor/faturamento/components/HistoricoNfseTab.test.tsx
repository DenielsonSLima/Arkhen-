/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ list: vi.fn(), consult: vi.fn(), download: vi.fn() }));
vi.mock('../services/faturamentoFiscalService', () => ({ faturamentoFiscalService: {
  tenant: async () => 'tenant', list: mocks.list, consult: mocks.consult, download: mocks.download,
} }));
vi.mock('../forms/nfse/NfseDraftForm', () => ({ NfseDraftForm: () => null }));
import { HistoricoNfseTab } from './HistoricoNfseTab';
afterEach(cleanup);
describe('Histórico fiscal', () => {
  it('exibe status fiscal, baixa documentos com origem e consulta o mesmo RPS', async () => {
    const note = { id: 'draft', origem: 'rascunho', numeroNfse: '292', ambiente: 'homologacao', parceiro: 'UNILASE',
      dados: { valor: 405, competencia: '2026-08-01' }, status: 'confirmada', rpsNumero: '20', rpsSerie: 'T', xmlDisponivel: true, statusBancario: 'Cancelada' };
    mocks.list.mockResolvedValue([note]); mocks.consult.mockResolvedValue({}); mocks.download.mockResolvedValue(undefined);
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><HistoricoNfseTab /></QueryClientProvider>);
    await screen.findByText('UNILASE');
    expect(screen.getByRole('cell', { name: 'Emitida' })).toBeTruthy();
    expect(screen.queryByRole('cell', { name: 'Cancelada' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'XML' }));
    await waitFor(() => expect(mocks.download).toHaveBeenCalledWith(note, 'xml'));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Consultar RPS' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Consultar RPS' }));
    await waitFor(() => expect(mocks.consult).toHaveBeenCalledWith(note));
    expect((screen.getByRole('button', { name: 'Cancelar indisponível' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
