import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface RenameFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newName: string) => void;
  currentName: string;
}

export const RenameFileModal: React.FC<RenameFileModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  currentName,
}) => {
  const [newName, setNewName] = useState(currentName);

  useEffect(() => {
    if (isOpen) {
      setNewName(currentName);
    }
  }, [isOpen, currentName]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onSubmit(newName.trim());
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Renomear Arquivo</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
              Novo Nome do Arquivo
            </label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none' }}
              autoFocus
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', fontSize: '0.82rem', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff', color: '#475569' }}>
              Cancelar
            </button>
            <button type="submit" style={{ padding: '8px 16px', fontSize: '0.82rem', background: 'var(--color-gold-gradient)', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              Renomear
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
