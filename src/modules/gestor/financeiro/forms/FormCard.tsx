import React from 'react';
import { X } from 'lucide-react';

interface FormCardProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  containerMaxWidth?: string;
}

export const FormCard: React.FC<FormCardProps> = ({ title, onClose, children, containerMaxWidth }) => {
  return (
    <div className="financeiro-modal-backdrop" onClick={onClose}>
      <div
        className="financeiro-modal-container"
        style={{ maxWidth: containerMaxWidth || '500px', width: '100%', position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 className="financeiro-modal-title" style={{ margin: 0 }}>{title}</h2>
          <button 
            onClick={onClose} 
            aria-label="Fechar"
            style={{ 
              background: '#e6edf5', 
              border: 'none', 
              color: '#667085',
              borderRadius: '8px',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div>
          {children}
        </div>
      </div>
    </div>
  );
};
