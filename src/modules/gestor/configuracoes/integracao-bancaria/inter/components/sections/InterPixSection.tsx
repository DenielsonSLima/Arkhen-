import React from 'react';
import { QrCode } from 'lucide-react';
import type { InterEnvironmentConfig } from '../../types/interTypes';
import type { BankEnvironment } from '../../../gateway/bankGateway';
import { InterSectionCard, InterSwitch } from '../InterSectionCard';

interface InterPixSectionProps {
  environment: BankEnvironment;
  config: InterEnvironmentConfig;
  onPatch: (changes: Partial<InterEnvironmentConfig>) => void;
}

export const InterPixSection: React.FC<InterPixSectionProps> = ({ environment, config, onPatch }) => (
  <InterSectionCard
    title="Recebimentos por Pix"
    description="Controle o uso do Pix nas cobranças e na conciliação do ambiente selecionado."
    icon={<QrCode size={20} />}
  >
    {environment === 'homologacao' ? (
      <div className="inter-sandbox-guidance">
        <strong>Chave Pix não é exigida para validar o Sandbox</strong>
        <span>Use as credenciais e os certificados fornecidos no Portal do Desenvolvedor. A chave recebedora será solicitada somente na Produção, quando houver operações reais por Pix.</span>
      </div>
    ) : (
      <>
        <InterSwitch
          checked={config.pixAtivo}
          label="Pix ativo"
          description="Exibe Pix como meio de recebimento nas operações reais do Banco Inter."
          onChange={(pixAtivo) => onPatch({ pixAtivo })}
        />
        <label className="inter-field inter-field--full">
          <span>Chave Pix recebedora</span>
          <input
            type="text"
            value={config.chavePix}
            autoComplete="off"
            maxLength={77}
            placeholder="EVP, CNPJ, e-mail ou telefone cadastrado no Inter"
            onChange={(event) => onPatch({ chavePix: event.target.value })}
          />
          <small>Obrigatória para emitir uma cobrança real exclusivamente por Pix.</small>
        </label>
        <div className="inter-notice">
          O Pix da cobrança é processado no backend. Certificados e tokens de acesso nunca são enviados de volta para esta tela.
        </div>
      </>
    )}
  </InterSectionCard>
);
