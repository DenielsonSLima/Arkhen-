import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmActionModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  variant: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  title,
  message,
  confirmLabel,
  variant,
  onConfirm,
  onCancel,
}) => {
  const isDanger = variant === 'danger';
  const titleColor = isDanger ? '#ef4444' : '#fbbf24';
  const btnClass = isDanger ? 'confirm-red' : 'confirm-yellow';

  return (
    <div className="financeiro-modal-backdrop" onClick={onCancel}>
      <div className="financeiro-modal-container" onClick={(e) => e.stopPropagation()}>
        <h3 className="financeiro-modal-title" style={{ color: titleColor }}>
          <AlertTriangle size={20} style={{ color: titleColor }} />
          {title}
        </h3>
        <p className="financeiro-modal-message">
          {message}
        </p>
        <div className="financeiro-modal-actions">
          <button className="financeiro-modal-btn cancel" onClick={onCancel}>
            Cancelar
          </button>
          <button className={`financeiro-modal-btn ${btnClass}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
