import React from 'react';
import type { Company } from '../services/gestaoEmpresarialService';
import { normalizeCatalogLabel } from '../../shared/catalogLabel';
import { PartnerClassificationSummary } from './PartnerClassificationSummary';
import { getEffectiveTaxRegime } from '../services/taxRegime';
import { CnpjLookupSupplement } from './CnpjLookupSupplement';

interface ClienteDetailDataProps {
  company: Company;
  displayDocumentLabel: 'CPF' | 'CNPJ';
  isAccountingClient: boolean;
}

const formatCurrency = (value?: number) => (
  value === undefined
    ? '-'
    : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
);

export const ClienteDetailData: React.FC<ClienteDetailDataProps> = ({
  company,
  displayDocumentLabel,
  isAccountingClient,
}) => (
  <div className="details-blocks-layout">
    <section className="detail-card-section">
      <div className="section-title-row">
        <h4>Dados Fiscais & Contábeis</h4>
      </div>
      <div className="details-grid-layout">
        <div className="detail-field-box">
          <label>{displayDocumentLabel}</label>
          <p>{company.cnpj || '-'}</p>
        </div>
        <div className="detail-field-box">
          <label>Razão Social</label>
          <p>{company.razaoSocial || '-'}</p>
        </div>
        <div className="detail-field-box">
          <label>Nome Fantasia / Apelido</label>
          <p>{company.nome || '-'}</p>
        </div>
        <div className="detail-field-box">
          <label>CNAE</label>
          <p>{company.cnae || '-'}</p>
        </div>
        {displayDocumentLabel === 'CNPJ' && (
          <div className="detail-field-box">
            <label>Descrição do CNAE</label>
            <p>{company.cnaeDescricao || '-'}</p>
          </div>
        )}
        <div className="detail-field-box">
          <label>Regime de Tributação</label>
          <p>{normalizeCatalogLabel(getEffectiveTaxRegime(company.tipo)) || '-'}</p>
        </div>
        <PartnerClassificationSummary
          company={company}
          showClientCategory={isAccountingClient}
        />
        <div className="detail-field-box">
          <label>Inscrição Estadual / IM</label>
          <p>{company.inscricaoEstadual || '-'}</p>
        </div>
        {displayDocumentLabel === 'CNPJ' && (
          <div className="detail-field-box">
            <label>Capital social</label>
            <p>{formatCurrency(company.capitalSocial)}</p>
          </div>
        )}
      </div>
    </section>

    {displayDocumentLabel === 'CNPJ' && (
      <CnpjLookupSupplement snapshot={company.cnpjLookupSnapshot} />
    )}

    <section className="detail-card-section">
      <div className="section-title-row">
        <h4>Informações de Contato</h4>
      </div>
      <div className="details-grid-layout">
        <div className="detail-field-box">
          <label>Contato Responsável</label>
          <p>{company.contato || '-'}</p>
        </div>
        <div className="detail-field-box">
          <label>Telefone</label>
          <p>{company.telefone || '-'}</p>
        </div>
        <div className="detail-field-box">
          <label>E-mail Corporativo</label>
          <p>{company.email || '-'}</p>
        </div>
      </div>
    </section>

    <section className="detail-card-section">
      <div className="section-title-row">
        <h4>Localização & Endereço</h4>
      </div>
      <div className="details-grid-layout">
        <div className="detail-field-box">
          <label>CEP</label>
          <p>{company.cep || '-'}</p>
        </div>
        <div className="detail-field-box">
          <label>Endereço</label>
          <p>{company.endereco || '-'}</p>
        </div>
        <div className="detail-field-box">
          <label>Bairro</label>
          <p>{company.bairro || '-'}</p>
        </div>
        <div className="detail-field-box">
          <label>Cidade</label>
          <p>{company.cidade || '-'}</p>
        </div>
        <div className="detail-field-box">
          <label>UF</label>
          <p>{company.uf || '-'}</p>
        </div>
      </div>
    </section>
  </div>
);
