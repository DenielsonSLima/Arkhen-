import React from 'react';
import { Webhook } from 'lucide-react';
import type { InterEnvironmentConfig } from '../../types/interTypes';
import { InterSectionCard, InterSwitch } from '../InterSectionCard';

interface InterWebhookSectionProps {
  config: InterEnvironmentConfig;
  onPatch: (changes: Partial<InterEnvironmentConfig>) => void;
  isConfiguring: boolean;
  onConfigure: () => void;
}

export const InterWebhookSection: React.FC<InterWebhookSectionProps> = ({
  config,
  onPatch,
  isConfiguring,
  onConfigure,
}) => (
  <InterSectionCard
    title="Webhook de cobranças"
    description="Receba atualizações de pagamento, cancelamento e expiração das cobranças."
    icon={<Webhook size={20} />}
  >
    <InterSwitch
      checked={config.webhookAtivo}
      label="Webhook ativo"
      description="Habilita o registro e o processamento assíncrono dos eventos do Inter."
      onChange={(webhookAtivo) => onPatch({ webhookAtivo })}
    />
    <label className="inter-field inter-field--full">
      <span>URL do webhook</span>
      <input type="text" value={config.webhookUrl} readOnly placeholder="Disponível após salvar a configuração" />
      <small>Copie esta URL para a configuração da integração no Internet Banking, quando solicitado.</small>
    </label>
    <button
      type="button"
      className="bank-secondary-button"
      disabled={isConfiguring || !config.webhookAtivo || !config.webhookUrl}
      onClick={onConfigure}
    >
      {isConfiguring ? 'Registrando...' : 'Registrar webhook no Inter'}
    </button>
  </InterSectionCard>
);
