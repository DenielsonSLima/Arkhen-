import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.hoisted(() => vi.fn());
const getCompanyByIdMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../lib/supabase', () => ({
  supabase: { rpc: rpcMock },
}));
vi.mock('../../gestao-empresarial/services/gestaoEmpresarialService', () => ({
  gestaoEmpresarialService: {
    getCompanyById: getCompanyByIdMock,
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

const configuracaoCanonica = {
  catalogo,
  configs: [{ entregaId: 'xml-nfe', ativo: false, periodicidade: 'mensal' }],
};

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
  podeAlterarStatus: true,
  podeAnotar: true,
  ...overrides,
});

describe('protocolosService integrity', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-25T12:00:00Z'));
    vi.clearAllMocks();
    rpcMock.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => vi.useRealTimers());

  it('lê catálogo e configuração canônicos pelo RPC do cliente', async () => {
    rpcMock.mockResolvedValue({ data: configuracaoCanonica, error: null });

    await expect(protocolosService.getConfiguracaoEmpresa(company as never))
      .resolves.toEqual(configuracaoCanonica);
    expect(rpcMock).toHaveBeenCalledWith('obter_configuracao_protocolos_cliente', {
      p_cliente_id: company.id,
    });
  });

  it('consome a projeção operacional pronta da RPC', async () => {
    const protocols = [makeProtocol(), makeProtocol({ id: 'protocolo-2' }), makeProtocol({ id: 'protocolo-3' })];
    rpcMock.mockResolvedValue({ data: protocols, error: null });

    const items = await protocolosService.getProtocolos();

    expect(items).toEqual(protocols);
    expect(items.every((item) => item.status === 'Pendente')).toBe(true);
    expect(items.every((item) => item.podeAlterarStatus && item.podeAnotar)).toBe(true);
    expect(items.every((item) => !item.recebidoEm && !item.concluidoPor && item.anotacoesList.length === 0)).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith('get_protocolos_operacionais_seguros');
  });

  it('não recalcula no navegador o prazo retornado pelo servidor', async () => {
    rpcMock.mockResolvedValue({ data: [makeProtocol({ prazo: '2026-09-23' })], error: null });

    await expect(protocolosService.getProtocolos())
      .resolves.toEqual([expect.objectContaining({ prazo: '2026-09-23' })]);
  });

  it('envia a seleção sem recalcular regime ou prazo e retorna a resposta canônica', async () => {
    const selection = [{ entregaId: 'xml-nfe', ativo: true, periodicidade: 'quinzenal' as const }];
    const canonicalAfterSave = {
      ...configuracaoCanonica,
      configs: [{ entregaId: 'xml-nfe', ativo: true, periodicidade: 'quinzenal' as const }],
    };
    rpcMock.mockImplementation(async (name: string) => (
      name === 'salvar_configuracoes_protocolos_cliente'
        ? { data: selection, error: null }
        : { data: canonicalAfterSave, error: null }
    ));

    await expect(protocolosService.saveEntregasEmpresaConfig(company as never, selection))
      .resolves.toEqual(canonicalAfterSave);
    expect(rpcMock).toHaveBeenCalledWith('salvar_configuracoes_protocolos_cliente', {
      p_cliente_id: company.id,
      p_configs: selection,
    });
    expect(rpcMock).toHaveBeenCalledWith('obter_configuracao_protocolos_cliente', {
      p_cliente_id: company.id,
    });
  });

  it('propaga erro de leitura sem substituir o banco por dados presumidos', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: 'PGRST500', message: 'indisponível' },
    });

    await expect(protocolosService.getProtocolos()).rejects.toMatchObject({ code: 'PGRST500' });
  });

  it('não transforma resposta malformada da projeção em estado vazio', async () => {
    rpcMock.mockResolvedValue({ data: { unexpected: true }, error: null });

    await expect(protocolosService.getProtocolos()).rejects.toThrow('formato inválido');
  });

  it('interpreta capacidades somente quando o backend retorna booleano verdadeiro', async () => {
    rpcMock.mockResolvedValue({
      data: [makeProtocol({ podeAlterarStatus: 'true', podeAnotar: 1 })],
      error: null,
    });

    await expect(protocolosService.getProtocolos()).resolves.toEqual([
      expect.objectContaining({ podeAlterarStatus: false, podeAnotar: false }),
    ]);
  });

  it('barra mutação no hook/service quando a capacidade retornada não permite', async () => {
    const readonly = makeProtocol({ podeAlterarStatus: false, podeAnotar: false });
    rpcMock.mockImplementation(async (name: string) => (
      name === 'get_protocolos_operacionais_seguros'
        ? { data: [readonly], error: null }
        : { data: null, error: { message: 'escrita não deveria ser chamada' } }
    ));

    await expect(protocolosService.updateProtocolo(readonly.id, {
      status: 'Concluído', anotacao: 'Arquivo conferido.',
    })).rejects.toThrow('não pode concluir ou reabrir');
    expect(rpcMock).not.toHaveBeenCalledWith('salvar_protocolo_operacional_seguro', expect.anything());
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
      if (name === 'get_protocolos_operacionais_seguros') {
        readCount += 1;
        return { data: readCount === 1 ? [pending] : [concluded], error: null };
      }
      return { data: { id }, error: null };
    });

    const result = await protocolosService.updateProtocolo(id, {
      status: 'Concluído',
      anotacao: 'Arquivo validado.',
    });

    expect(rpcMock).toHaveBeenCalledWith('salvar_protocolo_operacional_seguro', {
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
