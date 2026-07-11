import React from 'react';

interface NovaCategoriaClienteModalProps {
  nome: string;
  descricao: string;
  error: string;
  isSaving?: boolean;
  onNomeChange: (value: string) => void;
  onDescricaoChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export const NovaCategoriaClienteModal: React.FC<NovaCategoriaClienteModalProps> = ({
  nome,
  descricao,
  error,
  isSaving = false,
  onNomeChange,
  onDescricaoChange,
  onCancel,
  onSubmit,
}) => (
  <div 
    className="modal-overlay-custom" 
    style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      zIndex: 10000,
    }}
  >
    <div className="cliente-form-container" style={{ maxWidth: '400px', width: '95%' }}>
      <div className="cliente-form-header">
        <h2>Nova Categoria</h2>
        <p>Cadastre uma nova categoria de cliente.</p>
      </div>

      {error && (
        <div className="form-alert-banner error" style={{ marginBottom: '12px' }}>
          <span>{error}</span>
        </div>
      )}

      <div className="cliente-form-main-fields" style={{ gap: '12px' }}>
        <div className="input-container">
          <label>Nome da Categoria *</label>
          <input
            type="text"
            className="input-style"
            placeholder="Ex: Holding Familiar"
            value={nome}
            onChange={(event) => onNomeChange(event.target.value)}
          />
        </div>

        <div className="input-container">
          <label>Descrição</label>
          <textarea
            className="input-style"
            placeholder="Descrição da categoria..."
            rows={2}
            value={descricao}
            onChange={(event) => onDescricaoChange(event.target.value)}
          />
        </div>
      </div>

      <div className="form-footer-actions" style={{ marginTop: '16px' }}>
        <button type="button" className="btn-cancel" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="btn-submit" disabled={isSaving} onClick={onSubmit}>
          {isSaving ? 'Adicionando...' : 'Adicionar'}
        </button>
      </div>
    </div>
  </div>
);
