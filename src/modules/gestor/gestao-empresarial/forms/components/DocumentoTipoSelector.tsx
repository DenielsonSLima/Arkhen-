import React from 'react';

type DocumentType = 'CPF' | 'CNPJ';

interface DocumentoTipoSelectorProps {
  value: DocumentType;
  onChange: (value: DocumentType) => void;
}

export const DocumentoTipoSelector: React.FC<DocumentoTipoSelectorProps> = ({ value, onChange }) => (
  <div className="document-selector-group">
    <span className="document-selector-label">Tipo de Cadastro</span>
    <div className="document-type-tabs">
      <button
        type="button"
        className={`document-type-btn ${value === 'CNPJ' ? 'active' : ''}`}
        onClick={() => onChange('CNPJ')}
      >
        CNPJ (Empresa)
      </button>
      <button
        type="button"
        className={`document-type-btn ${value === 'CPF' ? 'active' : ''}`}
        onClick={() => onChange('CPF')}
      >
        CPF (Física)
      </button>
    </div>
  </div>
);
