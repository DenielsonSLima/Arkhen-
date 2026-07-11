import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  rotinasAtividadesService,
  type RotinaAtividade,
  type TarefaGestor,
} from '../services/rotinasAtividadesService';

export const atividadesKeys = {
  all: ['atividades'] as const,
  workspace: () => [...atividadesKeys.all, 'workspace'] as const,
};

export const useAtividadesWorkspace = () => {
  const queryClient = useQueryClient();
  const workspaceQuery = useQuery({
    queryKey: atividadesKeys.workspace(),
    queryFn: () => rotinasAtividadesService.getWorkspace(),
    staleTime: 30_000,
  });

  const invalidateWorkspace = () => {
    queryClient.invalidateQueries({ queryKey: atividadesKeys.workspace() });
  };

  const saveRotinaMutation = useMutation({
    mutationFn: (rotina: RotinaAtividade) => rotinasAtividadesService.saveRotina(rotina),
    onSuccess: invalidateWorkspace,
  });

  const deleteRotinaMutation = useMutation({
    mutationFn: (id: string) => rotinasAtividadesService.deleteRotina(id),
    onSuccess: invalidateWorkspace,
  });

  const saveTarefaMutation = useMutation({
    mutationFn: (tarefa: TarefaGestor) => rotinasAtividadesService.saveTarefa(tarefa),
    onSuccess: invalidateWorkspace,
  });

  const deleteTarefaMutation = useMutation({
    mutationFn: (id: string) => rotinasAtividadesService.deleteTarefa(id),
    onSuccess: invalidateWorkspace,
  });

  const workspace = workspaceQuery.data || { rotinas: [], tarefas: [] };

  const actions = useMemo(() => ({
    saveRotina: (rotina: RotinaAtividade) => saveRotinaMutation.mutate(rotina),
    deleteRotina: (id: string) => deleteRotinaMutation.mutate(id),
    saveTarefa: (tarefa: TarefaGestor) => saveTarefaMutation.mutate(tarefa),
    deleteTarefa: (id: string) => deleteTarefaMutation.mutate(id),
    updateTarefa: (id: string, patch: Partial<TarefaGestor>) => {
      const current = workspace.tarefas.find((tarefa) => tarefa.id === id);
      if (current) saveTarefaMutation.mutate({ ...current, ...patch });
    },
    toggleChecklist: (taskId: string, index: number, concluida: boolean) => {
      const current = workspace.tarefas.find((tarefa) => tarefa.id === taskId);
      if (!current) return;
      const checklist = current.checklist.map((item, itemIndex) => (
        itemIndex === index ? { ...item, concluida } : item
      ));
      const done = checklist.length > 0 && checklist.every((item) => item.concluida);
      saveTarefaMutation.mutate({
        ...current,
        checklist,
        status: done ? 'Concluída' : current.status === 'Concluída' ? 'Em andamento' : current.status,
      });
    },
  }), [deleteRotinaMutation, deleteTarefaMutation, saveRotinaMutation, saveTarefaMutation, workspace.tarefas]);

  return {
    rotinas: workspace.rotinas,
    tarefas: workspace.tarefas,
    isLoading: workspaceQuery.isLoading,
    ...actions,
  };
};
