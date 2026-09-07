import React from 'react';

export const FiscalConnectionPlaceholder: React.FC = () => (
  <div className="fiscal-connection-placeholder">
    <div className="form-divider-title">Conexão WebISS</div>
    <p className="input-helper-text">
      Salve o contexto, configure o certificado A1 e os parâmetros do RPS. No resumo,
      verifique os pré-requisitos e execute os testes de conexão e assinatura.
      A emissão e a consulta de notas são realizadas pelo faturamento, com a cobrança selecionada.
    </p>
    <p className="input-helper-text">
      Confirme o cadastro/CeC e a habilitação do contribuinte no portal da prefeitura antes da emissão.
    </p>
  </div>
);
