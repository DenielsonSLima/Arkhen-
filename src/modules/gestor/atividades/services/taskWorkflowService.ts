import { supabase } from '../../../../lib/supabase';
import { activityWriteError } from './rpcCompatibility';

export const taskWorkflowService = {
  async reviewTask(taskId: string, approve: boolean, justification?: string) {
    const { error } = await supabase.rpc('revisar_tarefa_operacional', {
      p_tarefa_id: taskId,
      p_aprovar: approve,
      p_justificativa: justification?.trim() || null,
    });
    if (error) throw activityWriteError('Não foi possível registrar a revisão', error);
  },

  async reopenTask(taskId: string, justification: string) {
    const { error } = await supabase.rpc('reabrir_tarefa_operacional', {
      p_tarefa_id: taskId,
      p_justificativa: justification.trim(),
    });
    if (error) throw activityWriteError('Não foi possível reabrir a tarefa', error);
  },
};
