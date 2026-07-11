import React from 'react';

export const FiscalConnectionPlaceholder: React.FC = () => {
  return (
    <div className="fiscal-connection-placeholder">
      <div className="form-divider-title">Conexão com Provedor (futuro)</div>
      <p className="input-helper-text">
        Este painel será usado para registrar o canal de conexão real (OAuth, token, webhook e trilha de falhas).
        Por enquanto o fluxo continua concentrado na configuração do contexto de emissão por município.
      </p>
      <button type="button" className="btn-add-user" disabled>
        Conexão futura com webservice
      </button>
    </div>
  );
};
