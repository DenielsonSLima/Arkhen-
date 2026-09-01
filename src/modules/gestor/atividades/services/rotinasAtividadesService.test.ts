import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: supabaseMock,
}));

vi.mock('./atividadesService', () => ({
  atividadesService: {
    getClientes: vi.fn(),
    getModelos: vi.fn(),
  },
}));

import {
  ROTINAS_BATCH_LIMIT,
  rotinasAtividadesService,
  type RotinaAtividade,
  type TarefaGestor,
} from './rotinasAtividadesService';

const makeRotina = (overrides: Partial<RotinaAtividade> = {}): RotinaAtividade => ({
  id: '11111111-1111-4111-8111-111111111111',
  clienteId: '22222222-2222-4222-8222-222222222222',
  modeloId: '33333333-3333-4333-8333-333333333333',
  nome: 'Conferência fiscal',
  categoria: 'Fiscal',
  frequencia: 'Mensal',
  intervaloDias: 30,
  responsavel: 'Ana',
  responsavelConfigUsuarioId: '44444444-4444-4444-8444-444444444444',
  cliente: 'Empresa Alfa',
  dataAncora: '2026-01-05',
  proximaExecucaoBase: '2026-09-05',
  proximaExecucao: '2026-09-05',
  prioridade: 'Média',
  ativa: true,
  checklist: ['Conferir documentos'],
  observacoes: '',
  incluirFinaisDeSemana: false,
  ...overrides,
});

const makeTarefa = (overrides: Partial<TarefaGestor> = {}): TarefaGestor => ({
  id: 'task-local',
  titulo: 'Conferir documentos',
  categoria: 'Fiscal',
  frequencia: 'Única',
  responsavel: 'Ana',
  responsavelConfigUsuarioId: '44444444-4444-4444-8444-444444444444',
  cliente: 'Empresa Alfa',
  vencimento: '2026-09-05',
  prioridade: 'Média',
  status: 'Pendente',
  origem: 'Usuario',
  checklist: [{ titulo: 'Validar XML', concluida: false }],
  notas: '',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  supabaseMock.rpc.mockResolvedValue({ data: {}, error: null });
});

describe('rotinasAtividadesService', () => {
  it('reatribui uma rotina manual sem reiniciar a agenda pela data âncora', async () => {
    const rotina = makeRotina();
    const newResponsible = '55555555-5555-4555-8555-555555555555';

    await rotinasAtividadesService.atribuirResponsavelRotina(rotina, newResponsible);

    expect(supabaseMock.rpc).toHaveBeenCalledWith('atribuir_responsavel_rotina', {
      p_rotina_id: rotina.id,
      p_responsavel_config_usuario_id: newResponsible,
    });
    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
  });

  it('usa a mesma mutação parcial nas rotinas sincronizadas pelo parceiro', async () => {
    const rotina = makeRotina({ protocoloCodigo: 'dctfweb' });
    const newResponsible = '55555555-5555-4555-8555-555555555555';

    await rotinasAtividadesService.atribuirResponsavelRotina(rotina, newResponsible);

    expect(supabaseMock.rpc).toHaveBeenCalledOnce();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('atribuir_responsavel_rotina', {
      p_rotina_id: rotina.id,
      p_responsavel_config_usuario_id: newResponsible,
    });
  });

  it('persiste os aliases atuais de frequência com intervalos explícitos', async () => {
    await rotinasAtividadesService.saveRotina(makeRotina({ frequencia: 'Bimestral' }));
    expect(supabaseMock.rpc).toHaveBeenLastCalledWith('salvar_rotina_programada', {
      p_payload: expect.objectContaining({ frequencia: 'Personalizada', intervaloDias: 60 }),
    });

    await rotinasAtividadesService.saveRotina(makeRotina({ frequencia: 'Anual' }));
    expect(supabaseMock.rpc).toHaveBeenLastCalledWith('salvar_rotina_programada', {
      p_payload: expect.objectContaining({ frequencia: 'Personalizada', intervaloDias: 365 }),
    });
  });

  it('só solicita uma nova âncora quando a data foi alterada explicitamente', async () => {
    await rotinasAtividadesService.saveRotina(makeRotina({
      dataAncora: '2026-01-31',
      diaMes: 31,
      proximaExecucaoBase: '2026-04-30',
      proximaExecucao: '2026-04-30',
    }));
    expect(supabaseMock.rpc).toHaveBeenLastCalledWith('salvar_rotina_programada', {
      p_payload: expect.objectContaining({
        primeiraExecucao: '2026-04-30',
        reancorarAgenda: false,
      }),
    });

    await rotinasAtividadesService.saveRotina(makeRotina({
      proximaExecucao: '2026-05-15',
      reancorarAgenda: true,
    }));
    expect(supabaseMock.rpc).toHaveBeenLastCalledWith('salvar_rotina_programada', {
      p_payload: expect.objectContaining({
        primeiraExecucao: '2026-05-15',
        reancorarAgenda: true,
      }),
    });
  });

  it('atribui o lote de forma atômica em uma única chamada', async () => {
    const success = makeRotina({ protocoloCodigo: 'folha' });
    const failure = makeRotina({
      id: '66666666-6666-4666-8666-666666666666',
      protocoloCodigo: 'extrato',
    });
    supabaseMock.rpc.mockResolvedValue({
      data: { atualizadas: [success.id, failure.id] },
      error: null,
    });

    const result = await rotinasAtividadesService.atribuirResponsavelRotinasEmLote(
      [success, failure],
      '55555555-5555-4555-8555-555555555555',
    );

    expect(supabaseMock.rpc).toHaveBeenCalledOnce();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('atribuir_responsavel_rotinas_lote', {
      p_rotina_ids: [success.id, failure.id],
      p_responsavel_config_usuario_id: '55555555-5555-4555-8555-555555555555',
    });
    expect(result.atualizadas).toEqual([success.id, failure.id]);
    expect(result.falhas).toEqual([]);
  });

  it('bloqueia o lote acima do contrato atômico antes de chamar a RPC', async () => {
    const rotinas = Array.from({ length: ROTINAS_BATCH_LIMIT + 1 }, (_, index) => (
      makeRotina({ id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}` })
    ));

    await expect(rotinasAtividadesService.atribuirResponsavelRotinasEmLote(
      rotinas,
      '55555555-5555-4555-8555-555555555555',
    )).rejects.toThrow('Selecione no máximo 200 rotinas por lote.');
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('cria tarefa somente pela RPC operacional, sem enviar status controlado pelo servidor', async () => {
    await rotinasAtividadesService.saveTarefa(makeTarefa());

    expect(supabaseMock.rpc).toHaveBeenCalledOnce();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('salvar_tarefa_operacional', {
      p_tarefa_id: null,
      p_payload: expect.objectContaining({
        titulo: 'Conferir documentos',
        responsavel_config_usuario_id: '44444444-4444-4444-8444-444444444444',
        vencimento: '2026-09-05',
        prazo_legal: '2026-09-05',
        prazo_interno: '2026-09-05',
        checklist: [{ titulo: 'Validar XML', concluida: false }],
      }),
    });
    const payload = supabaseMock.rpc.mock.calls[0][1].p_payload;
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('empresa_id');
    expect(payload).not.toHaveProperty('responsavel_user_id');
  });

  it('envia apenas o progresso permitido para a RPC parcial', async () => {
    const id = '77777777-7777-4777-8777-777777777777';

    await rotinasAtividadesService.updateTarefaProgress(id, {
      notas: 'Documento conferido',
      observacaoFalta: '',
    });

    expect(supabaseMock.rpc).toHaveBeenCalledWith('atualizar_progresso_tarefa_operacional', {
      p_tarefa_id: id,
      p_payload: {
        notas: 'Documento conferido',
        observacao_falta: null,
      },
    });
  });

  it('delega checklist ao fluxo que deriva status e preserva evidência/revisão', async () => {
    const id = '77777777-7777-4777-8777-777777777777';

    await rotinasAtividadesService.updateTarefaChecklist(id, 0, true, 'arquivo.pdf', 'Validado');

    expect(supabaseMock.rpc).toHaveBeenCalledWith('atualizar_tarefa_operacional_checklist', {
      p_tarefa_id: id,
      p_indice: 0,
      p_concluida: true,
      p_evidencia: 'arquivo.pdf',
      p_justificativa: 'Validado',
    });
  });

  it('arquiva tarefa pela RPC canônica sem update direto na tabela', async () => {
    const id = '77777777-7777-4777-8777-777777777777';

    await rotinasAtividadesService.deleteTarefa(id);

    expect(supabaseMock.rpc).toHaveBeenCalledWith('salvar_tarefa_operacional', {
      p_tarefa_id: id,
      p_payload: { ativo: false },
    });
  });
});
