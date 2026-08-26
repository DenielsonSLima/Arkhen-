import { describe, expect, it } from 'vitest';
import type { TarefaGestor, UsuarioAtividade } from '../services/rotinasAtividadesService';
import { isTarefaDoUsuario, tarefasDoUsuario } from './minhaFilaFilters';

const currentUser: UsuarioAtividade = {
  configUsuarioId: 'config-user-1',
  userId: 'auth-user-1',
  nome: 'Ana Contadora',
};

const task = (overrides: Partial<TarefaGestor>): TarefaGestor => ({
  id: 'task-1',
  titulo: 'Conferir obrigação',
  categoria: 'Fiscal',
  frequencia: 'Única',
  responsavel: 'Ana Contadora',
  cliente: 'Cliente Exemplo',
  vencimento: '2026-08-25',
  prioridade: 'Média',
  status: 'Pendente',
  origem: 'Manual',
  checklist: [],
  notas: '',
  ...overrides,
});

describe('filtro da Minha Fila', () => {
  it('aceita tarefas vinculadas diretamente ao usuário autenticado', () => {
    expect(isTarefaDoUsuario(
      task({ responsavelUserId: 'auth-user-1' }),
      'auth-user-1',
      currentUser,
    )).toBe(true);
  });

  it('aceita o vínculo operacional estável quando o auth id ainda não foi replicado', () => {
    expect(isTarefaDoUsuario(
      task({ responsavelConfigUsuarioId: 'config-user-1' }),
      'auth-user-1',
      currentUser,
    )).toBe(true);
  });

  it('não usa nome como vínculo e não mistura tarefas de outros usuários', () => {
    const result = tarefasDoUsuario([
      task({ id: 'mine', responsavelUserId: 'auth-user-1' }),
      task({ id: 'same-name', responsavel: 'Ana Contadora' }),
      task({ id: 'other', responsavelUserId: 'auth-user-2' }),
    ], 'auth-user-1', currentUser);

    expect(result.map((item) => item.id)).toEqual(['mine']);
  });

  it('trata o auth id como fonte autoritativa quando os dois vínculos divergem', () => {
    expect(isTarefaDoUsuario(task({
      responsavelUserId: 'auth-user-2',
      responsavelConfigUsuarioId: 'config-user-1',
    }), 'auth-user-1', currentUser)).toBe(false);
  });

  it('não expõe fila pessoal sem sessão ou sem vínculo operacional', () => {
    const assigned = task({ responsavelUserId: 'auth-user-1' });

    expect(isTarefaDoUsuario(assigned, null, currentUser)).toBe(false);
    expect(isTarefaDoUsuario(assigned, 'auth-user-1', null)).toBe(false);
  });
});
