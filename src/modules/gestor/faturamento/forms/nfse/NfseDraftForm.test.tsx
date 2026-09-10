/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blankFiscalData } from './fiscalFormData';
const mocks = vi.hoisted(() => ({
  tenant: vi.fn(), emitters: vi.fn(), list: vi.fn(), save: vi.fn(), review: vi.fn(), emit: vi.fn(), consult: vi.fn(),
  previous: vi.fn(), copy: vi.fn(), sync: vi.fn(), document: vi.fn(), bank: vi.fn(), oldEmit: vi.fn(),
}));
vi.mock('../../services/faturamentoFiscalService', () => ({ faturamentoFiscalService: mocks }));
vi.mock('../../queries/useFaturamentoQueries', () => ({ useFaturamentoClientesQuery: () => ({ data: [
  { id: 'client-a', nome: 'Parceiro A', cnpj: '111' }, { id: 'client-b', nome: 'Parceiro B', cnpj: '222' },
] }) }));
vi.mock('../../../financeiro/queries/useFinanceiroQueries', () => ({
  useCreateCobrancaFinanceiraMutation: () => ({ mutateAsync: mocks.bank, isPending: false }),
  useEmitirNfseFinanceiraMutation: () => ({ mutateAsync: mocks.oldEmit, isPending: false }),
}));
import { NfseDraftForm } from './NfseDraftForm';
import { ModalNovoLancamentoAvulso } from '../../components/ModalNovoLancamentoAvulso';
const draft = (dados = blankFiscalData()) => ({ id: 'draft-new', empresaId: 'tenant-a', fiscalConfigId: 'config-h', clienteId: 'client-a',
  ambiente: 'homologacao', dados, status: 'rascunho', createdAt: '', updatedAt: '' });
function mount(ui = <NfseDraftForm onClose={() => {}} />) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
function selectPartner(name: string) {
  fireEvent.change(screen.getByRole('combobox', { name: 'Parceiro / tomador' }), { target: { value: name } });
  fireEvent.click(screen.getByRole('option', { name: new RegExp(name) }));
}
async function selectContext() {
  await screen.findByRole('option', { name: /Emitente H/ });
  fireEvent.change(screen.getByLabelText('Emitente / configuração fiscal'), { target: { value: 'config-h' } });
  selectPartner('Parceiro A');
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.tenant.mockResolvedValue('tenant-a');
  mocks.emitters.mockResolvedValue([
    { id: 'config-h', empresaId: 'tenant-a', prestadorNome: 'Emitente H', prestadorCnpj: '123', ambiente: 'homologacao', ativo: true },
    { id: 'config-p', empresaId: 'tenant-a', prestadorNome: 'Emitente P', prestadorCnpj: '123', ambiente: 'producao', ativo: true },
  ]);
  mocks.previous.mockResolvedValue([]);
  mocks.save.mockImplementation(async input => ({ ...draft(input.dados), ...input, id: input.id || 'draft-new' }));
  mocks.review.mockImplementation(async () => ({ rascunho: draft(mocks.save.mock.calls.at(-1)?.[0].dados), ready: true, blockers: [],
    prestador: { cnpj: '123', razaoSocial: 'Emitente H', inscricaoMunicipal: '10' }, tomador: { documento: '111', razaoSocial: 'Parceiro A' }, endpoint: 'https://homologacao.webiss.com.br/ws/nfse.asmx' }));
});
afterEach(cleanup);
describe('Preparação NFS-e independente', () => {
  it('Somente NFS-e abre formulário fiscal e salva sem chamar cobrança Inter nem emissão', async () => {
    mount(<ModalNovoLancamentoAvulso isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Somente NFS-e/ }));
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    await selectContext();
    expect(screen.queryByText('Pagamento e regras do boleto')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await screen.findByText('Rascunho salvo. Nenhuma nota foi transmitida.');
    expect(mocks.bank).not.toHaveBeenCalled(); expect(mocks.emit).not.toHaveBeenCalled(); expect(mocks.oldEmit).not.toHaveBeenCalled();
  });
  it('salva competência independente de data RPS, mantém descrição e revisa sem emitir', async () => {
    mount(); await selectContext();
    fireEvent.change(screen.getByLabelText('Competência'), { target: { value: '2026-08' } });
    fireEvent.change(screen.getByLabelText('Data de emissão do RPS'), { target: { value: '2026-09-10' } });
    fireEvent.change(screen.getByLabelText('Descrição dos serviços'), { target: { value: 'Serviços de agosto' } });
    fireEvent.change(screen.getByLabelText('Valor dos serviços (R$)'), { target: { value: '405.00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e revisar' }));
    await screen.findByText('Revisão do rascunho salvo');
    expect(mocks.save.mock.calls[0][0].dados).toMatchObject({ competencia: '2026-08-01', dataEmissao: '2026-09-10', descricao: 'Serviços de agosto', valor: '405.00' });
    expect(mocks.emit).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Transmitir em homologação' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Valor dos serviços (R$)'), { target: { value: '500' } });
    expect(screen.queryByText('Revisão do rascunho salvo')).toBeNull();
  });
  it('produção pode ser preparada mas não habilita transmissão', async () => {
    mount(); await screen.findByRole('option', { name: /Emitente H/ });
    fireEvent.change(screen.getByLabelText('Ambiente'), { target: { value: 'producao' } });
    fireEvent.change(screen.getByLabelText('Emitente / configuração fiscal'), { target: { value: 'config-p' } });
    selectPartner('Parceiro A');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e revisar' }));
    await screen.findByText('Revisão do rascunho salvo');
    expect(mocks.save.mock.calls[0][0].ambiente).toBe('producao');
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect((screen.getByRole('button', { name: 'Transmitir em homologação' }) as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.emit).not.toHaveBeenCalled();
  });
  it('permite consultar produção com configuração salva em homologação e inativa', async () => {
    mocks.emitters.mockResolvedValue([{ id: 'config-h', empresaId: 'tenant-a', prestadorNome: 'Emitente H',
      prestadorCnpj: '123', inscricaoMunicipal: '10', ambiente: 'homologacao', ativo: false }]);
    mocks.sync.mockResolvedValue({ notesCount: 0, coverage: 'complete', periodo: { inicio: '2026-01-01', fim: '2026-09-10' }, pagesRead: 1 });
    mount(); await screen.findByRole('option', { name: /Emitente H/ });
    fireEvent.change(screen.getByLabelText('Ambiente'), { target: { value: 'producao' } });
    expect(screen.getByRole('option', { name: /Emitente H/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Emitente / configuração fiscal'), { target: { value: 'config-h' } });
    selectPartner('Parceiro A');
    expect(screen.getByText(/Ambiente desta operação: producao/)).toBeTruthy();
    expect(screen.getByText(/Contexto inativo para emissão; consulta de notas disponível/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar do WebISS' }));
    await waitFor(() => expect(mocks.sync).toHaveBeenCalledWith(expect.objectContaining({ fiscalConfigId: 'config-h', ambiente: 'producao', clienteId: 'client-a' }), expect.any(String), expect.any(String)));
    expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.emit).not.toHaveBeenCalled(); expect(mocks.bank).not.toHaveBeenCalled();
  });
  it('lista no máximo cinco notas, muda escopo com parceiro e descarta cópia atrasada', async () => {
    let resolveCopy!: (value: unknown) => void;
    mocks.previous.mockImplementation(async scope => scope.clienteId === 'client-a' ? Array.from({ length: 6 }, (_, index) => ({
      id: `previous-${index}`, origem: 'consultada', numero: `${900 + index}`, emissao: '2026-08-01', valor: 100,
      dados: { descricao: `Nota anterior ${index}` }, qualidade: { faltantes: [] },
    })) : []);
    mocks.copy.mockImplementation(() => new Promise(resolve => { resolveCopy = resolve; }));
    mount(); await selectContext(); await screen.findByText('Nota anterior 0');
    expect(screen.getAllByRole('button', { name: 'Copiar dados' })).toHaveLength(5);
    expect(screen.queryByText('Nota anterior 5')).toBeNull();
    fireEvent.change(screen.getByLabelText('Competência'), { target: { value: '2026-09' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Copiar dados' })[0]);
    await waitFor(() => expect(mocks.copy).toHaveBeenCalled());
    selectPartner('Parceiro B');
    resolveCopy({ ...draft(), dados: { ...blankFiscalData(), descricao: 'Dado antigo não pode voltar' } });
    await waitFor(() => expect(mocks.previous).toHaveBeenLastCalledWith(expect.objectContaining({ clienteId: 'client-b', fiscalConfigId: 'config-h', ambiente: 'homologacao' })));
    expect(screen.queryByText('Nota anterior 0')).toBeNull();
    expect((screen.getByLabelText('Descrição dos serviços') as HTMLTextAreaElement).value).toBe('');
    expect(mocks.emit).not.toHaveBeenCalled();
  });
});
