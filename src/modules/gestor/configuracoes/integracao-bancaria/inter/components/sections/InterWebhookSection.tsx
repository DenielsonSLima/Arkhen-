import React from 'react';
import { Webhook } from 'lucide-react';
import type { InterEnvironmentConfig } from '../../types/interTypes';
import type { BankEnvironment } from '../../../gateway/bankGateway';
import { InterSectionCard, InterSwitch } from '../InterSectionCard';

interface InterWebhookSectionProps {
  environment: BankEnvironment;
  config: InterEnvironmentConfig;
  onPatch: (changes: Partial<InterEnvironmentConfig>) => void;
  isConfiguring: boolean;
  onConfigure: () => void;
}

export const InterWebhookSection: React.FC<InterWebhookSectionProps> = ({
  config,
  environment,
  onPatch,
  isConfiguring,
  onConfigure,
}) => (
  <InterSectionCard
    title="Webhook de cobranças"
    description="Receba atualizações de pagamento, cancelamento e expiração das cobranças."
    icon={<Webhook size={20} />}
  >
    {environment === 'homologacao' ? (
      <div className="inter-sandbox-guidance">
        <strong>Webhook não bloqueia a validação do Sandbox</strong>
        <span>Primeiro valide as quatro credenciais na aba Credenciais. O callback será configurado na Produção quando o recebimento automático de pagamentos reais for ativado.</span>
      </div>
    ) : (
      <>
        <InterSwitch
          checked={config.webhookAtivo}
          label="Webhook ativo"
          description="Habilita o registro e o processamento assíncrono dos eventos reais do Inter."
          onChange={(webhookAtivo) => onPatch({ webhookAtivo })}
        />
        <label className="inter-field inter-field--full">
          <span>URL do webhook</span>
          <input type="text" value={config.webhookUrl} readOnly placeholder="Disponível após salvar a configuração" />
          <small>Esta URL será registrada no Banco Inter para receber os eventos de Produção.</small>
        </label>
        <button
          type="button"
          className="bank-secondary-button"
          disabled={isConfiguring || !config.webhookAtivo || !config.webhookUrl}
          onClick={onConfigure}
        >
          {isConfiguring ? 'Registrando...' : 'Registrar webhook no Inter'}
        </button>
      </>
    )}
  </InterSectionCard>
);
