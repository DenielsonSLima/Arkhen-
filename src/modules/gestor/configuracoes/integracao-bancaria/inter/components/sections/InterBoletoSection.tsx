import React from 'react';
import { ReceiptText } from 'lucide-react';
import type { InterEnvironmentConfig } from '../../types/interTypes';
import { InterSectionCard, InterSwitch } from '../InterSectionCard';

interface InterBoletoSectionProps {
  config: InterEnvironmentConfig;
  onPatch: (changes: Partial<InterEnvironmentConfig>) => void;
}

export const InterBoletoSection: React.FC<InterBoletoSectionProps> = ({ config, onPatch }) => (
  <InterSectionCard
    title="Cobrança por boleto"
    description="Habilite a emissão e o acompanhamento das cobranças BolePix do Banco Inter."
    icon={<ReceiptText size={20} />}
  >
    <InterSwitch
      checked={config.boletoAtivo}
      label="Boleto ativo"
      description="Permite que o sistema emita cobranças pelo provedor Inter selecionado."
      onChange={(boletoAtivo) => onPatch({ boletoAtivo })}
    />
    <div className="inter-notice">
      O Inter combina código de barras e Pix na mesma cobrança. A gratuidade depende da adesão da conta PJ às condições vigentes do banco.
    </div>
  </InterSectionCard>
);
