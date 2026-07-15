import React from 'react';
import { ReceiptText } from 'lucide-react';
import type { InterEnvironmentConfig } from '../../types/interTypes';
import type { BankEnvironment } from '../../../gateway/bankGateway';
import { InterSectionCard, InterSwitch } from '../InterSectionCard';

interface InterBoletoSectionProps {
  environment: BankEnvironment;
  config: InterEnvironmentConfig;
  onPatch: (changes: Partial<InterEnvironmentConfig>) => void;
}

export const InterBoletoSection: React.FC<InterBoletoSectionProps> = ({ environment, config, onPatch }) => (
  <InterSectionCard
    title="Cobrança por boleto"
    description="Habilite a emissão e o acompanhamento das cobranças BolePix do Banco Inter."
    icon={<ReceiptText size={20} />}
  >
    {environment === 'homologacao' ? (
      <div className="inter-sandbox-guidance">
        <strong>Nenhum dado adicional é necessário no Sandbox</strong>
        <span>A validação de Homologação usa somente Client ID, Client Secret, certificado e chave privada. A emissão simulada será feita pelos endpoints de teste do Inter.</span>
      </div>
    ) : (
      <>
        <InterSwitch
          checked={config.boletoAtivo}
          label="Boleto ativo"
          description="Permite que o sistema emita cobranças reais pelo Banco Inter."
          onChange={(boletoAtivo) => onPatch({ boletoAtivo })}
        />
        <div className="inter-notice">
          O Inter combina código de barras e Pix na mesma cobrança. A gratuidade depende da adesão da conta PJ às condições vigentes do banco.
        </div>
      </>
    )}
  </InterSectionCard>
);
