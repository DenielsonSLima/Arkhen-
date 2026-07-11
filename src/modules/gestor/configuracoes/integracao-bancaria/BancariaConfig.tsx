import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, CreditCard, ExternalLink, Landmark, ShieldCheck } from 'lucide-react';
import { bankGateways, getBankGateway, type BankEnvironment, type BankGatewayId } from './gateway/bankGateway';
import { useAsaasIntegration } from './asaas/hooks/useAsaasIntegration';
import { AsaasEnvironmentForm } from './asaas/components/AsaasEnvironmentForm';
import { AsaasModulesPanel } from './asaas/components/AsaasModulesPanel';

type BancariaTab = 'resumo' | 'bancos';

const environmentLabel: Record<BankEnvironment, string> = {
  producao: 'Produção',
  homologacao: 'Homologação',
};

export const BancariaConfig: React.FC = () => {
  const [activeTab, setActiveTab] = useState<BancariaTab>('resumo');
  const [selectedGatewayId, setSelectedGatewayId] = useState<BankGatewayId | null>(null);
  const gateway = selectedGatewayId ? getBankGateway(selectedGatewayId) : null;
  const asaas = useAsaasIntegration();
  const activeAsaasConfig = asaas.activeConfig;

  const renderSummary = () => {
    const configuredEnvironments = asaas.config
      ? Object.values(asaas.config.environments).filter((item) => item.apiKey).length
      : 0;

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        {[
          ['Gateways cadastrados', String(bankGateways.length)],
          ['Ambientes configurados', String(configuredEnvironments)],
          ['Gateway ativo', gateway?.name || 'Asaas'],
          ['Webhook', activeAsaasConfig?.webhookToken ? 'Validado' : 'Pendente'],
        ].map(([label, value]) => (
          <div key={label} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', background: '#ffffff' }}>
            <span style={{ display: 'block', color: '#64748b', fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase' }}>{label}</span>
            <strong style={{ display: 'block', color: '#0f172a', fontSize: '1.35rem', marginTop: '6px' }}>{value}</strong>
          </div>
        ))}
      </div>
    );
  };

  const renderBanks = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
      {bankGateways.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setSelectedGatewayId(item.id)}
          style={{
            border: '1px solid #dbe3ee',
            background: '#ffffff',
            borderRadius: '12px',
            padding: '18px',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#003b71', borderRadius: '8px', padding: '8px 10px', minWidth: '124px' }}>
              <img src={item.logo} alt={`Logo ${item.name}`} style={{ width: '100px', height: '17px', objectFit: 'contain' }} />
            </span>
            <span style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', borderRadius: '999px', padding: '4px 8px', fontSize: '0.7rem', fontWeight: 800 }}>
              Disponível
            </span>
          </div>
          <div>
            <strong style={{ display: 'block', color: '#0f172a', fontSize: '1rem' }}>{item.name}</strong>
            <span style={{ display: 'block', color: '#64748b', fontSize: '0.8rem', marginTop: '4px' }}>{item.tagline}</span>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#c59235', fontWeight: 850, fontSize: '0.78rem' }}>
            Configurar <ExternalLink size={13} />
          </span>
        </button>
      ))}
    </div>
  );

  if (gateway?.id === 'asaas') {
    return (
      <div className="submodule-content-card">
        <button type="button" className="btn-back-to-grid" onClick={() => setSelectedGatewayId(null)} style={{ marginBottom: '16px' }}>
          <ArrowLeft size={16} /> Voltar para bancos
        </button>

        <div className="submodule-card-header flex-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#003b71', borderRadius: '10px', padding: '10px 12px' }}>
              <img src={gateway.logo} alt="Logo Asaas" style={{ width: '100px', height: '17px', objectFit: 'contain' }} />
            </span>
            <div>
              <h2>Asaas</h2>
              <p>Produção, homologação, checkout, Pix, boleto e webhooks.</p>
            </div>
          </div>
          <ShieldCheck size={28} className="gold-text" />
        </div>

        {asaas.isLoading || !asaas.config || !activeAsaasConfig ? (
          <div className="sub-loading">Carregando integração Asaas...</div>
        ) : (
          <form onSubmit={asaas.handleSave} className="config-form">
            {asaas.isSaved && (
              <div className="success-banner">
                <CheckCircle2 size={16} style={{ marginRight: '8px', verticalAlign: 'middle', display: 'inline' }} />
                Integração Asaas atualizada com sucesso.
              </div>
            )}

            <div className="tab-buttons-header" style={{ marginBottom: '18px' }}>
              {gateway.environments.map((environment) => (
                <button
                  key={environment}
                  type="button"
                  className={`btn-tab ${asaas.activeEnvironment === environment ? 'active' : ''}`}
                  onClick={() => asaas.setActiveEnvironment(environment)}
                >
                  <Landmark size={15} />
                  <span>{environmentLabel[environment]}</span>
                </button>
              ))}
            </div>

            <AsaasEnvironmentForm
              environment={asaas.activeEnvironment}
              config={activeAsaasConfig}
              isSaving={asaas.isSaving}
              onChange={(field, value) => asaas.updateEnvironmentConfig(asaas.activeEnvironment, field, value)}
            />

            <div className="form-divider-title">Módulos Internos do Asaas</div>
            <AsaasModulesPanel gateway={gateway} config={activeAsaasConfig} />

            <div className="sidebar-warning-box info" style={{ marginTop: '18px' }}>
              <CreditCard size={18} style={{ color: '#2563eb', minWidth: '18px', marginTop: '2px' }} />
              <span className="sidebar-warning-text" style={{ color: '#1e3a8a' }}>
                Produção usa <strong>https://api.asaas.com/v3</strong>; homologação usa <strong>https://api-sandbox.asaas.com/v3</strong>. Webhooks devem validar o header <strong>asaas-access-token</strong> e processar eventos com idempotência.
              </span>
            </div>

            <div className="form-actions-row">
              <button type="submit" className="btn-save-settings" disabled={asaas.isSaving}>
                {asaas.isSaving ? 'Salvando...' : 'Salvar Asaas'}
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="submodule-content-card">
      <div className="submodule-card-header flex-header">
        <div>
          <h2>Integração Bancária</h2>
          <p>Configure gateways financeiros por banco, ambiente e módulo operacional.</p>
        </div>
        <CreditCard size={28} className="gold-text" />
      </div>

      <div className="tab-buttons-header" style={{ marginBottom: '18px' }}>
        <button type="button" className={`btn-tab ${activeTab === 'resumo' ? 'active' : ''}`} onClick={() => setActiveTab('resumo')}>
          <ShieldCheck size={15} />
          <span>Resumo</span>
        </button>
        <button type="button" className={`btn-tab ${activeTab === 'bancos' ? 'active' : ''}`} onClick={() => setActiveTab('bancos')}>
          <Landmark size={15} />
          <span>Bancos</span>
        </button>
      </div>

      {activeTab === 'resumo' ? renderSummary() : renderBanks()}
    </div>
  );
};
