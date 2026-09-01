import React from 'react';
import { normalizeCatalogLabel } from '../../shared/catalogLabel';
import type { Company } from '../services/gestaoEmpresarialService';
import { usePartnerClassifications } from '../hooks/usePartnerClassifications';

interface PartnerClassificationSummaryProps {
  company: Company;
  showClientCategory: boolean;
}

const getItemName = (items: Array<{ id: string; nome: string }>, id?: string) => (
  normalizeCatalogLabel(items.find((item) => item.id === id)?.nome) || '-'
);

export const PartnerClassificationSummary: React.FC<PartnerClassificationSummaryProps> = ({
  company,
  showClientCategory,
}) => {
  const { partnerTypes, companyTypes, legalNatures, isLoading } = usePartnerClassifications();
  const pendingValue = isLoading ? 'Carregando...' : '-';

  return (
    <>
      <div className="detail-field-box">
        <label>Tipo de parceiro</label>
        <p>{company.tipoParceiroId ? getItemName(partnerTypes, company.tipoParceiroId) : pendingValue}</p>
      </div>
      <div className="detail-field-box">
        <label>Tipo de empresa</label>
        <p>{company.tipoEmpresaId ? getItemName(companyTypes, company.tipoEmpresaId) : pendingValue}</p>
      </div>
      <div className="detail-field-box">
        <label>Natureza jurídica</label>
        <p>{company.naturezaJuridicaId ? getItemName(legalNatures, company.naturezaJuridicaId) : pendingValue}</p>
      </div>
      {showClientCategory && (
        <div className="detail-field-box">
          <label>Categoria do cliente</label>
          <p>{normalizeCatalogLabel(company.categoriaCliente || 'Sem categoria')}</p>
        </div>
      )}
    </>
  );
};
