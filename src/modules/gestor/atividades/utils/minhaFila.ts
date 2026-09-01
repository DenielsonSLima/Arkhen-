import type {
  TarefaGestor,
  UsuarioAtividade,
} from '../services/rotinasAtividadesService';

export const getTarefasDoUsuarioAtual = (
  tarefas: TarefaGestor[],
  usuarioAtual: UsuarioAtividade | null,
) => {
  if (!usuarioAtual) return [];

  return tarefas.filter((tarefa) => {
    if (usuarioAtual.userId && tarefa.responsavelUserId) {
      return tarefa.responsavelUserId === usuarioAtual.userId;
    }

    return Boolean(
      usuarioAtual.configUsuarioId
      && tarefa.responsavelConfigUsuarioId === usuarioAtual.configUsuarioId,
    );
  });
};
