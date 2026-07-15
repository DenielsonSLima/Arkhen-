import React from 'react';
import { AlertTriangle, Landmark, ReceiptText, ShieldCheck, Webhook, Wifi } from 'lucide-react';
import { getBankGateway } from '../gateway/bankGateway';
import type { BankIntegrationSummary } from '../services/bankIntegrationService';

interface ActiveProviderSummaryProps {
  integration: BankIntegrationSummary | null;
  isLoading: boolean;
  onConfigure: () => void;
}

const environmentLabel = { producao: 'Produção', homologacao: 'Homologação' } as const;

export const ActiveProviderSummary: React.FC<ActiveProviderSummaryProps> = ({ integration, isLoading, onConfigure }) => {
  if (isLoading) return <div className="sub-loading">Carregando integração bancária...</div>;
  if (!integration) return <div className="bank-empty">Nenhum provedor bancário foi encontrado.</div>;

  const gateway = getBankGateway(integration.provider);
  const statusLabel = integration.status === 'em_validacao'
    ? 'Em validação'
    : integration.status === 'erro'
      ? 'Com erro'
      : integration.configured ? 'Configurado' : 'Pendente';
  const isReady = integration.status === 'configurado';

  return (
    <div className="bank-summary">
      <div className="bank-summary__grid">
        <article className="bank-metric bank-metric--provider">
          <div className="bank-metric__header">
            <span className={`bank-logo bank-logo--${gateway.id}`}><img src={gateway.logo} alt={`Logo ${gateway.name}`} /></span>
            <span className={`bank-status bank-status--${integration.status}`}>{statusLabel}</span>
          </div>
          <small>Banco padrão</small>
          <strong>{gateway.name}</strong>
          <p>{gateway.tagline}</p>
        </article>
        <article className="bank-metric">
          <span className="bank-metric__icon"><Landmark size={18} /></span>
          <small>Ambiente atual</small>
          <strong>{environmentLabel[integration.environment]}</strong>
        </article>
        <article className="bank-metric">
          <span className="bank-metric__icon"><ShieldCheck size={18} /></span>
          <small>Status de segurança</small>
          <strong>{integration.status === 'em_validacao' ? 'Em validação' : integration.status === 'erro' ? 'Requer atenção' : integration.configured ? 'Credenciais protegidas' : 'Configuração pendente'}</strong>
        </article>
        <article className="bank-metric">
          <span className={`bank-metric__icon ${isReady ? 'is-ready' : 'is-warning'}`}>
            {isReady ? <Wifi size={18} /> : <AlertTriangle size={18} />}
          </span>
          <small>Funcionamento</small>
          <strong>{isReady ? 'Pronto' : integration.status === 'erro' ? 'Conexão com erro' : integration.status === 'em_validacao' ? 'Aguardando validação' : 'Aguardando credenciais'}</strong>
        </article>
      </div>

      <div className="bank-summary__details">
        <article className="bank-detail-card">
          <Webhook size={19} />
          <div><strong>Integração isolada</strong><p>Segredos permanecem no servidor e não são devolvidos ao navegador.</p></div>
        </article>
        <article className="bank-detail-card">
          <ReceiptText size={19} />
          <div><strong>Módulos habilitados</strong><p>{integration.enabledModules.length ? integration.enabledModules.join(', ') : 'Configure os recursos deste provedor.'}</p></div>
        </article>
        <button type="button" className="btn-save-settings" onClick={onConfigure}>Configurar {gateway.name}</button>
      </div>
    </div>
  );
};
