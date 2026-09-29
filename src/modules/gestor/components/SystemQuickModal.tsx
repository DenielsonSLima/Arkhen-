import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface SystemQuickModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void | Promise<void>;
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
  const titleId = useId();
  const messageId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    window.setTimeout(() => (cancelRef.current || dialogRef.current)?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isConfirming) onClose();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled)')];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isConfirming, isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!onConfirm) {
      onClose();
      return;
    }
    setIsConfirming(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // A ação apresenta o erro no fluxo chamador e mantém o modal controlado.
    } finally {
      setIsConfirming(false);
    }
  };

  return createPortal(
    <div className="confirm-modal-backdrop" onClick={() => { if (!isConfirming) onClose(); }}>
      <div
        ref={dialogRef}
        className="confirm-modal-container"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        aria-busy={isConfirming}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id={titleId} className="confirm-modal-title" style={danger ? { color: '#ef4444' } : undefined}>
          {title}
        </h3>
        <p id={messageId} className="confirm-modal-message">{message}</p>
        <div className="confirm-modal-buttons">
          {onConfirm && (
            <button
              ref={cancelRef}
              type="button"
              className="confirm-btn confirm-btn-no"
              onClick={onClose}
              disabled={isConfirming}
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            className="confirm-btn confirm-btn-yes"
            onClick={() => { void handleConfirm(); }}
            disabled={isConfirming}
          >
            {isConfirming ? 'Processando...' : (onConfirm ? confirmLabel : 'Entendi')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
