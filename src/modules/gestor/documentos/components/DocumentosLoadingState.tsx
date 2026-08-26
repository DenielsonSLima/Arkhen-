import React from 'react';

export const DocumentosLoadingState: React.FC = () => (
  <div className="documentos-loading-state" role="status">
    <div className="loading-spinner" aria-hidden />
    <p>Carregando documentos...</p>
  </div>
);
