import type { TarefaGestor, UsuarioAtividade } from '../services/rotinasAtividadesService';

export type MinhaFilaFiltro = 'hoje' | 'semana' | 'mes' | 'atrasadas' | 'internas';

export const MINHA_FILA_FILTROS: Array<{ id: MinhaFilaFiltro; label: string }> = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mês' },
  { id: 'atrasadas', label: 'Atrasadas' },
  { id: 'internas', label: 'Internas' },
];

export const isTarefaDoUsuario = (
  tarefa: TarefaGestor,
  authUserId: string | null,
  usuarioAtual: UsuarioAtividade | null,
) => {
  if (!authUserId || !usuarioAtual) return false;
  if (tarefa.status === 'Aguardando revisão' && tarefa.revisorUserId === authUserId) return true;
  if (tarefa.responsavelUserId) return tarefa.responsavelUserId === authUserId;

  return tarefa.responsavelConfigUsuarioId === usuarioAtual.configUsuarioId;
};

export const tarefasDoUsuario = (
  tarefas: TarefaGestor[],
  authUserId: string | null,
  usuarioAtual: UsuarioAtividade | null,
) => tarefas.filter((tarefa) => isTarefaDoUsuario(tarefa, authUserId, usuarioAtual));
