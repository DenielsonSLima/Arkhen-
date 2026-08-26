import React, { useEffect, useState } from 'react';
import type { TarefaGestor } from '../services/rotinasAtividadesService';

interface TaskReviewActionsProps {
  task: TarefaGestor;
  authUserId: string | null;
  canManage: boolean;
  isSaving: boolean;
  onReview: (id: string, approve: boolean, justification?: string) => Promise<unknown>;
  onReopen: (id: string, justification: string) => Promise<unknown>;
}

const actionButton = {
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  background: '#fff',
  color: '#334155',
  padding: '8px 12px',
  fontWeight: 700,
  cursor: 'pointer',
};

export const TaskReviewActions: React.FC<TaskReviewActionsProps> = ({
  task,
  authUserId,
  canManage,
  isSaving,
  onReview,
  onReopen,
}) => {
  const [reviewReason, setReviewReason] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [localError, setLocalError] = useState('');
  const canReview = task.status === 'Aguardando revisão'
    && Boolean(authUserId && task.revisorUserId === authUserId);
  const canReopen = canManage
    && (task.status === 'Aguardando revisão' || task.status === 'Concluída');

  useEffect(() => {
    setReviewReason('');
    setReopenReason('');
    setLocalError('');
  }, [task.id]);

  if (!canReview && !canReopen) return null;

  const run = async (operation: () => Promise<unknown>) => {
    setLocalError('');
    try {
      await operation();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Não foi possível concluir a operação.');
    }
  };

  return (
    <section style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', display: 'grid', gap: '12px' }}>
      <strong style={{ color: '#0f172a' }}>Revisão e reabertura auditáveis</strong>
      {canReview && (
        <div style={{ display: 'grid', gap: '8px' }}>
          <label style={{ display: 'grid', gap: '5px', fontSize: '0.8rem', fontWeight: 700 }}>
            Motivo da revisão
            <textarea
              value={reviewReason}
              onChange={(event) => setReviewReason(event.target.value)}
              placeholder="Obrigatório para rejeitar; opcional para aprovar."
              rows={2}
            />
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={isSaving}
              style={{ ...actionButton, borderColor: '#16a34a', color: '#166534' }}
              onClick={() => void run(() => onReview(task.id, true, reviewReason))}
            >
              Aprovar conclusão
            </button>
            <button
              type="button"
              disabled={isSaving || reviewReason.trim().length < 8}
              style={{ ...actionButton, borderColor: '#dc2626', color: '#b91c1c' }}
              onClick={() => void run(() => onReview(task.id, false, reviewReason))}
            >
              Rejeitar e devolver
            </button>
          </div>
        </div>
      )}
      {canReopen && (
        <div style={{ display: 'grid', gap: '8px' }}>
          <label style={{ display: 'grid', gap: '5px', fontSize: '0.8rem', fontWeight: 700 }}>
            Justificativa da reabertura
            <textarea
              value={reopenReason}
              onChange={(event) => setReopenReason(event.target.value)}
              placeholder="Descreva por que a tarefa precisa voltar ao andamento (mínimo de 8 caracteres)."
              rows={2}
            />
          </label>
          <button
            type="button"
            disabled={isSaving || reopenReason.trim().length < 8}
            style={{ ...actionButton, justifySelf: 'start' }}
            onClick={() => void run(() => onReopen(task.id, reopenReason))}
          >
            Reabrir tarefa
          </button>
        </div>
      )}
      {localError && <div role="alert" style={{ color: '#b91c1c' }}>{localError}</div>}
    </section>
  );
};
