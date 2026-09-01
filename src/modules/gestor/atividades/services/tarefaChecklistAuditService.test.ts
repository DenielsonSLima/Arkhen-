import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.hoisted(() => {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  builder.limit = vi.fn();
  builder.order = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.select = vi.fn(() => builder);
  const from = vi.fn(() => builder);
  return { from, builder };
});

vi.mock('../../../../lib/supabase', () => ({
  supabase: { from: queryMock.from },
}));

import {
  normalizeTarefaChecklistAuditEvent,
  tarefaChecklistAuditService,
} from './tarefaChecklistAuditService';

const taskId = '77777777-7777-4777-8777-777777777777';
const eventId = '88888888-8888-4888-8888-888888888888';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('tarefaChecklistAuditService', () => {
  it('consulta somente os campos necessários e normaliza eventos válidos', async () => {
    queryMock.builder.limit.mockResolvedValueOnce({
      data: [{
        id: eventId,
        tarefa_id: taskId,
        ator_nome: '  Ana Souza  ',
        dados: { indice: '2', concluida: 'true' },
        criado_em: '2026-09-01T12:53:05-03:00',
      }],
      error: null,
    });

    await expect(tarefaChecklistAuditService.listByTask(taskId)).resolves.toEqual([{
      id: eventId,
      taskId,
      stepIndex: 2,
      completed: true,
      actorName: 'Ana Souza',
      createdAt: '2026-09-01T12:53:05-03:00',
    }]);
    expect(queryMock.from).toHaveBeenCalledWith('atividades_tarefa_eventos');
    expect(queryMock.builder.select).toHaveBeenCalledWith('id,tarefa_id,ator_nome,dados,criado_em');
    expect(queryMock.builder.eq).toHaveBeenNthCalledWith(1, 'tarefa_id', taskId);
    expect(queryMock.builder.eq).toHaveBeenNthCalledWith(2, 'tipo', 'checklist');
    expect(queryMock.builder.order).toHaveBeenCalledWith('criado_em', { ascending: false });
    expect(queryMock.builder.limit).toHaveBeenCalledWith(1_000);
  });

  it('descarta entradas malformadas e usa ator defensivo quando o nome está vazio', async () => {
    queryMock.builder.limit.mockResolvedValueOnce({
      data: [
        {
          id: eventId,
          tarefa_id: taskId,
          ator_nome: ' ',
          dados: { indice: 0, concluida: false },
          criado_em: '2026-09-01T13:00:00-03:00',
        },
        { id: '99999999-9999-4999-8999-999999999999', tarefa_id: taskId, criado_em: '2026-09-01T13:00:00-03:00' },
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          tarefa_id: taskId,
          dados: { indice: -1, concluida: true },
          criado_em: '2026-09-01T13:00:00-03:00',
        },
      ],
      error: null,
    });

    const result = await tarefaChecklistAuditService.listByTask(taskId);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ actorName: 'Usuário não identificado', completed: false });
  });

  it('propaga falha da consulta e rejeita identificador inválido antes do acesso', async () => {
    const failure = new Error('permission denied');
    queryMock.builder.limit.mockResolvedValueOnce({ data: null, error: failure });

    await expect(tarefaChecklistAuditService.listByTask(taskId)).rejects.toBe(failure);
    await expect(tarefaChecklistAuditService.listByTask('id-local')).rejects.toThrow('Tarefa inválida');
    expect(queryMock.from).toHaveBeenCalledTimes(1);
  });
});

describe('normalizeTarefaChecklistAuditEvent', () => {
  it('rejeita timestamp inválido sem criar um horário substituto', () => {
    expect(normalizeTarefaChecklistAuditEvent({
      id: eventId,
      tarefa_id: taskId,
      dados: { indice: 0, concluida: true },
      criado_em: 'inválido',
    })).toBeNull();
  });

  it('valida os UUIDs e limita o nome do ator antes de expor o evento', () => {
    const valid = normalizeTarefaChecklistAuditEvent({
      id: eventId,
      tarefa_id: taskId,
      ator_nome: 'A'.repeat(300),
      dados: { indice: 0, concluida: true },
      criado_em: '2026-09-01T13:00:00-03:00',
    });

    expect(valid?.actorName).toHaveLength(160);
    expect(normalizeTarefaChecklistAuditEvent({
      id: 'evento-forjado',
      tarefa_id: taskId,
      dados: { indice: 0, concluida: true },
      criado_em: '2026-09-01T13:00:00-03:00',
    })).toBeNull();
  });
});
