import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import './SystemToast.css';

export type SystemToastType = 'success' | 'error' | 'info';

export interface SystemToastData {
  id: number;
  type: SystemToastType;
  title: string;
  message: string;
}

interface SystemToastProps {
  toast: SystemToastData | null;
  onClose: () => void;
}

const icons = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

export const SystemToast: React.FC<SystemToastProps> = ({ toast, onClose }) => {
  if (!toast || typeof document === 'undefined') return null;

  const Icon = icons[toast.type];

  return createPortal(
    <div
      key={toast.id}
      className={`system-toast system-toast--${toast.type}`}
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
    >
      <span className="system-toast__icon"><Icon size={20} /></span>
      <span className="system-toast__content">
        <strong>{toast.title}</strong>
        <span>{toast.message}</span>
      </span>
      <button type="button" className="system-toast__close" onClick={onClose} aria-label="Fechar notificação">
        <X size={17} />
      </button>
    </div>,
    document.body,
  );
};
