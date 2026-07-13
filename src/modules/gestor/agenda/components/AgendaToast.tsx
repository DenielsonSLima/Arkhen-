import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export type AgendaToastData = {
  type: 'success' | 'error';
  message: string;
};

interface AgendaToastProps {
  toast: AgendaToastData | null;
}

export const AgendaToast: React.FC<AgendaToastProps> = ({ toast }) => {
  if (!toast) return null;

  return (
    <div className="agenda-toast animate-fade-in" role="status" aria-live="polite">
      {toast.type === 'success' ? (
        <CheckCircle2 size={18} className="agenda-toast-icon success" />
      ) : (
        <AlertTriangle size={18} className="agenda-toast-icon error" />
      )}
      <span>{toast.message}</span>
    </div>
  );
};
