import React from 'react';
import { ArrowLeft, CreditCard, Landmark, ShieldCheck } from 'lucide-react';
import { type BankEnvironment, getBankGateway } from '../../gateway/bankGateway';
import { useAsaasIntegration } from '../hooks/useAsaasIntegration';
import { AsaasEnvironmentForm } from './AsaasEnvironmentForm';
import { AsaasModulesPanel } from './AsaasModulesPanel';

interface AsaasConfigPageProps {
  onBack: () => void;
}

const environmentLabel: Record<BankEnvironment, string> = {
  producao: 'Produção',
  homologacao: 'Homologação',
};

export const AsaasConfigPage: React.FC<AsaasConfigPageProps> = ({ onBack }) => {
  const gateway = getBankGateway('asaas');
  const asaas = useAsaasIntegration();

  return (
    <div className="submodule-content-card">
      <button type="button" className="btn-back-to-grid" onClick={onBack} style={{ marginBottom: '16px' }}>
        <ArrowLeft size={16} /> Voltar para bancos
      </button>

      <div className="submodule-card-header flex-header">
        <div className="bank-provider-heading">
          <span className="bank-logo bank-logo--asaas">
            <img src={gateway.logo} alt="Logo Asaas" />
          </span>
          <div>
            <h2>Asaas</h2>
            <p>Produção, homologação, checkout, Pix, boleto e webhooks.</p>
          </div>
        </div>
        <ShieldCheck size={28} className="gold-text" />
      </div>

      {asaas.isLoading || !asaas.config || !asaas.activeConfig ? (
        <div className="sub-loading">Carregando integração Asaas...</div>
      ) : (
        <form onSubmit={asaas.handleSave} className="config-form">
          <div className="tab-buttons-header bank-environment-tabs">
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

          {asaas.isSaved && <div className="bank-feedback bank-feedback--success">Integração Asaas atualizada com sucesso.</div>}
          {asaas.saveError && (
            <div className="bank-feedback bank-feedback--error">
              Não foi possível salvar a integração Asaas. Revise as credenciais e tente novamente.
            </div>
          )}

          <AsaasEnvironmentForm
            environment={asaas.activeEnvironment}
            config={asaas.activeConfig}
            isSaving={asaas.isSaving}
            onChange={(field, value) => asaas.updateEnvironmentConfig(asaas.activeEnvironment, field, value)}
            onPatch={(changes) => asaas.updateEnvironmentConfigPatch(asaas.activeEnvironment, changes)}
          />

          <div className="form-divider-title">Módulos internos do Asaas</div>
          <AsaasModulesPanel gateway={gateway} config={asaas.activeConfig} />

          <div className="bank-info-box">
            <CreditCard size={18} />
            <span>
              Produção usa <strong>https://api.asaas.com/v3</strong>; homologação usa <strong>https://api-sandbox.asaas.com/v3</strong>.
              Webhooks validam o header <strong>asaas-access-token</strong> e processam eventos com idempotência.
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
};
