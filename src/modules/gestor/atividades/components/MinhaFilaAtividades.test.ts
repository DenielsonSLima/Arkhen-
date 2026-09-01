import { describe, expect, it } from 'vitest';
import type { TarefaGestor, UsuarioAtividade } from '../services/rotinasAtividadesService';
import { getTarefasDoUsuarioAtual } from '../utils/minhaFila';

const tarefa = (overrides: Partial<TarefaGestor>): TarefaGestor => ({
  id: 'tarefa-base',
  titulo: 'Rotina mensal',
  categoria: 'Cliente',
  frequencia: 'Mensal',
  responsavel: 'Colaborador',
  cliente: 'Empresa Alfa',
  vencimento: '2026-09-07',
  prioridade: 'Média',
  status: 'Pendente',
  origem: 'Rotina',
  checklist: [],
  notas: '',
  ...overrides,
});

const usuarioAtual: UsuarioAtividade = {
  configUsuarioId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  nome: 'Usuário atual',
};

describe('getTarefasDoUsuarioAtual', () => {
  it('mantém na fila somente tarefas atribuídas ao auth user atual', () => {
    const tarefas = [
      tarefa({ id: 'minha', responsavelUserId: usuarioAtual.userId }),
      tarefa({
        id: 'outra',
        responsavelUserId: '33333333-3333-4333-8333-333333333333',
        responsavelConfigUsuarioId: usuarioAtual.configUsuarioId,
      }),
    ];

    expect(getTarefasDoUsuarioAtual(tarefas, usuarioAtual).map((item) => item.id)).toEqual(['minha']);
  });

  it('usa o vínculo de configuração somente quando a tarefa ainda não possui auth user', () => {
    const tarefas = [
      tarefa({ id: 'legada', responsavelConfigUsuarioId: usuarioAtual.configUsuarioId }),
      tarefa({ id: 'sem-vinculo' }),
    ];

    expect(getTarefasDoUsuarioAtual(tarefas, usuarioAtual).map((item) => item.id)).toEqual(['legada']);
  });

  it('não expõe tarefas quando o usuário atual não foi resolvido', () => {
    expect(getTarefasDoUsuarioAtual([
      tarefa({ id: 'qualquer', responsavelUserId: usuarioAtual.userId }),
    ], null)).toEqual([]);
  });
});
