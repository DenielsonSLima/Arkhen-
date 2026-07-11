import React from 'react';

interface ContadorFormProps {
  nome: string;
  setNome: (v: string) => void;
  crc: string;
  setCrc: (v: string) => void;
  cpfCnpj: string;
  setCpfCnpj: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  isAdding: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export const ContadorForm: React.FC<ContadorFormProps> = ({
  nome,
  setNome,
  crc,
  setCrc,
  cpfCnpj,
  setCpfCnpj,
  email,
  setEmail,
  isAdding,
  onSubmit,
  onCancel,
}) => {
  return (
    <form onSubmit={onSubmit} className="config-form popup-form animate-fade-in">
      <div className="form-item-group">
        <label>Nome Completo</label>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome do contador"
          disabled={isAdding}
          required
        />
      </div>

      <div className="form-row-grid">
        <div className="form-item-group">
          <label>Registro CRC</label>
          <input
            type="text"
            value={crc}
            onChange={(e) => setCrc(e.target.value)}
            placeholder="Ex: SP-123456/O"
            disabled={isAdding}
            required
          />
        </div>

        <div className="form-item-group">
          <label>CPF/CNPJ (para Assinatura)</label>
          <input
            type="text"
            value={cpfCnpj}
            onChange={(e) => setCpfCnpj(e.target.value)}
            placeholder="000.000.000-00"
            disabled={isAdding}
            required
          />
        </div>
      </div>

      <div className="form-item-group">
        <label>E-mail de Contato</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="contador@empresa.com"
          disabled={isAdding}
          required
        />
      </div>

      <div className="popup-form-buttons">
        <button type="button" onClick={onCancel} className="btn-cancel" disabled={isAdding}>
          Cancelar
        </button>
        <button type="submit" className="btn-invite" disabled={isAdding}>
          {isAdding ? 'Cadastrando...' : 'Salvar Contador'}
        </button>
      </div>
    </form>
  );
};
