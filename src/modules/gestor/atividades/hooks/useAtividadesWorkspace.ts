import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  rotinasAtividadesService,
  type RotinaAtividade,
  type TarefaGestor,
  type TarefaProgressoPatch,
} from '../services/rotinasAtividadesService';
import { tarefaChecklistAuditKeys } from '../queries/tarefaChecklistAuditQueries';
import { protocolosKeys } from '../../protocolos/queries/protocolosQueries';

export const atividadesKeys = {
  all: ['atividades'] as const,
  workspace: () => [...atividadesKeys.all, 'workspace'] as const,
  permissoes: () => [...atividadesKeys.all, 'permissoes'] as const,
};

export const useAtividadesPodeGerenciar = () => useQuery({
  queryKey: atividadesKeys.permissoes(),
  queryFn: () => rotinasAtividadesService.getPodeGerenciar(),
  staleTime: 60_000,
});

export const useAtividadesWorkspace = () => {
  const queryClient = useQueryClient();
  const workspaceQuery = useQuery({
    queryKey: atividadesKeys.workspace(),
    queryFn: () => rotinasAtividadesService.getWorkspace(),
    staleTime: 30_000,
  });
  const permissoesQuery = useAtividadesPodeGerenciar();

  const invalidateWorkspace = () => {
    void queryClient.invalidateQueries({ queryKey: atividadesKeys.workspace() });
  };

  const saveRotinaMutation = useMutation({
    mutationFn: (rotina: RotinaAtividade) => rotinasAtividadesService.saveRotina(rotina),
    onSuccess: invalidateWorkspace,
  });

  const deleteRotinaMutation = useMutation({
    mutationFn: (id: string) => rotinasAtividadesService.deleteRotina(id),
    onSuccess: invalidateWorkspace,
  });

  const assignResponsibleMutation = useMutation({
    mutationFn: ({ rotina, responsibleId }: { rotina: RotinaAtividade; responsibleId: string }) => (
      rotinasAtividadesService.atribuirResponsavelRotina(rotina, responsibleId)
    ),
    onSuccess: invalidateWorkspace,
  });

  const assignResponsibleBatchMutation = useMutation({
    mutationFn: async ({ rotinas, responsibleId }: { rotinas: RotinaAtividade[]; responsibleId: string }) => {
      const result = await rotinasAtividadesService.atribuirResponsavelRotinasEmLote(rotinas, responsibleId);
      return {
        successIds: result.atualizadas,
        failed: result.falhas.map((item) => ({ id: item.rotinaId, error: item.mensagem })),
      };
    },
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

  const updateTarefaProgressMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TarefaProgressoPatch }) => (
      rotinasAtividadesService.updateTarefaProgress(id, patch)
    ),
    onSuccess: invalidateWorkspace,
  });

  const updateTarefaChecklistMutation = useMutation({
    mutationFn: ({
      id,
      index,
      concluida,
      evidencia,
      justificativa,
    }: {
      id: string;
      index: number;
      concluida: boolean;
      evidencia?: string;
      justificativa?: string;
    }) => rotinasAtividadesService.updateTarefaChecklist(
      id,
      index,
      concluida,
      evidencia,
      justificativa,
    ),
    onSuccess: async (_result, { id }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: atividadesKeys.workspace(), exact: true }),
        queryClient.invalidateQueries({ queryKey: tarefaChecklistAuditKeys.byTask(id), exact: true }),
        queryClient.invalidateQueries({ queryKey: protocolosKeys.all }),
      ]);
    },
  });

  const workspace = workspaceQuery.data || {
    rotinas: [],
    tarefas: [],
    usuarios: [],
    usuarioAtual: null,
    clientes: [],
    modelos: [],
  };

  const actions = useMemo(() => ({
    saveRotina: (rotina: RotinaAtividade) => saveRotinaMutation.mutate(rotina),
    saveRotinaAsync: (rotina: RotinaAtividade) => saveRotinaMutation.mutateAsync(rotina),
    deleteRotina: (id: string) => deleteRotinaMutation.mutate(id),
    deleteRotinaAsync: (id: string) => deleteRotinaMutation.mutateAsync(id),
    assignResponsibleAsync: (payload: { rotina: RotinaAtividade; responsibleId: string }) => (
      assignResponsibleMutation.mutateAsync(payload)
    ),
    assignResponsibleBatchAsync: (payload: { rotinas: RotinaAtividade[]; responsibleId: string }) => (
      assignResponsibleBatchMutation.mutateAsync(payload)
    ),
    saveTarefa: (tarefa: TarefaGestor) => saveTarefaMutation.mutate(tarefa),
    saveTarefaAsync: (tarefa: TarefaGestor) => saveTarefaMutation.mutateAsync(tarefa),
    deleteTarefa: (id: string) => deleteTarefaMutation.mutate(id),
    updateTarefa: (id: string, patch: TarefaProgressoPatch) => (
      updateTarefaProgressMutation.mutate({ id, patch })
    ),
    updateTarefaAsync: (id: string, patch: TarefaProgressoPatch) => (
      updateTarefaProgressMutation.mutateAsync({ id, patch })
    ),
    toggleChecklist: (
      taskId: string,
      index: number,
      concluida: boolean,
      evidencia?: string,
      justificativa?: string,
    ) => {
      updateTarefaChecklistMutation.mutate({
        id: taskId,
        index,
        concluida,
        evidencia,
        justificativa,
      });
    },
    toggleChecklistAsync: (
      taskId: string,
      index: number,
      concluida: boolean,
      evidencia?: string,
      justificativa?: string,
    ) => updateTarefaChecklistMutation.mutateAsync({
      id: taskId,
      index,
      concluida,
      evidencia,
      justificativa,
    }),
  }), [
    assignResponsibleBatchMutation,
    assignResponsibleMutation,
    deleteRotinaMutation,
    deleteTarefaMutation,
    saveRotinaMutation,
    saveTarefaMutation,
    updateTarefaChecklistMutation,
    updateTarefaProgressMutation,
  ]);

  return {
    rotinas: workspace.rotinas,
    tarefas: workspace.tarefas,
    usuarios: workspace.usuarios,
    usuarioAtual: workspace.usuarioAtual,
    clientes: workspace.clientes,
    modelos: workspace.modelos,
    podeGerenciar: Boolean(permissoesQuery.data),
    isLoadingPermissoes: permissoesQuery.isLoading,
    isLoading: workspaceQuery.isLoading,
    workspaceError: workspaceQuery.error,
    refetchWorkspace: workspaceQuery.refetch,
    ...actions,
    isSaving: saveTarefaMutation.isPending
      || saveRotinaMutation.isPending
      || deleteRotinaMutation.isPending
      || deleteTarefaMutation.isPending
      || assignResponsibleMutation.isPending
      || assignResponsibleBatchMutation.isPending
      || updateTarefaProgressMutation.isPending
      || updateTarefaChecklistMutation.isPending,
    saveError: saveTarefaMutation.error
      || saveRotinaMutation.error
      || deleteTarefaMutation.error
      || updateTarefaProgressMutation.error
      || updateTarefaChecklistMutation.error
      || null,
  };
};
