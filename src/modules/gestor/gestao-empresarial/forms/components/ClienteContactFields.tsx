import React from 'react';
import { formatPhone } from '../clienteFormModel';

interface ClienteContactFieldsProps {
  contato: string;
  telefone: string;
  email: string;
  onContatoChange: (value: string) => void;
  onTelefoneChange: (value: string) => void;
  onEmailChange: (value: string) => void;
}

export const ClienteContactFields: React.FC<ClienteContactFieldsProps> = ({
  contato,
  telefone,
  email,
  onContatoChange,
  onTelefoneChange,
  onEmailChange,
}) => (
  <div className="form-fields-section">
    <h4 className="form-fields-section-title">Contatos principais</h4>
    <div className="fields-grid">
      <div className="input-container field-col-4">
        <label>Contato responsável</label>
        <input
          type="text"
          className="input-style"
          placeholder="Nome do contato"
          value={contato}
          onChange={(event) => onContatoChange(event.target.value)}
        />
      </div>
      <div className="input-container field-col-4">
        <label>Telefone</label>
        <input
          type="text"
          className="input-style"
          placeholder="(00) 00000-0000"
          value={telefone}
          onChange={(event) => onTelefoneChange(formatPhone(event.target.value))}
        />
      </div>
      <div className="input-container field-col-4">
        <label>E-mail</label>
        <input
          type="email"
          className="input-style"
          placeholder="financeiro@empresa.com"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
        />
      </div>
    </div>
  </div>
);
