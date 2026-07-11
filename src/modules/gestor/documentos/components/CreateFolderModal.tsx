import React, { useState } from 'react';
import { X, FolderOpen } from 'lucide-react';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (folderName: string) => void;
  parentFolderName?: string | null; // nome curto da pasta pai, se existir
}

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  parentFolderName,
}) => {
  const [folderName, setFolderName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    onSubmit(folderName.trim());
    setFolderName('');
  };

  const handleClose = () => {
    setFolderName('');
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal-container" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            {parentFolderName ? `Nova Subpasta em "${parentFolderName}"` : 'Criar Nova Pasta'}
          </h3>
          <button onClick={handleClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={18} />
          </button>
        </div>

        {parentFolderName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#fef9ec', border: '1px solid #fde68a', borderRadius: '8px', padding: '8px 12px', marginBottom: '14px' }}>
            <FolderOpen size={14} style={{ color: '#d97706', flexShrink: 0 }} />
            <span style={{ fontSize: '0.78rem', color: '#92400e' }}>
              Será criada dentro de <strong>{parentFolderName}</strong>
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
              Nome da {parentFolderName ? 'Subpasta' : 'Pasta'}
            </label>
            <input
              type="text"
              required
              placeholder={parentFolderName ? 'Ex: 2026' : 'Ex: Contratos de Fornecedores'}
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none', boxSizing: 'border-box' }}
              autoFocus
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
            <button
              type="button"
              onClick={handleClose}
              style={{ padding: '8px 16px', fontSize: '0.82rem', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff', color: '#475569' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{ padding: '8px 16px', fontSize: '0.82rem', background: 'var(--color-gold-gradient)', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
            >
              Criar {parentFolderName ? 'Subpasta' : 'Pasta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
