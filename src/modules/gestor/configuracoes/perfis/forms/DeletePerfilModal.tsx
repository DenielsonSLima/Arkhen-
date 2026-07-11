import React from 'react';
import type { PerfilAcesso } from '../services/perfisService';

interface DeletePerfilModalProps {
  perfil: PerfilAcesso;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export const DeletePerfilModal: React.FC<DeletePerfilModalProps> = ({ perfil, isDeleting, onCancel, onConfirm }) => {
  return (
    <div className="modal-backdrop">
      <div className="modal-container" style={{ maxWidth: '440px' }}>
        <h3>Inativar perfil de acesso</h3>
        <p style={{ color: '#64748b', fontSize: '0.86rem', lineHeight: 1.5 }}>
          O perfil <strong>{perfil.nome}</strong> será inativado, sem apagar o histórico nem remover o modelo do banco.
          Usuários vinculados devem ser reatribuídos antes de bloquear acessos reais.
        </p>
        <div className="form-actions-row">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={isDeleting}>
            Cancelar
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Inativando...' : 'Inativar'}
          </button>
        </div>
      </div>
    </div>
  );
};
