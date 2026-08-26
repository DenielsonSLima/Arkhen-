import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../lib/supabase', () => ({
  supabase: { rpc: rpcMock },
}));

import { conformidadeService } from './conformidadeOperationalService';

const metricasVazias = {
  total: 0,
  pendente: 0,
  andamento: 0,
  concluidas: 0,
  atrasadas: 0,
  vencendoHoje: 0,
  comPrazoDefinido: 0,
  semPrazo: 0,
  atrasadasPorResponsavel: [],
  atrasadasPorCliente: [],
  atrasadasPorRotina: [],
};

const resumo = (obrigacoes: unknown[] = [], extras: Record<string, unknown> = {}) => ({
  dataReferencia: '2026-08-26',
  solicitacoesDocumentaisVisiveis: true,
  obrigacoes,
  metricas: { ...metricasVazias, total: obrigacoes.length },
  ...extras,
});

describe('conformidadeService integrity', () => {
  beforeEach(() => vi.clearAllMocks());

  it('consome uma única projeção server-side e mantém o estado vazio real', async () => {
    rpcMock.mockResolvedValue({ data: resumo(), error: null });

    await expect(conformidadeService.getObrigacoes()).resolves.toEqual(resumo());
    expect(rpcMock).toHaveBeenCalledOnce();
    expect(rpcMock).toHaveBeenCalledWith('get_conformidade_operacional_tarefas', {
      p_cliente_id: null,
      p_competencia: null,
    });
  });

  it('propaga falha da consulta sem gerar obrigações demonstrativas', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: '42501', message: 'negado' } });

    await expect(conformidadeService.getObrigacoes()).rejects.toMatchObject({ code: '42501' });
  });

  it('atualiza checklist real e recarrega a projeção consolidada', async () => {
    rpcMock
      .mockResolvedValueOnce({ data: { id: 'atividade-real' }, error: null })
      .mockResolvedValueOnce({ data: resumo(), error: null });

    await expect(conformidadeService.toggleEtapa(
      'atividade-real', '0', true, undefined, { justificativa: 'Documento conferido' },
    ))
      .resolves.toEqual(resumo());
    expect(rpcMock).toHaveBeenNthCalledWith(1, 'atualizar_tarefa_operacional_checklist', {
      p_tarefa_id: 'atividade-real',
      p_indice: 0,
      p_concluida: true,
      p_evidencia: null,
      p_justificativa: 'Documento conferido',
    });
    expect(rpcMock).toHaveBeenNthCalledWith(2, 'get_conformidade_operacional_tarefas', {
      p_cliente_id: null,
      p_competencia: null,
    });
  });

  it('preserva classificação, prazo e distância calculados pelo servidor', async () => {
    const item = {
      id: 'atividade-real',
      origem: 'atividade',
      tipo: 'fiscal',
      clienteId: 'cliente-real',
      clienteNome: 'Cliente Real',
      cnpj: '',
      competencia: '2026-08',
      rotina: 'DCTFWeb',
      descricao: '',
      responsavel: 'Contador',
      vencimento: '2026-08-25',
      diasParaVencimento: -1,
      prioridade: 'vermelho',
      status: 'Pendente',
      atrasoDias: 1,
      podeAtualizar: true,
      etapas: [{ id: 'Transmitir', label: 'Transmitir', concluida: false }],
      solicitacoesDocumentos: [],
      criadoEm: '2026-08-20T10:00:00Z',
      atualizadoEm: '2026-08-25T10:00:00Z',
    };
    rpcMock.mockResolvedValue({ data: resumo([item]), error: null });

    const resultado = await conformidadeService.getObrigacoes('cliente-real');

    expect(resultado.obrigacoes[0]).toMatchObject({
      diasParaVencimento: -1,
      prioridade: 'vermelho',
      atrasoDias: 1,
      podeAtualizar: true,
      regraContrato: null,
    });
    expect(rpcMock).toHaveBeenCalledWith('get_conformidade_operacional_tarefas', {
      p_cliente_id: 'cliente-real',
      p_competencia: null,
    });
  });

  it('normaliza a obrigação documental já agrupada pelo banco', async () => {
    const item = {
      id: 'solicitacoes-documentos:cliente-real:2026-08',
      origem: 'solicitacoes-documentos',
      tipo: 'atendimento',
      clienteId: 'cliente-real',
      clienteNome: 'Cliente Real',
      cnpj: '',
      competencia: '2026-08',
      rotina: 'Solicitações de documentos',
      descricao: '1 solicitação documental aberta nesta competência.',
      responsavel: 'Não atribuído',
      vencimento: '',
      diasParaVencimento: null,
      prioridade: 'sem-prazo',
      status: 'Em andamento',
      atrasoDias: 0,
      etapas: [],
      solicitacoesDocumentos: [{
        id: 'solicitacao-real',
        nome: 'Extratos bancários',
        status: 'Em conferência',
        solicitadoEm: '2026-08-20T10:00:00Z',
        atualizadoEm: '2026-08-25T10:00:00Z',
        dataLimite: '',
      }],
      criadoEm: '2026-08-20T10:00:00Z',
      atualizadoEm: '2026-08-25T10:00:00Z',
    };
    rpcMock.mockResolvedValue({ data: resumo([item]), error: null });

    const resultado = await conformidadeService.getObrigacoes();

    expect(resultado.obrigacoes[0]).toMatchObject({
      origem: 'solicitacoes-documentos',
      diasParaVencimento: null,
      solicitacoesDocumentos: [expect.objectContaining({ id: 'solicitacao-real' })],
    });
  });

  it('rejeita payload que tenta devolver métricas sem contrato completo', async () => {
    rpcMock.mockResolvedValue({
      data: resumo([], { metricas: { total: 0 } }),
      error: null,
    });

    await expect(conformidadeService.getObrigacoes()).rejects.toThrow('Métricas de conformidade');
  });
});
