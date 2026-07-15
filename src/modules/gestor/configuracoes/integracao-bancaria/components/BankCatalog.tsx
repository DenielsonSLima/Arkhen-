import React from 'react';
import { Check, ExternalLink, Loader2 } from 'lucide-react';
import { bankGateways, type BankGatewayId } from '../gateway/bankGateway';
import type { BankIntegrationSummary } from '../services/bankIntegrationService';

interface BankCatalogProps {
  integrations: BankIntegrationSummary[];
  isSelecting: boolean;
  onConfigure: (provider: BankGatewayId) => void;
  onSelect: (provider: BankGatewayId) => void;
}

export const BankCatalog: React.FC<BankCatalogProps> = ({
  integrations,
  isSelecting,
  onConfigure,
  onSelect,
}) => (
  <div className="bank-catalog">
    {bankGateways.map((gateway) => {
      const integration = integrations.find((item) => item.provider === gateway.id);
      const isSelected = Boolean(integration?.selected);
      const canSelect = integration?.status === 'configurado';
      const statusLabel = integration?.status === 'em_validacao'
        ? 'Em validação'
        : integration?.status === 'erro'
          ? 'Com erro'
          : integration?.configured ? 'Configurado' : 'Disponível';
      return (
        <article key={gateway.id} className={`bank-card ${isSelected ? 'bank-card--selected' : ''}`}>
          <div className="bank-card__topline">
            <span className={`bank-logo bank-logo--${gateway.id}`}>
              <img src={gateway.logo} alt={`Logo ${gateway.name}`} />
            </span>
            <span className={`bank-status bank-status--${integration?.status || 'pendente'}`}>
              {statusLabel}
            </span>
          </div>

          <div className="bank-card__body">
            <div>
              <strong>{gateway.name}</strong>
              <p>{gateway.tagline}</p>
            </div>
            {isSelected && <span className="bank-card__default"><Check size={14} /> Banco padrão</span>}
          </div>

          <div className="bank-card__actions">
            <button type="button" className="bank-link-button" onClick={() => onConfigure(gateway.id)}>
              Configurar <ExternalLink size={14} />
            </button>
            <button
              type="button"
              className="bank-secondary-button"
              disabled={isSelected || isSelecting || !canSelect}
              onClick={() => onSelect(gateway.id)}
            >
              {isSelecting && !isSelected ? <Loader2 size={14} className="bank-spin" /> : <Check size={14} />}
              {isSelected ? 'Selecionado' : canSelect ? 'Usar como padrão' : 'Valide a conexão'}
            </button>
          </div>
        </article>
      );
    })}
  </div>
);
