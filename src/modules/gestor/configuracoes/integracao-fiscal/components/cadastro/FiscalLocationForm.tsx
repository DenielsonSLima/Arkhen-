import React from 'react';
import type { FiscalPrefeituraProfile } from '../../services/fiscalIntegrationService';
import type { Company } from '../../../../gestao-empresarial/services/gestaoEmpresarialService';

interface FiscalLocationFormProps {
  companies: Company[];
  selectedCompanyId: string;
  selectedUf: string;
  selectedMunicipio: string;
  loading?: boolean;
  selectedProfile?: FiscalPrefeituraProfile | null;
  onOpenIntegration: () => void;
}

export const FiscalLocationForm: React.FC<FiscalLocationFormProps> = ({
  companies,
  selectedCompanyId,
  selectedUf,
  selectedMunicipio,
  loading,
  selectedProfile,
  onOpenIntegration,
}) => {
  const selectedCompanyName = companies.find((item) => item.id === selectedCompanyId)?.nome
    || companies.find((item) => item.id === selectedCompanyId)?.razaoSocial;
  const selectedCompany = companies.find((item) => item.id === selectedCompanyId);
  const empresaUf = selectedCompany?.uf || selectedUf || 'UF não informada';
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
          <label>Empresa emissora (contabilidade)</label>
          <div
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '10px 12px',
              color: 'var(--color-text-dark)',
              background: '#f8fafc',
              fontSize: '0.84rem',
            }}
          >
            {selectedCompanyName || 'Escritório (contabilidade)'}
          </div>
        </div>

        <div className="form-item-group">
          <label>CNPJ</label>
          <div className="fiscal-location-summary-value">{selectedCompany?.cnpj || '-'}</div>
        </div>

        <div className="form-item-group">
          <label>UF</label>
          <div className="fiscal-location-summary-value">{empresaUf}</div>
        </div>

        <div className="form-item-group">
          <label>Cidade (escritório)</label>
          <div className="fiscal-location-summary-value">{empresaCidade}</div>
        </div>

        <div className="form-item-group">
          <label>Município de emissão</label>
          <div className="fiscal-location-summary-value">{selectedMunicipio || '-'}</div>
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
        Aqui você define apenas o emitente da NFS-e e o município de emissão por configuração local.
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
