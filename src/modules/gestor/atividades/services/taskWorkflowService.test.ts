import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.hoisted(() => vi.fn());
vi.mock('../../../../lib/supabase', () => ({ supabase: { rpc: rpcMock } }));

import { taskWorkflowService } from './taskWorkflowService';

describe('taskWorkflowService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcMock.mockResolvedValue({ data: null, error: null });
  });

  it('registra aprovação ou rejeição somente pelo RPC auditável', async () => {
    await taskWorkflowService.reviewTask('task-1', false, 'Documento incorreto');
    expect(rpcMock).toHaveBeenCalledWith('revisar_tarefa_operacional', {
      p_tarefa_id: 'task-1',
      p_aprovar: false,
      p_justificativa: 'Documento incorreto',
    });
  });

  it('encaminha a justificativa da reabertura sem atores do cliente', async () => {
    await taskWorkflowService.reopenTask('task-1', 'Reprocessar obrigação');
    expect(rpcMock).toHaveBeenCalledWith('reabrir_tarefa_operacional', {
      p_tarefa_id: 'task-1',
      p_justificativa: 'Reprocessar obrigação',
    });
  });
});
