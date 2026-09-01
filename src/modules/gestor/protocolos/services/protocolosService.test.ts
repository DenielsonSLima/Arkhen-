import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Company } from '../../gestao-empresarial/services/gestaoEmpresarialService';

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: supabaseMock,
}));

import { ProtocolosError, protocolosService } from './protocolosService';
import type { ConfiguracaoProtocolosEmpresa } from './protocolosService';

const CLIENTE_ID = '11111111-1111-4111-8111-111111111111';
const company = { id: CLIENTE_ID, tipo: 'Simples Nacional' } as Company;

const pendingProtocol = {
  id: 'cliente-1-2026-08-dctfweb-mensal',
  empresaId: CLIENTE_ID,
  empresaNome: 'Empresa recém-cadastrada',
  empresaCnpj: '12345678000190',
  empresaStatus: 'Ativa',
  empresaTipo: 'Simples Nacional',
  empresaTipoEstabelecimento: 'Matriz',
  empresaEmail: 'cliente@example.com',
  empresaTelefone: '79999999999',
  competencia: '2026-08',
  periodoReferencia: 'Mensal',
  entregaId: 'dctfweb',
  entregaNome: 'DCTFWeb',
  categoria: 'Fiscal',
  origemPadrao: 'Ambos',
  prazo: '2026-09-25',
  status: 'Pendente',
  atualizadoEm: '',
  responsavel: '',
  anotacoesList: [],
  recebidoEm: '',
  concluidoPor: '',
  podeAlterarStatus: true,
  podeAnotar: true,
};

const completedProtocol = {
  ...pendingProtocol,
  status: 'Concluído',
  recebidoEm: '2026-08-31T22:00:00Z',
  concluidoPor: 'Administrador',
  evidencia: 'Documento validado no portal',
};

const configEnvelope: ConfiguracaoProtocolosEmpresa = {
  updatedAt: '2026-08-31T22:30:00.000Z',
  catalogo: [{
    id: 'dctfweb',
    nome: 'DCTFWeb',
    categoria: 'Fiscal',
    orgao: 'Receita Federal',
    diaLimite: 25,
    diaPrimeiraQuinzena: 10,
    diaSegundaQuinzena: 25,
    temVencimento: true,
    etapas: ['Conferir dados', 'Transmitir obrigação'],
    descricao: 'Obrigação mensal',
    status: 'Ativo',
    regimes: ['Simples Nacional'],
    periodicidadePadrao: 'mensal',
    origemPadrao: 'Ambos',
  }],
  configs: [{
    entregaId: 'dctfweb',
    ativo: true,
    periodicidade: 'mensal',
    dataInicial: '2026-08-31',
    proximaExecucao: '2026-09-25',
    diaMes: 25,
    incluirFinaisDeSemana: false,
  }],
};

describe('protocolosService RPC contract', () => {
  beforeEach(() => {
    supabaseMock.rpc.mockReset();
    supabaseMock.rpc.mockResolvedValue({ data: [], error: null });
  });

  it('carrega a projeção canônica e mantém empresa nova como pendente', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: [pendingProtocol], error: null });

    const result = await protocolosService.getProtocolos();

    expect(supabaseMock.rpc).toHaveBeenCalledWith('get_protocolos_operacionais_seguros');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      status: 'Pendente',
      recebidoEm: undefined,
      concluidoPor: undefined,
      podeAlterarStatus: true,
    });
  });

  it.each(['Diária', 'Única', 'Semanal', 'Anual'] as const)(
    'aceita o período de referência operacional %s',
    async (periodoReferencia) => {
      supabaseMock.rpc.mockResolvedValueOnce({
        data: [{ ...pendingProtocol, periodoReferencia }],
        error: null,
      });

      const result = await protocolosService.getProtocolos();

      expect(result[0].periodoReferencia).toBe(periodoReferencia);
    },
  );

  it('carrega protocolos e progresso em paralelo e vincula pela competência legal', async () => {
    supabaseMock.rpc
      .mockResolvedValueOnce({ data: [pendingProtocol], error: null })
      .mockResolvedValueOnce({
        data: [{
          clienteId: CLIENTE_ID,
          competencia: '2026-08',
          tarefasTotal: 1,
          tarefasConcluidas: 0,
          etapasTotal: 12,
          etapasConcluidas: 9,
          percentual: 75,
        }, {
          clienteId: 'cliente-1',
          competencia: '2026-99',
          etapasTotal: -1,
        }],
        error: null,
      });

    const result = await protocolosService.getProtocolos();

    expect(supabaseMock.rpc).toHaveBeenNthCalledWith(
      2,
      'obter_progresso_fluxos_acompanhamento',
    );
    expect(result[0].fluxoOperacional).toEqual({
      clienteId: CLIENTE_ID,
      competencia: '2026-08',
      tarefasTotal: 1,
      tarefasConcluidas: 0,
      etapasTotal: 12,
      etapasConcluidas: 9,
      percentual: 75,
    });
  });

  it('não cria protocolos nem ativa obrigações para empresa sem configuração', async () => {
    supabaseMock.rpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({
        data: {
          catalogo: configEnvelope.catalogo,
          configs: configEnvelope.configs.map((config) => ({ ...config, ativo: false })),
        },
        error: null,
      });

    const protocolos = await protocolosService.getProtocolos();
    const configuracao = await protocolosService.getConfiguracaoEmpresa(company);

    expect(protocolos).toEqual([]);
    expect(configuracao.configs).toEqual([
      expect.objectContaining({ entregaId: 'dctfweb', ativo: false }),
    ]);
  });

  it('muda o status somente pela RPC segura e envia identidade canônica', async () => {
    supabaseMock.rpc
      .mockResolvedValueOnce({ data: [pendingProtocol], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: completedProtocol, error: null })
      .mockResolvedValueOnce({ data: [completedProtocol], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const result = await protocolosService.updateProtocolo(pendingProtocol.id, {
      status: 'Concluído',
      anotacao: 'Documento validado no portal',
      recebidoEm: '2000-01-01T00:00:00Z',
      concluidoPor: 'Nome forjado',
    });

    expect(supabaseMock.rpc).toHaveBeenNthCalledWith(3, 'salvar_protocolo_operacional_seguro', {
      p_payload: {
        id: pendingProtocol.id,
        cliente_id: pendingProtocol.empresaId,
        entrega_id: pendingProtocol.entregaId,
        competencia: pendingProtocol.competencia,
        periodo_referencia: pendingProtocol.periodoReferencia,
        status: 'Concluído',
        anotacao: 'Documento validado no portal',
      },
    });
    expect(result[0].status).toBe('Concluído');
  });

  it('bloqueia transição sem evidência antes de chamar a RPC de escrita', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: [completedProtocol], error: null });

    const request = protocolosService.updateProtocolo(completedProtocol.id, {
      status: 'Pendente',
      anotacao: 'curta',
    });

    await expect(request).rejects.toMatchObject({
      code: 'evidence_required',
    } satisfies Partial<ProtocolosError>);
    expect(supabaseMock.rpc).toHaveBeenCalledTimes(2);
  });

  it('bloqueia mudança de status quando a projeção canônica nega a permissão', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: [{ ...pendingProtocol, podeAlterarStatus: false }],
      error: null,
    });

    const request = protocolosService.updateProtocolo(pendingProtocol.id, {
      status: 'Concluído',
      anotacao: 'Documento validado no portal',
    });

    await expect(request).rejects.toMatchObject({ code: 'forbidden' });
    expect(supabaseMock.rpc).toHaveBeenCalledTimes(2);
  });

  it('bloqueia anotação quando a projeção canônica nega a permissão', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: [{ ...pendingProtocol, podeAnotar: false }],
      error: null,
    });

    const request = protocolosService.updateProtocolo(pendingProtocol.id, {
      anotacao: 'Conferência operacional registrada',
    });

    await expect(request).rejects.toMatchObject({ code: 'forbidden' });
    expect(supabaseMock.rpc).toHaveBeenCalledTimes(2);
  });

  it('carrega catálogo e configuração canônicos pela RPC do cliente', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: configEnvelope, error: null });

    const result = await protocolosService.getConfiguracaoEmpresa(company);

    expect(supabaseMock.rpc).toHaveBeenCalledWith('obter_configuracao_protocolos_cliente', {
      p_cliente_id: company.id,
    });
    expect(result.catalogo[0]).toMatchObject({
      id: 'dctfweb',
      diaLimite: 25,
      diaPrimeiraQuinzena: 10,
      diaSegundaQuinzena: 25,
      temVencimento: true,
      etapas: ['Conferir dados', 'Transmitir obrigação'],
    });
    expect(result.configs[0]).toMatchObject({ entregaId: 'dctfweb', diaMes: 25 });
  });

  it('normaliza obrigação sem vencimento e preserva somente etapas válidas', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: {
        ...configEnvelope,
        catalogo: [{
          ...configEnvelope.catalogo[0],
          diaLimite: null,
          temVencimento: false,
          etapas: [' Conferir dados ', '', 'Transmitir obrigação'],
        }],
      },
      error: null,
    });

    const result = await protocolosService.getConfiguracaoEmpresa(company);

    expect(result.catalogo[0]).toMatchObject({
      temVencimento: false,
      etapas: ['Conferir dados', 'Transmitir obrigação'],
    });
    expect(result.catalogo[0].diaLimite).toBeUndefined();
  });

  it('preserva a agenda anual canônica no catálogo e na configuração do cliente', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: {
        ...configEnvelope,
        catalogo: [{
          ...configEnvelope.catalogo[0],
          periodicidadePadrao: 'anual',
          diaLimite: 31,
          mesVencimento: 12,
        }],
        configs: [{
          entregaId: 'dctfweb',
          ativo: true,
          periodicidade: 'anual',
          diaMes: 31,
          mesVencimento: 12,
        }],
      },
      error: null,
    });

    const result = await protocolosService.getConfiguracaoEmpresa(company);

    expect(result.catalogo[0]).toMatchObject({
      periodicidadePadrao: 'anual',
      diaLimite: 31,
      mesVencimento: 12,
    });
    expect(result.configs[0]).toMatchObject({
      periodicidade: 'anual',
      diaMes: 31,
      mesVencimento: 12,
    });
  });

  it('salva a configuração pela RPC e relê o envelope canônico', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: configEnvelope, error: null });

    const result = await protocolosService.saveEntregasEmpresaConfig(
      company,
      configEnvelope.configs,
      configEnvelope.updatedAt,
    );

    const expectedWritableConfig = {
      entregaId: 'dctfweb',
      ativo: true,
      periodicidade: 'mensal',
      dataInicial: '2026-08-31',
      diaMes: 25,
      incluirFinaisDeSemana: false,
    };
    expect(supabaseMock.rpc).toHaveBeenNthCalledWith(1, 'salvar_configuracoes_protocolos_cliente_v2', {
      p_cliente_id: company.id,
      p_configs: [expectedWritableConfig],
      p_expected_updated_at: configEnvelope.updatedAt,
    });
    expect(expectedWritableConfig).not.toHaveProperty('proximaExecucao');
    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      catalogo: [{ id: 'dctfweb' }],
      configs: [{ entregaId: 'dctfweb', ativo: true }],
    });
  });
});
