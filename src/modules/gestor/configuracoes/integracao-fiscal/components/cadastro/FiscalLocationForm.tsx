import React from 'react';
import type { FiscalPrefeituraProfile } from '../../services/fiscalIntegrationService';
import type { Company } from '../../../../gestao-empresarial/services/gestaoEmpresarialService';

interface FiscalLocationFormProps {
  companies: Company[];
  selectedCompanyId: string;
  selectedUf: string;
  selectedMunicipio: string;
  availableUfs: string[];
  availableMunicipios: string[];
  loading?: boolean;
  selectedProfile?: FiscalPrefeituraProfile | null;
  onSelectCompany: (companyId: string) => void;
  onSelectUf: (uf: string) => void;
  onSelectMunicipio: (municipio: string) => void;
  onOpenIntegration: () => void;
}

export const FiscalLocationForm: React.FC<FiscalLocationFormProps> = ({
  companies,
  selectedCompanyId,
  selectedUf,
  selectedMunicipio,
  availableUfs,
  availableMunicipios,
  loading,
  selectedProfile,
  onSelectCompany,
  onSelectUf,
  onSelectMunicipio,
  onOpenIntegration,
}) => {
  const selectedCompany = companies.find((item) => item.id === selectedCompanyId);
  const empresaCidade = selectedCompany?.cidade || selectedMunicipio || 'Cidade não informada';
  const operations = Array.isArray(selectedProfile?.operacoes) ? selectedProfile.operacoes : [];
  const operationSummary = operations.length > 0 ? operations.reduce(
    (acc, item) => {
      acc[item.categoria] = (acc[item.categoria] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  ) : null;

  const operationBadges = operationSummary
    ? [
        `Envio: ${operationSummary.envio || 0}`,
        `Cancelamento: ${operationSummary.cancelamento || 0}`,
        `Substituição: ${operationSummary.substituicao || 0}`,
        `Consulta: ${operationSummary.consulta || 0}`,
        `Download: ${operationSummary.download || 0}`,
      ]
    : [];

  return (
    <div className="fiscal-location-form">
      <div className="fiscal-location-grid">
        <div className="form-item-group">
          <label>Empresa emissora</label>
          <select
            value={selectedCompanyId}
            onChange={(e) => onSelectCompany(e.target.value)}
          >
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.nome || company.razaoSocial || 'Empresa sem nome'}
              </option>
            ))}
          </select>
        </div>

        <div className="form-item-group">
          <label>CNPJ</label>
          <div className="fiscal-location-summary-value">{selectedCompany?.cnpj || '-'}</div>
        </div>

        <div className="form-item-group">
          <label>UF</label>
          <select
            value={selectedUf}
            onChange={(e) => onSelectUf(e.target.value)}
          >
            {availableUfs.map((uf) => (
              <option key={uf} value={uf}>{uf}</option>
            ))}
          </select>
        </div>

        <div className="form-item-group">
          <label>Cidade (escritório)</label>
          <div className="fiscal-location-summary-value">{empresaCidade}</div>
        </div>

        <div className="form-item-group">
          <label>Município de emissão</label>
          <select
            value={selectedMunicipio}
            onChange={(e) => onSelectMunicipio(e.target.value)}
          >
            {availableMunicipios.map((municipio) => (
              <option key={municipio} value={municipio}>{municipio}</option>
            ))}
          </select>
        </div>

        <div className="form-item-group">
          <label>Selecionar contexto</label>
          <button
            type="button"
            onClick={onOpenIntegration}
            className="btn-save-settings"
            disabled={loading}
          >
            {loading ? 'Carregando...' : 'Abrir / Criar contexto'}
          </button>
        </div>
      </div>

      <p className="input-helper-text" style={{ marginTop: '2px' }}>
        Aqui você define o emitente da NFS-e e o município de emissão. Cada empresa mantém configuração e histórico separados no Supabase.
      </p>

      {selectedCompany && (
        <p className="input-helper-text" style={{ margin: '4px 0 0' }}>
          Resumo da empresa emissora: <strong>{selectedCompany.nome || selectedCompany.razaoSocial}</strong> · CNPJ <strong>{selectedCompany.cnpj}</strong> · {selectedCompany.cidade || 'Cidade não informada'} / {selectedCompany.uf || 'UF não informada'}.
        </p>
      )}

      <p className="input-helper-text" style={{ margin: '2px 0 0' }}>
        Se não houver contexto para este escritório + município, um novo registro será criado.
      </p>
      {selectedProfile ? (
        <>
          <p className="input-helper-text" style={{ margin: '4px 0 0' }}>
            Provedor do município: <strong>{selectedProfile.providerLabel}</strong> ·
            Homologação: <strong>{selectedProfile.ambientes?.homologacao?.url || 'Não informado'}</strong> ·
            Produção: <strong>{selectedProfile.ambientes?.producao?.url || 'Não informado'}</strong>.
          </p>
          <p className="input-helper-text" style={{ margin: '4px 0 0' }}>
            Operações disponíveis no catálogo: <strong>{operations.length}</strong> total ({operationBadges.join(' • ')})
          </p>
        </>
      ) : (
        <p className="input-helper-text" style={{ margin: '4px 0 0' }}>
          Município ainda sem roteamento pré-cadastrado. Ajuste manualmente no painel de ambiente.
        </p>
      )}
    </div>
  );
};
