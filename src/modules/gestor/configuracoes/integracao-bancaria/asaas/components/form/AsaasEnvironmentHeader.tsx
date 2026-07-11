import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { BankEnvironment } from '../../../gateway/bankGateway';
import { asaasService } from '../../services/asaasService';
import { environmentLabel, environmentTone, iconBoxStyle, panelStyle, SecretStatus, sectionHeaderStyle, type SecretState } from './asaasFormUi';

interface AsaasEnvironmentHeaderProps {
  environment: BankEnvironment;
  apiKeyState: SecretState;
  webhookTokenState: SecretState;
}

export const AsaasEnvironmentHeader: React.FC<AsaasEnvironmentHeaderProps> = ({
  environment,
  apiKeyState,
  webhookTokenState,
}) => {
  const tone = environmentTone[environment];
  const isReadyToTest = apiKeyState === 'configured' && webhookTokenState === 'configured';

  return (
    <div style={{ ...panelStyle, background: '#f8fafc' }}>
      <div style={sectionHeaderStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={iconBoxStyle(tone.color, tone.bg)}>
            <ShieldCheck size={18} />
          </span>
          <div>
            <strong style={{ display: 'block', color: '#0f172a', fontSize: '1rem' }}>{environmentLabel[environment]}</strong>
            <span style={{ display: 'block', color: '#64748b', fontSize: '0.8rem' }}>{asaasService.getBaseUrl(environment)}</span>
          </div>
        </div>
        <span style={{ border: `1px solid ${tone.border}`, background: tone.bg, color: tone.color, borderRadius: '999px', padding: '6px 10px', fontSize: '0.74rem', fontWeight: 850 }}>
          {tone.label}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
        {[
          { label: 'Chave de API', state: apiKeyState },
          { label: 'Webhook', state: webhookTokenState },
          { label: 'Implantação', state: isReadyToTest ? 'configured' : 'pending' as SecretState },
        ].map((item) => (
          <div key={item.label} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', background: '#ffffff' }}>
            <span style={{ display: 'block', color: '#64748b', fontSize: '0.7rem', fontWeight: 850, textTransform: 'uppercase' }}>{item.label}</span>
            <div style={{ marginTop: '8px' }}>
              <SecretStatus state={item.state as SecretState} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
