import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, CreditCard, ExternalLink, Landmark, ShieldCheck, Webhook, Wifi, AlertTriangle, QrCode, ReceiptText, ShoppingCart } from 'lucide-react';
import { bankGateways, getBankGateway, type BankEnvironment, type BankGatewayId } from './gateway/bankGateway';
import { useAsaasIntegration } from './asaas/hooks/useAsaasIntegration';
import { AsaasEnvironmentForm } from './asaas/components/AsaasEnvironmentForm';
import { AsaasModulesPanel } from './asaas/components/AsaasModulesPanel';
import { hasAsaasApiKey, hasAsaasWebhookToken } from './asaas/services/asaasService';

type BancariaTab = 'resumo' | 'bancos';

const environmentLabel: Record<BankEnvironment, string> = {
  producao: 'Produção',
  homologacao: 'Homologação',
};

export const BancariaConfig: React.FC = () => {
  const [activeTab, setActiveTab] = useState<BancariaTab>('resumo');
  const [selectedGatewayId, setSelectedGatewayId] = useState<BankGatewayId | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const gateway = selectedGatewayId ? getBankGateway(selectedGatewayId) : null;
  const asaas = useAsaasIntegration();
  const activeAsaasConfig = asaas.activeConfig;

  useEffect(() => {
    if (!asaas.isSaved) return;
    setToastMessage('Integração Asaas atualizada com sucesso.');
    const timer = window.setTimeout(() => setToastMessage(''), 3200);
    return () => window.clearTimeout(timer);
  }, [asaas.isSaved]);

  const renderSummary = () => {
    const activeGateway = getBankGateway('asaas');
    const activeEnvironment = asaas.config?.activeEnvironment || 'homologacao';
    const activeConfig = asaas.config?.environments[activeEnvironment] || null;
    const configuredEnvironments = asaas.config
      ? Object.values(asaas.config.environments).filter((item) => hasAsaasApiKey(item)).length
      : 0;
    const hasApiKey = hasAsaasApiKey(activeConfig);
    const hasWebhook = Boolean(activeConfig?.webhookUrl && hasAsaasWebhookToken(activeConfig));
    const enabledModules = [
      activeConfig?.aceitaPix ? 'Pix' : null,
      activeConfig?.aceitaBoleto ? 'Boleto' : null,
      activeConfig?.aceitaCartao ? 'Cartão' : null,
      activeConfig?.checkoutAtivo ? 'Checkout' : null,
    ].filter(Boolean);
    const statusLabel = hasApiKey ? 'Configurado' : 'Pendente';
    const statusColor = hasApiKey ? '#166534' : '#b45309';
    const statusBg = hasApiKey ? '#f0fdf4' : '#fffbeb';
    const environmentColor = activeEnvironment === 'producao' ? '#b91c1c' : '#1d4ed8';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1.2fr) repeat(3, minmax(180px, 1fr))', gap: '14px', alignItems: 'stretch' }}>
          <div style={{ border: '1px solid #dbe3ee', borderRadius: '12px', padding: '18px', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#003b71', borderRadius: '10px', padding: '10px 12px' }}>
                <img src={activeGateway.logo} alt={`Logo ${activeGateway.name}`} style={{ width: '100px', height: '17px', objectFit: 'contain' }} />
              </span>
              <span style={{ border: `1px solid ${hasApiKey ? '#bbf7d0' : '#fde68a'}`, background: statusBg, color: statusColor, borderRadius: '999px', padding: '5px 9px', fontSize: '0.72rem', fontWeight: 850 }}>
                {statusLabel}
              </span>
            </div>
            <div>
              <span style={{ display: 'block', color: '#64748b', fontSize: '0.72rem', fontWeight: 850, textTransform: 'uppercase' }}>Gateway Ativo</span>
              <strong style={{ display: 'block', color: '#0f172a', fontSize: '1.45rem', marginTop: '4px' }}>{activeGateway.name}</strong>
              <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: '0.82rem', lineHeight: 1.45 }}>{activeGateway.tagline}</p>
            </div>
          </div>

          {[
            { label: 'Ambiente atual', value: environmentLabel[activeEnvironment], icon: <Landmark size={18} />, color: environmentColor },
            { label: 'Ambientes configurados', value: `${configuredEnvironments}/2`, icon: <ShieldCheck size={18} />, color: '#0f172a' },
            { label: 'Funcionamento', value: hasApiKey ? 'Pronto' : 'Aguardando chave', icon: hasApiKey ? <Wifi size={18} /> : <AlertTriangle size={18} />, color: hasApiKey ? '#166534' : '#b45309' },
          ].map((item) => (
            <div key={item.label} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#ffffff' }}>
              <span style={{ width: '34px', height: '34px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '9px', background: '#f8fafc', color: item.color, marginBottom: '12px' }}>{item.icon}</span>
              <span style={{ display: 'block', color: '#64748b', fontSize: '0.72rem', fontWeight: 850, textTransform: 'uppercase' }}>{item.label}</span>
              <strong style={{ display: 'block', color: item.color, fontSize: '1.18rem', marginTop: '5px' }}>{item.value}</strong>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px' }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ width: '34px', height: '34px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '9px', background: hasWebhook ? '#ecfdf5' : '#fff7ed', color: hasWebhook ? '#059669' : '#ea580c' }}>
                <Webhook size={18} />
              </span>
              <div>
                <strong style={{ display: 'block', color: '#0f172a' }}>Webhooks</strong>
                <span style={{ color: hasWebhook ? '#166534' : '#b45309', fontSize: '0.75rem', fontWeight: 800 }}>{hasWebhook ? 'Token e URL configurados' : 'Pendente de token/URL'}</span>
              </div>
            </div>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.78rem', lineHeight: 1.45 }}>
              {activeConfig?.webhookUrl || 'Configure a URL de callback do ambiente ativo.'}
            </p>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#ffffff' }}>
            <strong style={{ display: 'block', color: '#0f172a', marginBottom: '12px' }}>Módulos habilitados</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[
                { label: 'Pix', enabled: activeConfig?.aceitaPix, icon: <QrCode size={14} /> },
                { label: 'Boleto', enabled: activeConfig?.aceitaBoleto, icon: <ReceiptText size={14} /> },
                { label: 'Cartão', enabled: activeConfig?.aceitaCartao, icon: <CreditCard size={14} /> },
                { label: 'Checkout', enabled: activeConfig?.checkoutAtivo, icon: <ShoppingCart size={14} /> },
              ].map((item) => (
                <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: `1px solid ${item.enabled ? '#bfdbfe' : '#e2e8f0'}`, background: item.enabled ? '#eff6ff' : '#f8fafc', color: item.enabled ? '#1d4ed8' : '#94a3b8', borderRadius: '999px', padding: '6px 9px', fontSize: '0.74rem', fontWeight: 850 }}>
                  {item.icon}
                  {item.label}
                </span>
              ))}
            </div>
            <p style={{ margin: '12px 0 0 0', color: '#64748b', fontSize: '0.76rem' }}>
              {enabledModules.length > 0 ? `${enabledModules.length} recurso(s) ativo(s) no ambiente atual.` : 'Nenhum módulo habilitado.'}
            </p>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#ffffff' }}>
            <strong style={{ display: 'block', color: '#0f172a', marginBottom: '8px' }}>Base da API</strong>
            <code style={{ display: 'block', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', color: '#334155', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeEnvironment === 'producao' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3'}
            </code>
          </div>
        </div>
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
        {toastMessage && (
          <div style={{
            position: 'fixed',
            top: '24px',
            right: '28px',
            zIndex: 10000,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            minWidth: '320px',
            maxWidth: '420px',
            padding: '14px 16px',
            borderRadius: '10px',
            border: '1px solid #86efac',
            background: '#f0fdf4',
            color: '#166534',
            boxShadow: '0 18px 45px rgba(15, 23, 42, 0.18)',
            fontWeight: 850,
            fontSize: '0.86rem',
          }}>
            <CheckCircle2 size={18} />
            <span>{toastMessage}</span>
          </div>
        )}

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
