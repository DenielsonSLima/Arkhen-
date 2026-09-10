/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ list: vi.fn(), consult: vi.fn(), download: vi.fn(), preparePdf: vi.fn(), sync: vi.fn(), emit: vi.fn() }));
vi.mock('../services/faturamentoFiscalService', () => ({ faturamentoFiscalService: {
  tenant: async () => 'tenant', emitters: async () => [{ id: 'emitter', prestadorNome: 'Escritório', prestadorCnpj: '123', ambiente: 'homologacao', ativo: false }],
  list: mocks.list, consult: mocks.consult, download: mocks.download, preparePdf: mocks.preparePdf, sync: mocks.sync, emit: mocks.emit,
} }));
vi.mock('../queries/useFaturamentoQueries', () => ({ useFaturamentoClientesQuery: () => ({ data: [
  { id: 'partner', nome: 'UNILASE', razaoSocial: 'UNILASE LTDA', cnpj: '12345678000190' },
  { id: 'person', nome: 'Pessoa física', cnpj: '12345678901' },
], isLoading: false, refetch: vi.fn() }) }));
vi.mock('../forms/nfse/NfseDraftForm', () => ({ NfseDraftForm: () => null }));
import { HistoricoNfseTab } from './HistoricoNfseTab';
const note = { id: 'draft', origem: 'rascunho', numeroNfse: '292', ambiente: 'homologacao', parceiro: 'UNILASE',
  dados: { valor: 405, competencia: '2026-08-01' }, status: 'confirmada', rpsNumero: '20', rpsSerie: 'T', xmlDisponivel: true, statusBancario: 'Cancelada' };
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><HistoricoNfseTab /></QueryClientProvider>);
beforeEach(() => { vi.resetAllMocks(); mocks.list.mockResolvedValue([note]); mocks.consult.mockResolvedValue({}); mocks.download.mockResolvedValue(undefined); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('Histórico fiscal', () => {
  it('identifica o parceiro pelo ID e exibe CNPJ ou CPF com máscara abaixo do nome', async () => {
    mocks.list.mockResolvedValue([
      { ...note, id: 'company', clienteId: 'partner' },
      { ...note, id: 'person-note', clienteId: 'person', parceiro: 'Pessoa física' },
      { ...note, id: 'unknown', clienteId: 'unknown', parceiro: 'UNILASE' },
    ]);
    mount();
    const companyDocument = await screen.findByText('CNPJ: 12.345.678/0001-90');
    expect(companyDocument.closest('td')?.textContent).toBe('UNILASECNPJ: 12.345.678/0001-90Registrada no Arkhen');
    expect(screen.getByText('CPF: 123.456.789-01').closest('td')?.textContent).toContain('Pessoa física');
    expect(screen.getByText('CPF/CNPJ não informado').closest('td')?.textContent).toContain('UNILASE');
    expect(screen.getAllByText('CNPJ: 12.345.678/0001-90')).toHaveLength(1);
  });
  it('abre a prévia do PDF sem baixar ou transmitir e oferece o mesmo arquivo para download', async () => {
    const createUrl = vi.fn(() => 'blob:nfse-preview');
    const revokeUrl = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: createUrl, revokeObjectURL: revokeUrl });
    let resolve!: (file: { blob: Blob; filename: string }) => void;
    mocks.preparePdf.mockReturnValue(new Promise(done => { resolve = done; }));
    mount(); await screen.findByText('UNILASE');
    const trigger = screen.getByRole('button', { name: 'Visualizar PDF' });
    trigger.focus(); fireEvent.click(trigger);
    expect(screen.getByRole('dialog').textContent).toContain('Prévia da NFS-e 292');
    expect(screen.getByRole('status').textContent).toContain('Preparando PDF');
    expect((screen.getByRole('button', { name: 'Baixar PDF' }) as HTMLButtonElement).disabled).toBe(true);
    resolve({ blob: new Blob(['pdf'], { type: 'application/pdf' }), filename: 'nota.pdf' });
    const link = await screen.findByRole('link', { name: 'Baixar PDF' });
    expect(link.getAttribute('href')).toBe('blob:nfse-preview');
    expect(link.getAttribute('download')).toBe('nota.pdf');
    expect(screen.getByTitle('Pré-visualização do PDF da NFS-e').getAttribute('src')).toBe('blob:nfse-preview#view=FitH');
    expect(mocks.preparePdf).toHaveBeenCalledWith(note);
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.emit).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(revokeUrl).toHaveBeenCalledWith('blob:nfse-preview');
    expect(document.activeElement).toBe(trigger);
  });
  it('permite repetir a geração após falha e descarta resposta após fechar', async () => {
    const createUrl = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: createUrl, revokeObjectURL: vi.fn() });
    mocks.preparePdf.mockRejectedValueOnce(new Error('XML indisponível'));
    mount(); await screen.findByText('UNILASE');
    fireEvent.click(screen.getByRole('button', { name: 'Visualizar PDF' }));
    expect((await screen.findByRole('alert')).textContent).toContain('XML indisponível');
    let resolve!: (file: { blob: Blob; filename: string }) => void;
    mocks.preparePdf.mockReturnValue(new Promise(done => { resolve = done; }));
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fechar prévia do PDF' }));
    resolve({ blob: new Blob(['pdf']), filename: 'nota.pdf' });
    await waitFor(() => expect(mocks.preparePdf).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(createUrl).not.toHaveBeenCalled();
  });
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
  it('filtra notas existentes sem exigir importação manual ou abrir nova emissão', async () => {
    mocks.list.mockResolvedValue([{ ...note, id: 'imported', origem: 'consultada', ambiente: 'producao', numeroNfse: '300', emissao: '2026-09-10T02:00:00Z' }]);
    mount();
    await screen.findByRole('option', { name: /Escritório/ });
    expect(screen.queryByRole('button', { name: 'Consultar WebISS' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Emitente'), { target: { value: 'emitter' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Pesquisar parceiro / tomador' }), { target: { value: '12345678' } });
    fireEvent.click(screen.getByRole('option', { name: /UNILASE LTDA/ }));
    fireEvent.change(screen.getByLabelText('Ambiente'), { target: { value: 'producao' } });
    fireEvent.change(screen.getByLabelText('Emissão de'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('Emissão até'), { target: { value: '2026-09-10' } });
    await waitFor(() => expect((screen.getByRole('button', { name: 'Filtrar' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar' }));
    await screen.findByText('300');
    expect(screen.getByText('Importada')).toBeTruthy(); expect(screen.getByText('Emitida em 09/09/2026')).toBeTruthy();
    expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ fiscalConfigId: 'emitter', clienteId: 'partner', ambiente: 'producao', dataInicial: '2026-08-01', dataFinal: '2026-09-10' }));
    expect(mocks.sync).not.toHaveBeenCalled();
    expect(mocks.emit).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
