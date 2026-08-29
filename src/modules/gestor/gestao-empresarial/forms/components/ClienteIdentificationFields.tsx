import React from 'react';
import { isClienteContabilTipo, type TipoParceiroOption } from '../../hooks/useTiposParceiros';
import { Loader2, Search } from 'lucide-react';
import {
  CLIENTE_REGIMES,
  formatCNPJ,
  formatCPF,
  type DocumentType,
  type RegimeCliente,
} from '../clienteFormModel';

interface ClienteIdentificationFieldsProps {
  docType: DocumentType;
  cnpj: string;
  cpf: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnae: string;
  tipo: RegimeCliente;
  tipoParceiroId: string;
  partnerTypes: TipoParceiroOption[];
  isLoadingPartnerTypes: boolean;
  categoria: string;
  ieIm: string;
  availableCategories: string[];
  isSearching: boolean;
  isDisabled?: boolean;
  showDetailedPlaceholders?: boolean;
  onCnpjChange: (value: string) => void;
  onCpfChange: (value: string) => void;
  onRazaoSocialChange: (value: string) => void;
  onNomeFantasiaChange: (value: string) => void;
  onCnaeChange: (value: string) => void;
  onTipoChange: (value: RegimeCliente) => void;
  onTipoParceiroChange: (value: string) => void;
  onCategoriaChange: (value: string) => void;
  onIeImChange: (value: string) => void;
  onLookup: () => void;
  onOpenCategoryModal: () => void;
}

export const ClienteIdentificationFields: React.FC<ClienteIdentificationFieldsProps> = ({
  docType,
  cnpj,
  cpf,
  razaoSocial,
  nomeFantasia,
  cnae,
  tipo,
  tipoParceiroId,
  partnerTypes,
  isLoadingPartnerTypes,
  categoria,
  ieIm,
  availableCategories,
  isSearching,
  isDisabled = false,
  showDetailedPlaceholders = false,
  onCnpjChange,
  onCpfChange,
  onRazaoSocialChange,
  onNomeFantasiaChange,
  onCnaeChange,
  onTipoChange,
  onTipoParceiroChange,
  onCategoriaChange,
  onIeImChange,
  onLookup,
  onOpenCategoryModal,
}) => (
  <div className="form-fields-section">
    <h4 className="form-fields-section-title">Identificação Básica</h4>
    <div className="fields-grid">
      <div className="input-container field-col-6">
        <label>{docType} *</label>
        {docType === 'CNPJ' ? (
          <div className="cnpj-search-wrapper">
            <input
              type="text"
              className="input-style"
              placeholder="00.000.000/0000-00"
              value={cnpj}
              onChange={(event) => onCnpjChange(formatCNPJ(event.target.value))}
            />
            <button
              type="button"
              className="cnpj-search-btn"
              onClick={onLookup}
              disabled={isSearching || isDisabled || !cnpj}
            >
              {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Buscar
            </button>
          </div>
        ) : (
          <input
            type="text"
            className="input-style"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(event) => onCpfChange(formatCPF(event.target.value))}
          />
        )}
      </div>

      <div className="input-container field-col-6">
        <label>Regime / Tipo</label>
        <select
          className="input-style"
          value={tipo}
          onChange={(event) => onTipoChange(event.target.value as RegimeCliente)}
          disabled={docType === 'CPF'}
        >
          {CLIENTE_REGIMES.map((regime) => (
            <option key={regime} value={regime}>{regime}</option>
          ))}
        </select>
      </div>

      <div className="input-container field-col-6">
        <label>{docType === 'CNPJ' ? 'Razão Social *' : 'Nome Completo *'}</label>
        <input
          type="text"
          className="input-style"
          placeholder={showDetailedPlaceholders
            ? (docType === 'CNPJ' ? 'Ex: Tech Solutions Ltda' : 'Ex: João da Silva')
            : undefined}
          value={razaoSocial}
          onChange={(event) => onRazaoSocialChange(event.target.value)}
        />
      </div>

      <div className="input-container field-col-6">
        <label>{docType === 'CNPJ' ? 'Nome Fantasia *' : 'Apelido *'}</label>
        <input
          type="text"
          className="input-style"
          placeholder={showDetailedPlaceholders
            ? (docType === 'CNPJ' ? 'Ex: Tech Solutions' : 'Ex: João')
            : undefined}
          value={nomeFantasia}
          onChange={(event) => onNomeFantasiaChange(event.target.value)}
        />
      </div>

      {docType === 'CNPJ' && (
        <div className="input-container field-col-6">
          <label>CNAE</label>
          <input
            type="text"
            className="input-style"
            placeholder="Ex: 62.01-5-01"
            value={cnae}
            onChange={(event) => onCnaeChange(event.target.value)}
          />
        </div>
      )}

      <div className="input-container field-col-6">
        <label>Tipo de relacionamento *</label>
        <select
          className="input-style"
          required
          value={tipoParceiroId}
          onChange={(event) => onTipoParceiroChange(event.target.value)}
          disabled={isLoadingPartnerTypes || isDisabled}
        >
          <option value="">{isLoadingPartnerTypes ? 'Carregando tipos...' : 'Selecione o tipo'}</option>
          {partnerTypes.map((item) => (
            <option key={item.id} value={item.id}>{item.nome}</option>
          ))}
        </select>
      </div>

      {isClienteContabilTipo(partnerTypes.find((item) => item.id === tipoParceiroId)) && (
      <div className="input-container field-col-6">
        <label>Categoria do Cliente</label>
        <div style={{ display: 'flex', gap: '6px' }}>
          <select
            className="input-style"
            value={categoria}
            onChange={(event) => onCategoriaChange(event.target.value)}
            disabled={docType === 'CPF'}
            style={{ flex: 1 }}
          >
            {availableCategories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={onOpenCategoryModal}
            disabled={docType === 'CPF'}
            style={{
              backgroundColor: 'rgba(197, 146, 53, 0.08)',
              border: '1px solid var(--color-gold-primary)',
              color: 'var(--color-gold-dark)',
              borderRadius: '6px',
              width: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: docType === 'CPF' ? 'not-allowed' : 'pointer',
              fontSize: '1.2rem',
              fontWeight: 'bold',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
            title="Criar nova categoria de cliente"
          >
            +
          </button>
        </div>
      </div>
      )}

      <div className="input-container field-col-6">
        <label>IE / IM</label>
        <input
          type="text"
          className="input-style"
          placeholder={showDetailedPlaceholders ? 'Inscrição Estadual ou Municipal' : undefined}
          value={ieIm}
          onChange={(event) => onIeImChange(event.target.value)}
        />
      </div>
    </div>
  </div>
);
