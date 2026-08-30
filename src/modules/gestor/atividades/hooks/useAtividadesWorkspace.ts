import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  rotinasAtividadesService,
  type RotinaAtividade,
  type TarefaGestor,
} from '../services/rotinasAtividadesService';
import { taskWorkflowService } from '../services/taskWorkflowService';
import type { CompletionEvidence } from '../utils/completionEvidence';
import { invalidateAfterMutation } from '../../shared/mutationInvalidation';

export const atividadesKeys = {
  all: ['atividades'] as const,
  workspace: () => [...atividadesKeys.all, 'workspace'] as const,
  modelos: () => [...atividadesKeys.all, 'modelos'] as const,
  permissoes: () => [...atividadesKeys.all, 'permissoes'] as const,
};

export const useAtividadesWorkspace = () => {
  const queryClient = useQueryClient();
  const workspaceQuery = useQuery({
    queryKey: atividadesKeys.workspace(),
    queryFn: () => rotinasAtividadesService.getWorkspace(),
    staleTime: 30_000,
  });
  const permissoesQuery = useQuery({
    queryKey: atividadesKeys.permissoes(),
    queryFn: () => rotinasAtividadesService.getPodeGerenciar(),
    staleTime: 60_000,
  });
  const invalidateWorkspace = () => {
    return invalidateAfterMutation(queryClient, 'atividades');
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

  const progressMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<TarefaGestor> }) => (
      rotinasAtividadesService.updateTarefaProgress(id, patch)
    ),
    onSuccess: invalidateWorkspace,
  });

  const checklistMutation = useMutation({
    mutationFn: ({ tarefa, index, concluida, proof }: {
      tarefa: TarefaGestor;
      index: number;
      concluida: boolean;
      proof?: CompletionEvidence;
    }) => rotinasAtividadesService.toggleTarefaChecklist(tarefa, index, concluida, proof),
    onSuccess: invalidateWorkspace,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, approve, justification }: {
      id: string;
      approve: boolean;
      justification?: string;
    }) => taskWorkflowService.reviewTask(id, approve, justification),
    onSuccess: invalidateWorkspace,
  });

  const reopenMutation = useMutation({
    mutationFn: ({ id, justification }: { id: string; justification: string }) => (
      taskWorkflowService.reopenTask(id, justification)
    ),
    onSuccess: invalidateWorkspace,
  });

  const workspace = workspaceQuery.data || {
    rotinas: [],
    tarefas: [],
    usuarios: [],
    revisores: [],
    clientes: [],
    authUserId: null,
    usuarioAtual: null,
  };

  const actions = useMemo(() => ({
    saveRotina: (rotina: RotinaAtividade) => saveRotinaMutation.mutate(rotina),
    saveRotinaAsync: (rotina: RotinaAtividade) => saveRotinaMutation.mutateAsync(rotina),
    deleteRotina: (id: string) => deleteRotinaMutation.mutate(id),
    saveTarefa: (tarefa: TarefaGestor) => saveTarefaMutation.mutate(tarefa),
    saveTarefaAsync: (tarefa: TarefaGestor) => saveTarefaMutation.mutateAsync(tarefa),
    deleteTarefa: (id: string) => deleteTarefaMutation.mutate(id),
    updateTarefa: (id: string, patch: Partial<TarefaGestor>) => {
      const current = workspace.tarefas.find((tarefa) => tarefa.id === id);
      if (!current) return;
      const progressKeys = new Set([
        'notas', 'observacaoFalta', 'evidencia', 'justificativaConclusao',
      ]);
      const keys = Object.keys(patch);
      if (keys.length > 0 && keys.every((key) => progressKeys.has(key))) {
        progressMutation.mutate({ id, patch });
        return;
      }
      if (keys.some((key) => key === 'status' || key === 'dataHoraConclusao')) return;
      saveTarefaMutation.mutate({ ...current, ...patch });
    },
    toggleChecklist: (
      taskId: string,
      index: number,
      concluida: boolean,
      proof?: CompletionEvidence,
    ) => {
      const current = workspace.tarefas.find((tarefa) => tarefa.id === taskId);
      if (!current) return;
      checklistMutation.mutate({ tarefa: current, index, concluida, proof });
    },
    reviewTarefaAsync: (id: string, approve: boolean, justification?: string) => (
      reviewMutation.mutateAsync({ id, approve, justification })
    ),
    reopenTarefaAsync: (id: string, justification: string) => (
      reopenMutation.mutateAsync({ id, justification })
    ),
  }), [checklistMutation, deleteRotinaMutation, deleteTarefaMutation, progressMutation, reopenMutation, reviewMutation, saveRotinaMutation, saveTarefaMutation, workspace.tarefas]);

  return {
    rotinas: workspace.rotinas,
    tarefas: workspace.tarefas,
    usuarios: workspace.usuarios,
    revisores: workspace.revisores,
    clientes: workspace.clientes,
    authUserId: workspace.authUserId,
    usuarioAtual: workspace.usuarioAtual,
    podeGerenciar: Boolean(permissoesQuery.data),
    isLoadingPermissoes: permissoesQuery.isLoading,
    isLoading: workspaceQuery.isLoading || permissoesQuery.isLoading,
    isWorkspaceError: workspaceQuery.isError || permissoesQuery.isError,
    workspaceError: workspaceQuery.error || permissoesQuery.error || null,
    reloadWorkspace: async () => {
      await workspaceQuery.refetch();
    },
    ...actions,
    isSaving: saveTarefaMutation.isPending || saveRotinaMutation.isPending
      || progressMutation.isPending || checklistMutation.isPending
      || reviewMutation.isPending || reopenMutation.isPending,
    saveError: saveTarefaMutation.error || saveRotinaMutation.error
      || progressMutation.error || checklistMutation.error
      || reviewMutation.error || reopenMutation.error || null,
  };
};