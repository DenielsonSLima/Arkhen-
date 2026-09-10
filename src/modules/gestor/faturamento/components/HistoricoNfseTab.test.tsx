/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ list: vi.fn(), consult: vi.fn(), download: vi.fn(), sync: vi.fn(), emit: vi.fn() }));
vi.mock('../services/faturamentoFiscalService', () => ({ faturamentoFiscalService: {
  tenant: async () => 'tenant', emitters: async () => [{ id: 'emitter', prestadorNome: 'Escritório', prestadorCnpj: '123', ambiente: 'homologacao', ativo: false }],
  list: mocks.list, consult: mocks.consult, download: mocks.download, sync: mocks.sync, emit: mocks.emit,
} }));
vi.mock('../queries/useFaturamentoQueries', () => ({ useFaturamentoClientesQuery: () => ({ data: [
  { id: 'partner', nome: 'UNILASE', razaoSocial: 'UNILASE LTDA', cnpj: '12345678000190' },
], isLoading: false, refetch: vi.fn() }) }));
vi.mock('../forms/nfse/NfseDraftForm', () => ({ NfseDraftForm: () => null }));
import { HistoricoNfseTab } from './HistoricoNfseTab';
const note = { id: 'draft', origem: 'rascunho', numeroNfse: '292', ambiente: 'homologacao', parceiro: 'UNILASE',
  dados: { valor: 405, competencia: '2026-08-01' }, status: 'confirmada', rpsNumero: '20', rpsSerie: 'T', xmlDisponivel: true, statusBancario: 'Cancelada' };
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><HistoricoNfseTab /></QueryClientProvider>);
beforeEach(() => { vi.resetAllMocks(); mocks.list.mockResolvedValue([note]); mocks.consult.mockResolvedValue({}); mocks.download.mockResolvedValue(undefined); });
afterEach(cleanup);
describe('Histórico fiscal', () => {
  it('explica intervalo invertido e não envia filtro inválido ao servidor', async () => {
    mount(); await screen.findByText('UNILASE');
    fireEvent.change(screen.getByLabelText('Emissão de'), { target: { value: '2026-09-10' } });
    fireEvent.change(screen.getByLabelText('Emissão até'), { target: { value: '2026-09-01' } });
    expect(screen.getByRole('alert').textContent).toContain('Período inválido');
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar' }));
    expect(mocks.list.mock.calls.some(([filters]) => filters.dataInicial === '2026-09-10' && filters.dataFinal === '2026-09-01')).toBe(false);
    expect(mocks.sync).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Emissão até'), { target: { value: '2026-09-15' } });
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ dataInicial: '2026-09-10', dataFinal: '2026-09-15' })));
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('exibe status fiscal, baixa documentos com origem e consulta o mesmo RPS', async () => {
    mount(); await screen.findByText('UNILASE');
    expect(screen.getByRole('cell', { name: 'Emitida' })).toBeTruthy();
    expect(screen.queryByRole('cell', { name: 'Cancelada' })).toBeNull();
    expect(screen.getByText('08/2026')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'XML' }));
    await waitFor(() => expect(mocks.download).toHaveBeenCalledWith(note, 'xml'));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Consultar RPS' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Consultar RPS' }));
    await waitFor(() => expect(mocks.consult).toHaveBeenCalledWith(note));
    expect((screen.getByRole('button', { name: 'Cancelar indisponível' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('consulta produção diretamente no histórico e lista importadas sem abrir nova emissão', async () => {
    let imported = false;
    mocks.list.mockImplementation(async () => imported ? [{ ...note, id: 'imported', origem: 'consultada', ambiente: 'producao', numeroNfse: '300', emissao: '2026-09-10T02:00:00Z' }] : []);
    mocks.sync.mockImplementation(async () => { imported = true; return { coverage: 'complete', notesCount: 1, periodo: { inicio: '2026-08-01', fim: '2026-09-10' }, pagesRead: 1 }; });
    mount();
    await screen.findByRole('option', { name: /Escritório/ });
    expect((screen.getByRole('button', { name: 'Consultar WebISS' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Emitente'), { target: { value: 'emitter' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Pesquisar parceiro / tomador' }), { target: { value: '12345678' } });
    fireEvent.click(screen.getByRole('option', { name: /UNILASE LTDA/ }));
    fireEvent.change(screen.getByLabelText('Ambiente'), { target: { value: 'producao' } });
    fireEvent.change(screen.getByLabelText('Emissão de'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('Emissão até'), { target: { value: '2026-09-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar WebISS' }));
    await waitFor(() => expect(mocks.sync).toHaveBeenCalledWith({ fiscalConfigId: 'emitter', clienteId: 'partner', ambiente: 'producao', dataInicial: '2026-08-01', dataFinal: '2026-09-10' }, '2026-08-01', '2026-09-10'));
    await screen.findByText('300');
    expect(screen.getByText('Importada do WebISS')).toBeTruthy(); expect(screen.getByText('Emitida em 09/09/2026')).toBeTruthy();
    expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ fiscalConfigId: 'emitter', clienteId: 'partner', ambiente: 'producao', dataInicial: '2026-08-01', dataFinal: '2026-09-10' }));
    expect(mocks.emit).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
