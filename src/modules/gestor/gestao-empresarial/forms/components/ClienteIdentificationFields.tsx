import React from 'react';
import { Loader2, Search } from 'lucide-react';
import { normalizeCatalogLabel } from '../../../shared/catalogLabel';
import type { CatalogoItem } from '../../../parametrizacao/services/catalogosService';
import type { DocumentType, RegimeCliente } from '../clienteFormModel';
import { CLIENTE_REGIMES, formatCNPJ, formatCPF } from '../clienteFormModel';
import {
  getSelectedPartnerCategoryValue,
  getUniqueCatalogOptions,
  getUniquePartnerCategoryOptions,
  type PartnerCategoryOption,
} from '../partnerClassificationOptions';

interface ClienteIdentificationFieldsProps {
  docType: DocumentType;
  cnpj: string;
  cpf: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnae: string;
  tipo: RegimeCliente;
  tipoParceiroId: string;
  tipoEmpresaId: string;
  naturezaJuridicaId: string;
  categoria: string;
  ieIm: string;
  partnerTypes: CatalogoItem[];
  companyTypes: CatalogoItem[];
  legalNatures: CatalogoItem[];
  partnerCategories: PartnerCategoryOption[];
  isClienteContabilPartner: boolean;
  isClassificationsLoading: boolean;
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
  onTipoEmpresaChange: (value: string) => void;
  onNaturezaJuridicaChange: (value: string) => void;
  onCategoriaChange: (value: string) => void;
  onIeImChange: (value: string) => void;
  onLookup: () => void;
  onOpenCategoryModal: () => void;
}

const ClassificationSelect = ({
  value,
  options,
  placeholder,
  onChange,
  disabled,
}: {
  value: string;
  options: CatalogoItem[];
  placeholder: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) => {
  const visibleOptions = getUniqueCatalogOptions(options, value);

  return (
  <select
    className="input-style"
    value={value}
    onChange={(event) => onChange(event.target.value)}
    disabled={disabled}
  >
    <option value="">{placeholder}</option>
    {visibleOptions.map((item) => (
      <option key={item.id} value={item.id}>{normalizeCatalogLabel(item.nome)}</option>
    ))}
  </select>
  );
};

export const ClienteIdentificationFields: React.FC<ClienteIdentificationFieldsProps> = ({
  docType,
  cnpj,
  cpf,
  razaoSocial,
  nomeFantasia,
  cnae,
  tipo,
  tipoParceiroId,
  tipoEmpresaId,
  naturezaJuridicaId,
  categoria,
  ieIm,
  partnerTypes,
  companyTypes,
  legalNatures,
  partnerCategories,
  isClienteContabilPartner,
  isClassificationsLoading,
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
  onTipoEmpresaChange,
  onNaturezaJuridicaChange,
  onCategoriaChange,
  onIeImChange,
  onLookup,
  onOpenCategoryModal,
}) => {
  const classificationsPlaceholder = isClassificationsLoading
    ? 'Carregando opções...'
    : 'Selecione uma opção';
  const categoryOptions = getUniquePartnerCategoryOptions(partnerCategories, categoria);
  const selectedCategoryValue = getSelectedPartnerCategoryValue(categoryOptions, categoria);

  return (
    <div className="form-fields-section">
      <h4 className="form-fields-section-title">Identificação e classificação</h4>
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
          <label>Regime tributário</label>
          <select
            className="input-style"
            value={tipo}
            onChange={(event) => onTipoChange(event.target.value as RegimeCliente)}
            disabled={docType === 'CPF' || isDisabled}
          >
            {CLIENTE_REGIMES.map((regime) => (
              <option key={regime} value={regime}>{normalizeCatalogLabel(regime)}</option>
            ))}
          </select>
        </div>

        <div className="input-container field-col-6">
          <label>{docType === 'CNPJ' ? 'Razão social *' : 'Nome completo *'}</label>
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
          <label>{docType === 'CNPJ' ? 'Nome fantasia *' : 'Apelido *'}</label>
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
          <label>Tipo de parceiro *</label>
          <ClassificationSelect
            value={tipoParceiroId}
            options={partnerTypes}
            placeholder={classificationsPlaceholder}
            onChange={onTipoParceiroChange}
            disabled={isClassificationsLoading || isDisabled}
          />
        </div>

        <div className="input-container field-col-6">
          <label>Tipo de empresa {docType === 'CNPJ' ? '*' : ''}</label>
          <ClassificationSelect
            value={tipoEmpresaId}
            options={companyTypes}
            placeholder={classificationsPlaceholder}
            onChange={onTipoEmpresaChange}
            disabled={isClassificationsLoading || isDisabled || docType === 'CPF'}
          />
        </div>

        <div className="input-container field-col-6">
          <label>Natureza jurídica {docType === 'CNPJ' ? '*' : ''}</label>
          {docType === 'CNPJ' ? (
            <ClassificationSelect
              value={naturezaJuridicaId}
              options={legalNatures}
              placeholder={classificationsPlaceholder}
              onChange={onNaturezaJuridicaChange}
              disabled={isClassificationsLoading || isDisabled}
            />
          ) : (
            <input className="input-style" value="Não se aplica a pessoa física" disabled />
          )}
        </div>

        {isClienteContabilPartner && (
          <div className="input-container field-col-6">
            <label>Categoria do cliente *</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <select
                aria-label="Categoria do cliente"
                className="input-style"
                value={selectedCategoryValue}
                onChange={(event) => onCategoriaChange(event.target.value)}
                disabled={isDisabled}
                style={{ flex: 1 }}
              >
                <option value="">Selecione uma categoria ativa</option>
                {categoryOptions.map((item) => (
                  <option key={item.id} value={item.nome}>{normalizeCatalogLabel(item.nome)}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={onOpenCategoryModal}
                disabled={isDisabled}
                style={{
                  backgroundColor: 'rgba(197, 146, 53, 0.08)',
                  border: '1px solid var(--color-gold-primary)',
                  color: 'var(--color-gold-dark)',
                  borderRadius: '6px',
                  width: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
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
};
