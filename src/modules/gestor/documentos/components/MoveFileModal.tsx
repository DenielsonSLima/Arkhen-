import React from 'react';
import { X } from 'lucide-react';

interface MoveFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (targetFolder: string) => void;
  folders: string[];
  selectedFolder: string | null;
}

export const MoveFileModal: React.FC<MoveFileModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  folders,
  selectedFolder,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Mover para Pasta</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '14px', marginTop: 0 }}>
          Selecione o destino de pasta para este arquivo:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
          <button
            onClick={() => onSubmit('')}
            style={{ textAlign: 'left', padding: '10px 14px', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: '#f8fafc', cursor: 'pointer', fontWeight: 600 }}
          >
            / Raiz (Sem Pasta)
          </button>
          {folders.map((folderName, idx) => (
            <button
              key={idx}
              onClick={() => onSubmit(folderName)}
              style={{ textAlign: 'left', padding: '10px 14px', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: '#ffffff', cursor: 'pointer', fontWeight: folderName === selectedFolder ? 700 : 'normal', color: folderName === selectedFolder ? 'var(--color-gold-dark)' : '#1e293b' }}
            >
              📁 {folderName}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
