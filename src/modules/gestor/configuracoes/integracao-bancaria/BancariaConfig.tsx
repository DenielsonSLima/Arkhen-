import React, { useState } from 'react';
import { CreditCard, Landmark, ShieldCheck } from 'lucide-react';
import { ActiveProviderSummary } from './components/ActiveProviderSummary';
import { BankCatalog } from './components/BankCatalog';
import type { BankGatewayId } from './gateway/bankGateway';
import { useBankIntegrations } from './hooks/useBankIntegrations';
import { InterConfigPage } from './inter/components/InterConfigPage';
import './BancariaConfig.css';

type BancariaTab = 'resumo' | 'bancos';

const errorMessage = (error: unknown) => (
  error instanceof Error && error.message
    ? error.message
    : 'Não foi possível atualizar a integração bancária.'
);

export const BancariaConfig: React.FC = () => {
  const [activeTab, setActiveTab] = useState<BancariaTab>('resumo');
  const [selectedProvider, setSelectedProvider] = useState<BankGatewayId | null>(null);
  const bankIntegrations = useBankIntegrations();

  const backToBanks = () => {
    setSelectedProvider(null);
    setActiveTab('bancos');
  };

  if (selectedProvider === 'inter') return <InterConfigPage onBack={backToBanks} />;

  return (
    <div className="submodule-content-card bancaria-config">
      <div className="submodule-card-header flex-header">
        <div>
          <h2>Integração Bancária</h2>
          <p>Configure o Banco Inter para emitir BolePix, Pix e conciliar recebimentos.</p>
        </div>
        <CreditCard size={28} className="gold-text" />
      </div>

      <div className="tab-buttons-header bancaria-main-tabs">
        <button type="button" className={`btn-tab ${activeTab === 'resumo' ? 'active' : ''}`} onClick={() => setActiveTab('resumo')}>
          <ShieldCheck size={15} /><span>Resumo</span>
        </button>
        <button type="button" className={`btn-tab ${activeTab === 'bancos' ? 'active' : ''}`} onClick={() => setActiveTab('bancos')}>
          <Landmark size={15} /><span>Bancos</span>
        </button>
      </div>

      {bankIntegrations.error && (
        <div className="bank-feedback bank-feedback--error">{errorMessage(bankIntegrations.error)}</div>
      )}

      {activeTab === 'resumo' ? (
        <ActiveProviderSummary
          integration={bankIntegrations.activeIntegration}
          isLoading={bankIntegrations.isLoading}
          onConfigure={() => bankIntegrations.activeIntegration && setSelectedProvider(bankIntegrations.activeIntegration.provider)}
        />
      ) : (
        <BankCatalog
          integrations={bankIntegrations.integrations}
          isSelecting={bankIntegrations.isSelecting}
          onConfigure={setSelectedProvider}
          onSelect={bankIntegrations.selectProvider}
        />
      )}
    </div>
  );
};
