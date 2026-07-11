import React from 'react';
import { X } from 'lucide-react';

interface FormCardProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  containerClassName?: string;
}

export const FormCard: React.FC<FormCardProps> = ({ title, onClose, children, containerClassName }) => {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal-container animate-slide-down ${containerClassName || ''}`}
        style={{ maxWidth: '500px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn-close-modal" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body" style={{ marginTop: '16px' }}>
          {children}
        </div>
      </div>
    </div>
  );
};
