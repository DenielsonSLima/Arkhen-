import React from 'react';
import { AsaasCredentialsSection } from './form/AsaasCredentialsSection';
import { AsaasDeploymentChecklist } from './form/AsaasDeploymentChecklist';
import { AsaasEnvironmentHeader } from './form/AsaasEnvironmentHeader';
import { AsaasPaymentsSection } from './form/AsaasPaymentsSection';
import { AsaasWebhookSection } from './form/AsaasWebhookSection';
import { getSecretState } from './form/asaasFormUi';
import type { AsaasEnvironmentConfig } from '../services/asaasService';
import type { BankEnvironment } from '../../gateway/bankGateway';

interface AsaasEnvironmentFormProps {
  environment: BankEnvironment;
  config: AsaasEnvironmentConfig;
  isSaving: boolean;
  onChange: (field: keyof AsaasEnvironmentConfig, value: string | boolean | number) => void;
  onPatch: (changes: Partial<AsaasEnvironmentConfig>) => void;
}

export const AsaasEnvironmentForm: React.FC<AsaasEnvironmentFormProps> = ({
  environment,
  config,
  isSaving,
  onChange,
  onPatch,
}) => {
  const apiKeyState = getSecretState(config.apiKeyConfigured, config.apiKey, config.clearApiKey);
  const webhookTokenState = getSecretState(config.webhookTokenConfigured, config.webhookToken, config.clearWebhookToken);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <AsaasEnvironmentHeader
        environment={environment}
        apiKeyState={apiKeyState}
        webhookTokenState={webhookTokenState}
      />

      {(config.clearApiKey || config.clearWebhookToken) && (
        <div style={{ border: '1px solid #fde68a', background: '#fffbeb', color: '#92400e', borderRadius: '12px', padding: '13px 15px', fontSize: '0.84rem', fontWeight: 750 }}>
          Credencial marcada para remoção. Clique em <strong>Salvar Asaas</strong> para concluir ou use <strong>Desfazer</strong> antes de salvar.
        </div>
      )}

      <AsaasCredentialsSection
        environment={environment}
        config={config}
        isSaving={isSaving}
        apiKeyState={apiKeyState}
        onPatch={onPatch}
      />

      <div style={{ border: '1px solid #fde68a', background: '#fffbeb', color: '#92400e', borderRadius: '12px', padding: '13px 15px', fontSize: '0.82rem', lineHeight: 1.45 }}>
        <strong style={{ display: 'block', marginBottom: '4px' }}>Atenção com credenciais</strong>
        API Key e token do Webhook são segredos. Não envie em grupos, prints, e-mails ou atendimento. O sistema mascara na tela e grava criptografado no Supabase Vault.
      </div>

      <AsaasPaymentsSection config={config} isSaving={isSaving} onChange={onChange} />

      <AsaasWebhookSection
        environment={environment}
        config={config}
        isSaving={isSaving}
        webhookTokenState={webhookTokenState}
        onChange={onChange}
        onPatch={onPatch}
      />

      <AsaasDeploymentChecklist
        environment={environment}
        config={config}
        webhookTokenState={webhookTokenState}
      />
    </div>
  );
};
