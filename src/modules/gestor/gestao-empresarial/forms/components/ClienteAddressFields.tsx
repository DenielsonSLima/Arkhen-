import React from 'react';
import { formatCEP } from '../clienteFormModel';

interface ClienteAddressFieldsProps {
  endereco: string;
  bairro: string;
  cep: string;
  cidade: string;
  uf: string;
  onEnderecoChange: (value: string) => void;
  onBairroChange: (value: string) => void;
  onCepChange: (value: string) => void;
  onCidadeChange: (value: string) => void;
  onUfChange: (value: string) => void;
}

export const ClienteAddressFields: React.FC<ClienteAddressFieldsProps> = ({
  endereco,
  bairro,
  cep,
  cidade,
  uf,
  onEnderecoChange,
  onBairroChange,
  onCepChange,
  onCidadeChange,
  onUfChange,
}) => (
  <div className="form-fields-section">
    <h4 className="form-fields-section-title">Localização / endereço fiscal</h4>
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
        <label>Endereço (rua, número, comp.)</label>
        <input
          type="text"
          className="input-style"
          placeholder="Ex: Av. Paulista, 1200 - Apto 34"
          value={endereco}
          onChange={(event) => onEnderecoChange(event.target.value)}
        />
      </div>
      <div className="input-container field-col-3">
        <label>Bairro</label>
        <input
          type="text"
          className="input-style"
          placeholder="Ex: Bela Vista"
          value={bairro}
          onChange={(event) => onBairroChange(event.target.value)}
        />
      </div>
      <div className="input-container field-city">
        <label>Cidade</label>
        <input
          type="text"
          className="input-style"
          placeholder="Ex: São Paulo"
          value={cidade}
          onChange={(event) => onCidadeChange(event.target.value)}
        />
      </div>
      <div className="input-container field-state">
        <label>UF</label>
        <input
          type="text"
          className="input-style"
          placeholder="SP"
          maxLength={2}
          value={uf}
          onChange={(event) => onUfChange(event.target.value.toUpperCase())}
        />
      </div>
    </div>
  </div>
);
