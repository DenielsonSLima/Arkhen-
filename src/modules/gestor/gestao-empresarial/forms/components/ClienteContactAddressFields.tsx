import React from 'react';
import { formatCEP, formatPhone } from '../clienteFormModel';

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
    <h4 className="form-fields-section-title">Contatos Principais</h4>
    <div className="fields-grid">
      <div className="input-container field-col-4">
        <label>Contato Responsável</label>
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

interface ClienteAddressFieldsProps {
  cep: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  showDetailedPlaceholders?: boolean;
  onCepChange: (value: string) => void;
  onEnderecoChange: (value: string) => void;
  onBairroChange: (value: string) => void;
  onCidadeChange: (value: string) => void;
  onUfChange: (value: string) => void;
}

export const ClienteAddressFields: React.FC<ClienteAddressFieldsProps> = ({
  cep,
  endereco,
  bairro,
  cidade,
  uf,
  showDetailedPlaceholders = false,
  onCepChange,
  onEnderecoChange,
  onBairroChange,
  onCidadeChange,
  onUfChange,
}) => (
  <div className="form-fields-section">
    <h4 className="form-fields-section-title">Localização / Endereço Fiscal</h4>
    <div className="fields-grid">
      <div className="input-container field-col-3">
        <label>CEP</label>
        <input
          type="text"
          className="input-style"
          placeholder="00000-000"
          value={cep}
          onChange={(event) => onCepChange(formatCEP(event.target.value))}
        />
      </div>

      <div className="input-container field-col-6">
        <label>Endereço (Rua, Número, Comp.)</label>
        <input
          type="text"
          className="input-style"
          placeholder={showDetailedPlaceholders ? 'Ex: Av. Paulista, 1200 - Apto 34' : undefined}
          value={endereco}
          onChange={(event) => onEnderecoChange(event.target.value)}
        />
      </div>

      <div className="input-container field-col-3">
        <label>Bairro</label>
        <input
          type="text"
          className="input-style"
          placeholder={showDetailedPlaceholders ? 'Ex: Bela Vista' : undefined}
          value={bairro}
          onChange={(event) => onBairroChange(event.target.value)}
        />
      </div>

      <div className="input-container field-col-9">
        <label>Cidade</label>
        <input
          type="text"
          className="input-style"
          placeholder={showDetailedPlaceholders ? 'Ex: São Paulo' : undefined}
          value={cidade}
          onChange={(event) => onCidadeChange(event.target.value)}
        />
      </div>

      <div className="input-container field-col-3">
        <label>UF</label>
        <input
          type="text"
          className="input-style"
          placeholder={showDetailedPlaceholders ? 'SP' : undefined}
          maxLength={2}
          value={uf}
          onChange={(event) => onUfChange(event.target.value.toUpperCase())}
        />
      </div>
    </div>
  </div>
);
