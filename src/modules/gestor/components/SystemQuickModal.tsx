import React from 'react';
import { createPortal } from 'react-dom';

interface SystemQuickModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onClose: () => void;
  danger?: boolean;
}

export const SystemQuickModal: React.FC<SystemQuickModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onClose,
  danger = false,
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  return createPortal(
    <div className="confirm-modal-backdrop" onClick={onClose}>
      <div className="confirm-modal-container" onClick={(event) => event.stopPropagation()}>
        <h3 className="confirm-modal-title" style={danger ? { color: '#ef4444' } : undefined}>
          {title}
        </h3>
        <p className="confirm-modal-message">{message}</p>
        <div className="confirm-modal-buttons">
          {onConfirm && (
            <button className="confirm-btn confirm-btn-no" onClick={onClose}>
              {cancelLabel}
            </button>
          )}
          <button className="confirm-btn confirm-btn-yes" onClick={handleConfirm}>
            {onConfirm ? confirmLabel : 'Entendi'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
