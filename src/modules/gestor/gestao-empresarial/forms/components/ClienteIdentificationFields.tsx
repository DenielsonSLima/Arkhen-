import React from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
import { normalizeCatalogLabel } from '../../../shared/catalogLabel';
import type { CatalogoItem } from '../../../parametrizacao/services/catalogosService';
import type { DocumentType, QuickCreateTarget, RegimeClienteForm } from '../clienteFormModel';
import {
  CLIENTE_REGIMES,
  formatCNPJ,
  formatCPF,
  isPessoaFisicaCompanyType,
} from '../clienteFormModel';
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
  cnaeDescricao: string;
  capitalSocial: string;
  tipo: RegimeClienteForm;
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
  onCnaeDescricaoChange: (value: string) => void;
  onCapitalSocialChange: (value: string) => void;
  onTipoChange: (value: RegimeClienteForm) => void;
  onTipoParceiroChange: (value: string) => void;
  onTipoEmpresaChange: (value: string) => void;
  onNaturezaJuridicaChange: (value: string) => void;
  onCategoriaChange: (value: string) => void;
  onIeImChange: (value: string) => void;
  onLookup: () => void;
  onOpenQuickCreate: (target: QuickCreateTarget) => void;
}

const ClassificationSelect = ({
  id,
  value,
  options,
  placeholder,
  ariaLabel,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  options: CatalogoItem[];
  placeholder: string;
  ariaLabel: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) => {
  const visibleOptions = getUniqueCatalogOptions(options, value);

  return (
  <select
    id={id}
    aria-label={ariaLabel}
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

const QuickCreateButton = ({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    className="catalog-quick-create-btn"
    aria-label={label}
    title={label}
    disabled={disabled}
    onClick={onClick}
  >
    <Plus size={17} aria-hidden="true" />
  </button>
);

export const ClienteIdentificationFields: React.FC<ClienteIdentificationFieldsProps> = ({
  docType,
  cnpj,
  cpf,
  razaoSocial,
  nomeFantasia,
  cnae,
  cnaeDescricao,
  capitalSocial,
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
  onCnaeDescricaoChange,
  onCapitalSocialChange,
  onTipoChange,
  onTipoParceiroChange,
  onTipoEmpresaChange,
  onNaturezaJuridicaChange,
  onCategoriaChange,
  onIeImChange,
  onLookup,
  onOpenQuickCreate,
}) => {
  const classificationsPlaceholder = isClassificationsLoading
    ? 'Carregando opções...'
    : 'Selecione uma opção';
  const categoryOptions = getUniquePartnerCategoryOptions(partnerCategories, categoria);
  const selectedCategoryValue = getSelectedPartnerCategoryValue(categoryOptions, categoria);
  const visibleCompanyTypes = docType === 'CNPJ'
    ? companyTypes.filter((item) => !isPessoaFisicaCompanyType(item))
    : companyTypes;

  return (
    <div className="form-fields-section">
      <h4 className="form-fields-section-title">Identificação e classificação</h4>
      <div className="fields-grid">
        <div className="input-container field-col-6">
          <label htmlFor={docType === 'CNPJ' ? 'cliente-cnpj' : 'cliente-cpf'}>{docType} *</label>
          {docType === 'CNPJ' ? (
            <div className="cnpj-search-wrapper">
              <input
                id="cliente-cnpj"
                name="cnpj"
                type="text"
                className="input-style"
                placeholder="00.000.000/0000-00"
                value={cnpj}
                disabled={isSearching || isDisabled}
                aria-busy={isSearching}
                onChange={(event) => onCnpjChange(formatCNPJ(event.target.value))}
              />
              <button
                type="button"
                className="cnpj-search-btn"
                onClick={onLookup}
                disabled={isSearching || isClassificationsLoading || isDisabled || !cnpj}
              >
                {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Buscar
              </button>
            </div>
          ) : (
            <input
              id="cliente-cpf"
              name="cpf"
              type="text"
              className="input-style"
              placeholder="000.000.000-00"
              value={cpf}
              disabled={isDisabled}
              onChange={(event) => onCpfChange(formatCPF(event.target.value))}
            />
          )}
        </div>

        <div className="input-container field-col-6">
          <label htmlFor="cliente-regime-tributario">Regime tributário</label>
          <select
            id="cliente-regime-tributario"
            name="regimeTributario"
            className="input-style"
            value={docType === 'CPF' ? 'PF' : (tipo === 'MEI' ? 'Simples Nacional' : tipo)}
            onChange={(event) => onTipoChange(event.target.value as RegimeClienteForm)}
            disabled={docType === 'CPF' || isDisabled}
          >
            {docType === 'CPF'
              ? <option value="PF">Pessoa física</option>
              : (
                <>
                  <option value="">Selecione o regime atual</option>
                  {CLIENTE_REGIMES.map((regime) => (
                    <option key={regime} value={regime}>{normalizeCatalogLabel(regime)}</option>
                  ))}
                </>
              )}
          </select>
        </div>

        <div className="input-container field-col-6">
          <label htmlFor="cliente-razao-social">
            {docType === 'CNPJ' ? 'Razão social *' : 'Nome completo *'}
          </label>
          <input
            id="cliente-razao-social"
            name="razaoSocial"
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
          <label htmlFor="cliente-nome-fantasia">
            {docType === 'CNPJ' ? 'Nome fantasia *' : 'Apelido *'}
          </label>
          <input
            id="cliente-nome-fantasia"
            name="nomeFantasia"
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
          <div className="input-container field-col-4">
            <label htmlFor="cliente-cnae">CNAE</label>
            <input
              id="cliente-cnae"
              name="cnae"
              type="text"
              className="input-style"
              placeholder="Ex: 62.01-5-01"
              value={cnae}
              onChange={(event) => onCnaeChange(event.target.value)}
            />
          </div>
        )}

        {docType === 'CNPJ' && (
          <div className="input-container field-col-8">
            <label htmlFor="cliente-cnae-descricao">Descrição do CNAE principal</label>
            <input
              id="cliente-cnae-descricao"
              name="cnaeDescricao"
              type="text"
              className="input-style"
              placeholder="Atividade econômica principal"
              value={cnaeDescricao}
              onChange={(event) => onCnaeDescricaoChange(event.target.value)}
            />
          </div>
        )}

        <div className="input-container field-col-6">
          <label htmlFor="cliente-tipo-parceiro">Tipo de parceiro *</label>
          <div className="catalog-select-row">
            <ClassificationSelect
              id="cliente-tipo-parceiro"
              ariaLabel="Tipo de parceiro"
              value={tipoParceiroId}
              options={partnerTypes}
              placeholder={classificationsPlaceholder}
              onChange={onTipoParceiroChange}
              disabled={isClassificationsLoading || isDisabled}
            />
            <QuickCreateButton
              label="Criar novo tipo de parceiro"
              disabled={isClassificationsLoading || isDisabled}
              onClick={() => onOpenQuickCreate('partnerType')}
            />
          </div>
        </div>

        <div className="input-container field-col-6">
          <label htmlFor="cliente-porte-enquadramento">
            Porte / enquadramento {docType === 'CNPJ' ? '*' : ''}
          </label>
          <div className="catalog-select-row">
            <ClassificationSelect
              id="cliente-porte-enquadramento"
              ariaLabel="Porte / enquadramento"
              value={tipoEmpresaId}
              options={visibleCompanyTypes}
              placeholder={classificationsPlaceholder}
              onChange={onTipoEmpresaChange}
              disabled={isClassificationsLoading || isDisabled || docType === 'CPF'}
            />
            <QuickCreateButton
              label="Criar novo enquadramento"
              disabled={isClassificationsLoading || isDisabled || docType === 'CPF'}
              onClick={() => onOpenQuickCreate('companyType')}
            />
          </div>
        </div>

        <div className="input-container field-col-6">
          <label htmlFor="cliente-natureza-juridica">
            Natureza jurídica {docType === 'CNPJ' ? '*' : ''}
          </label>
          {docType === 'CNPJ' ? (
            <div className="catalog-select-row">
              <ClassificationSelect
                id="cliente-natureza-juridica"
                ariaLabel="Natureza jurídica"
                value={naturezaJuridicaId}
                options={legalNatures}
                placeholder={classificationsPlaceholder}
                onChange={onNaturezaJuridicaChange}
                disabled={isClassificationsLoading || isDisabled}
              />
              <QuickCreateButton
                label="Criar nova natureza jurídica"
                disabled={isClassificationsLoading || isDisabled}
                onClick={() => onOpenQuickCreate('legalNature')}
              />
            </div>
          ) : (
            <input
              id="cliente-natureza-juridica"
              className="input-style"
              value="Não se aplica a pessoa física"
              disabled
            />
          )}
        </div>

        {isClienteContabilPartner && (
          <div className="input-container field-col-6">
            <label htmlFor="cliente-categoria">Categoria do cliente *</label>
            <div className="catalog-select-row">
              <select
                id="cliente-categoria"
                name="categoria"
                aria-label="Categoria do cliente"
                className="input-style"
                value={selectedCategoryValue}
                onChange={(event) => onCategoriaChange(event.target.value)}
                disabled={isDisabled}
              >
                <option value="">Selecione uma categoria ativa</option>
                {categoryOptions.map((item) => (
                  <option key={item.id} value={item.nome}>{normalizeCatalogLabel(item.nome)}</option>
                ))}
              </select>
              <QuickCreateButton
                label="Criar nova categoria de cliente"
                disabled={isDisabled}
                onClick={() => onOpenQuickCreate('category')}
              />
            </div>
          </div>
        )}

        <div className="input-container field-col-6">
          <label htmlFor="cliente-ie-im">IE / IM</label>
          <input
            id="cliente-ie-im"
            name="ieIm"
            type="text"
            className="input-style"
            placeholder={showDetailedPlaceholders ? 'Inscrição Estadual ou Municipal' : undefined}
            value={ieIm}
            onChange={(event) => onIeImChange(event.target.value)}
          />
        </div>

        {docType === 'CNPJ' && (
          <div className="input-container field-col-6">
            <label htmlFor="cliente-capital-social">Capital social</label>
            <input
              id="cliente-capital-social"
              name="capitalSocial"
              type="number"
              min="0"
              step="0.01"
              className="input-style"
              placeholder="0,00"
              value={capitalSocial}
              onChange={(event) => onCapitalSocialChange(event.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
