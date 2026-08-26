import React from 'react';
import { CheckCircle2, Repeat } from 'lucide-react';

interface MinhaFilaEmptyStateProps {
  taskCount: number;
  onConfigureRotinas?: () => void;
}

export const MinhaFilaEmptyState: React.FC<MinhaFilaEmptyStateProps> = ({
  taskCount,
  onConfigureRotinas,
}) => (
  <div className="empty-state-card" style={emptyStateStyle}>
    <CheckCircle2 size={38} color="var(--color-gold-primary)" />
    <p>{taskCount === 0
      ? 'Sua fila ainda não possui tarefas. Crie uma rotina para gerar os próximos trabalhos automaticamente.'
      : 'Nenhuma tarefa encontrada para este filtro.'}</p>
    {onConfigureRotinas && (
      <button type="button" onClick={onConfigureRotinas} style={actionButtonStyle}>
        <Repeat size={15} /> Ver rotinas programadas
      </button>
    )}
  </div>
);

const emptyStateStyle = { padding: '40px', textAlign: 'center' as const, color: '#64748b' };
const actionButtonStyle = {
  background: 'linear-gradient(135deg, #c59235 0%, #aa7c28 100%)',
  border: 'none',
  borderRadius: '8px',
  padding: '9px 14px',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};
