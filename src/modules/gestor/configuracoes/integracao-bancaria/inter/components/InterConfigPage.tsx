import React, { useState, type FormEvent } from 'react';
import { ArrowLeft, KeyRound, Landmark, Loader2, PlugZap, QrCode, ReceiptText, Save, ShieldCheck, Webhook } from 'lucide-react';
import type { BankEnvironment } from '../../gateway/bankGateway';
import { useInterIntegration } from '../queries/useInterIntegration';
import { InterBoletoSection } from './sections/InterBoletoSection';
import { InterCredentialsSection } from './sections/InterCredentialsSection';
import { InterPixSection } from './sections/InterPixSection';
import { InterWebhookSection } from './sections/InterWebhookSection';

type InterTab = 'credenciais' | 'boleto' | 'pix' | 'webhook';

interface InterConfigPageProps {
  onBack: () => void;
}

const environments: Array<{ id: BankEnvironment; label: string }> = [
  { id: 'homologacao', label: 'Homologação' },
  { id: 'producao', label: 'Produção' },
];

const tabs: Array<{ id: InterTab; label: string; icon: React.ReactNode }> = [
  { id: 'credenciais', label: 'Credenciais', icon: <KeyRound size={15} /> },
  { id: 'boleto', label: 'Boleto', icon: <ReceiptText size={15} /> },
  { id: 'pix', label: 'Pix', icon: <QrCode size={15} /> },
  { id: 'webhook', label: 'Webhook', icon: <Webhook size={15} /> },
];

const getErrorMessage = (error: unknown, fallback: string) => (
  error instanceof Error && error.message ? error.message : fallback
);

export const InterConfigPage: React.FC<InterConfigPageProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<InterTab>('credenciais');
  const inter = useInterIntegration();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void inter.save();
  };

  if (inter.isLoading) return <div className="submodule-content-card"><div className="sub-loading">Carregando integração Banco Inter...</div></div>;

  return (
    <div className="submodule-content-card">
      <button type="button" className="btn-back-to-grid" onClick={onBack} style={{ marginBottom: '16px' }}>
        <ArrowLeft size={16} /> Voltar para bancos
      </button>

      <div className="submodule-card-header flex-header">
        <div className="bank-provider-heading">
          <span className="bank-logo bank-logo--inter bank-logo--large">
            <img src="/integrations/banks/inter-empresas-logo.svg" alt="Logo Banco Inter Empresas" />
          </span>
          <div>
            <div className="inter-title-row">
              <h2>Banco Inter</h2>
              <span className={`bank-status bank-status--${inter.config?.status || 'pendente'}`}>
                {inter.config?.status === 'configurado' ? 'Configurado' : inter.config?.status === 'erro' ? 'Com erro' : inter.config?.status === 'em_validacao' ? 'Em validação' : 'Pendente'}
              </span>
            </div>
            <p>Credenciais mTLS, BolePix, Pix e webhooks separados por função.</p>
          </div>
        </div>
        <ShieldCheck size={28} className="gold-text" />
      </div>

      {inter.loadError || !inter.config || !inter.activeConfig ? (
        <div className="bank-feedback bank-feedback--error">
          {getErrorMessage(inter.loadError, 'Não foi possível carregar a configuração do Banco Inter.')}
        </div>
      ) : (
        <form className="config-form inter-config" onSubmit={handleSubmit}>
          <div className="inter-toolbar">
            <div className="tab-buttons-header bank-environment-tabs">
              {environments.map((environment) => (
                <button
                  key={environment.id}
                  type="button"
                  className={`btn-tab ${inter.activeEnvironment === environment.id ? 'active' : ''}`}
                  onClick={() => inter.setActiveEnvironment(environment.id)}
                >
                  <Landmark size={15} /> {environment.label}
                </button>
              ))}
            </div>
            <span className={`inter-environment-badge is-${inter.activeEnvironment}`}>
              {inter.activeEnvironment === 'producao' ? 'Dados reais' : 'Ambiente de testes'}
            </span>
          </div>

          <nav className="inter-tabs" aria-label="Módulos do Banco Inter">
            {tabs.map((tab) => (
              <button key={tab.id} type="button" className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </nav>

          {inter.isSaved && <div className="bank-feedback bank-feedback--success">Configuração salva. A integração permanece em validação até o teste de conexão.</div>}
          {inter.saveError && <div className="bank-feedback bank-feedback--error">{getErrorMessage(inter.saveError, 'Não foi possível salvar a integração.')}</div>}
          {inter.connectionResult && <div className={`bank-feedback ${inter.connectionResult.ok ? 'bank-feedback--success' : 'bank-feedback--error'}`}>{inter.connectionResult.message}</div>}
          {inter.connectionError && <div className="bank-feedback bank-feedback--error">{getErrorMessage(inter.connectionError, 'O teste de conexão falhou.')}</div>}
          {inter.webhookResult && <div className={`bank-feedback ${inter.webhookResult.ok ? 'bank-feedback--success' : 'bank-feedback--error'}`}>{inter.webhookResult.message}</div>}
          {inter.webhookError && <div className="bank-feedback bank-feedback--error">{getErrorMessage(inter.webhookError, 'Não foi possível registrar o webhook.')}</div>}

          {activeTab === 'credenciais' && <InterCredentialsSection config={inter.activeConfig} onPatch={inter.patchEnvironment} />}
          {activeTab === 'boleto' && <InterBoletoSection config={inter.activeConfig} onPatch={inter.patchEnvironment} />}
          {activeTab === 'pix' && <InterPixSection config={inter.activeConfig} onPatch={inter.patchEnvironment} />}
          {activeTab === 'webhook' && (
            <InterWebhookSection
              config={inter.activeConfig}
              onPatch={inter.patchEnvironment}
              isConfiguring={inter.isConfiguringWebhook}
              onConfigure={() => void inter.configureWebhook()}
            />
          )}

          <div className="inter-security-note">
            <ShieldCheck size={18} />
            <span>Client Secret, certificado e chave privada são enviados somente ao backend seguro. Esta tela recebe apenas indicadores de configuração.</span>
          </div>

          <div className="form-actions-row inter-actions">
            <button type="button" className="bank-secondary-button" disabled={inter.isTesting || inter.isSaving} onClick={() => void inter.testConnection()}>
              {inter.isTesting ? <Loader2 size={16} className="bank-spin" /> : <PlugZap size={16} />}
              {inter.isTesting ? 'Testando...' : 'Testar conexão'}
            </button>
            <button type="submit" className="btn-save-settings" disabled={inter.isSaving || inter.isTesting}>
              {inter.isSaving ? <Loader2 size={16} className="bank-spin" /> : <Save size={16} />}
              {inter.isSaving ? 'Salvando...' : 'Salvar Banco Inter'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
