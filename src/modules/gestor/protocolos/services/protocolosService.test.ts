import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());
const getCompaniesMock = vi.hoisted(() => vi.fn());
const getCompanyByIdMock = vi.hoisted(() => vi.fn());
const getCatalogoMock = vi.hoisted(() => vi.fn());
const getCatalogoAtivoMock = vi.hoisted(() => vi.fn());
const listCatalogoTodosMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../lib/supabase', () => ({
  supabase: { from: fromMock, rpc: rpcMock },
}));
vi.mock('../../gestao-empresarial/services/gestaoEmpresarialService', () => ({
  gestaoEmpresarialService: {
    getCompanies: getCompaniesMock,
    getCompanyById: getCompanyByIdMock,
  },
}));
vi.mock('./protocolosCatalogoService', () => ({
  protocolosCatalogoService: {
    getCatalogoPorRegime: getCatalogoMock,
    getCatalogoAtivo: getCatalogoAtivoMock,
    listCatalogoTodos: listCatalogoTodosMock,
  },
}));
import { protocolosService } from './protocolosService';

const company = {
  id: '11111111-1111-4111-8111-111111111111',
  nome: 'Cliente Real',
  cnpj: '12.345.678/0001-00',
  status: 'Ativa',
  tipo: 'Simples Nacional',
  tipoEstabelecimento: 'Matriz',
  email: 'cliente@empresa.test',
  telefone: '',
};

const catalogo = [{
  id: 'xml-nfe',
  nome: 'XML de NF-e',
  categoria: 'Fiscal',
  origemPadrao: 'Cliente envia',
  periodicidadePadrao: 'mensal',
  diaLimite: 10,
  status: 'Ativo',
  regimes: ['Simples Nacional'],
}];

const makeProtocol = (overrides: Record<string, unknown> = {}) => ({
  id: `${company.id}-2026-08-xml-nfe-mensal`,
  empresaId: company.id,
  empresaNome: company.nome,
  empresaCnpj: company.cnpj,
  empresaStatus: company.status,
  empresaTipo: company.tipo,
  empresaTipoEstabelecimento: company.tipoEstabelecimento,
  empresaEmail: company.email,
  empresaTelefone: company.telefone,
  competencia: '2026-08',
  periodoReferencia: 'Mensal',
  entregaId: 'xml-nfe',
  entregaNome: 'XML de NF-e',
  categoria: 'Fiscal',
  origemPadrao: 'Cliente envia',
  prazo: '2026-09-23',
  status: 'Pendente',
  atualizadoEm: '',
  responsavel: '',
  anotacoesList: [],
  recebidoEm: '',
  concluidoPor: '',
  ...overrides,
});

const setReads = ({ configs = null }: {
  configs?: unknown;
} = {}) => {
  fromMock.mockImplementation((table: string) => {
    if (table === 'configuracoes_protocolos_empresas') {
      const builder = {
        select: vi.fn(),
        eq: vi.fn(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: configs === null ? null : { configs },
          error: null,
        }),
      };
      builder.select.mockReturnValue(builder);
      builder.eq.mockReturnValue(builder);
      return builder;
    }
    throw new Error(`Tabela inesperada: ${table}`);
  });
};

describe('protocolosService integrity', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-25T12:00:00Z'));
    vi.clearAllMocks();
    getCompaniesMock.mockResolvedValue([company]);
    getCatalogoMock.mockReturnValue(catalogo);
    getCatalogoAtivoMock.mockReturnValue(catalogo);
    listCatalogoTodosMock.mockResolvedValue(catalogo);
    rpcMock.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => vi.useRealTimers());

  it('mantém o estado vazio quando o cliente não configurou entregas', async () => {
    setReads({ configs: null });

    await expect(protocolosService.getProtocolos()).resolves.toEqual([]);
    const config = await protocolosService.getEntregasEmpresaConfig(company as never);
    expect(config).toEqual([expect.objectContaining({ entregaId: 'xml-nfe', ativo: false })]);
  });

  it('consome a projeção operacional pronta da RPC', async () => {
    const protocols = [makeProtocol(), makeProtocol({ id: 'protocolo-2' }), makeProtocol({ id: 'protocolo-3' })];
    rpcMock.mockResolvedValue({ data: protocols, error: null });

    const items = await protocolosService.getProtocolos();

    expect(items).toEqual(protocols);
    expect(items.every((item) => item.status === 'Pendente')).toBe(true);
    expect(items.every((item) => !item.recebidoEm && !item.concluidoPor && item.anotacoesList.length === 0)).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith('get_protocolos_operacionais');
  });

  it('não recalcula no navegador o prazo retornado pelo servidor', async () => {
    rpcMock.mockResolvedValue({ data: [makeProtocol({ prazo: '2026-09-23' })], error: null });

    await expect(protocolosService.getProtocolos())
      .resolves.toEqual([expect.objectContaining({ prazo: '2026-09-23' })]);
  });

  it('salva a configuração somente pela RPC tenant-safe', async () => {
    setReads({ configs: [] });
    rpcMock.mockResolvedValue({ data: [{ entregaId: 'xml-nfe', ativo: true }], error: null });

    await expect(protocolosService.saveEntregasEmpresa(company as never, ['xml-nfe']))
      .resolves.toEqual([expect.objectContaining({ entregaId: 'xml-nfe', ativo: true })]);

    expect(rpcMock).toHaveBeenCalledWith('salvar_configuracoes_protocolos_cliente', {
      p_cliente_id: company.id,
      p_configs: [expect.objectContaining({
        entregaId: 'xml-nfe',
        ativo: true,
        periodicidade: 'mensal',
      })],
    });
  });

  it('propaga erro de leitura sem substituir o banco por dados presumidos', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: 'PGRST500', message: 'indisponível' },
    });

    await expect(protocolosService.getProtocolos()).rejects.toMatchObject({ code: 'PGRST500' });
  });

  it('envia apenas a intenção e recarrega a projeção auditada da RPC', async () => {
    const id = `${company.id}-2026-08-xml-nfe-mensal`;
    const pending = makeProtocol();
    const concluded = makeProtocol({
      status: 'Concluído',
      concluidoPor: 'Usuária Verificada',
      recebidoEm: '2026-08-25T12:01:00Z',
    });
    let readCount = 0;
    rpcMock.mockImplementation(async (name: string) => {
      if (name === 'get_protocolos_operacionais') {
        readCount += 1;
        return { data: readCount === 1 ? [pending] : [concluded], error: null };
      }
      return { data: { id }, error: null };
    });

    const result = await protocolosService.updateProtocolo(id, {
      status: 'Concluído',
      anotacao: 'Arquivo validado.',
    });

    expect(rpcMock).toHaveBeenCalledWith('atualizar_protocolo_entrega', {
      p_payload: {
        id,
        cliente_id: company.id,
        entrega_id: 'xml-nfe',
        competencia: '2026-08',
        periodo_referencia: 'Mensal',
        status: 'Concluído',
        anotacao: 'Arquivo validado.',
      },
    });
    expect(result.find((item) => item.id === id)).toMatchObject({
      status: 'Concluído',
      concluidoPor: 'Usuária Verificada',
      recebidoEm: '2026-08-25T12:01:00Z',
    });
  });
});
