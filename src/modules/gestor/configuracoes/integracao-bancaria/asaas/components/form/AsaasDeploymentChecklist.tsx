import React from 'react';
import { ReceiptText } from 'lucide-react';
import type { BankEnvironment } from '../../../gateway/bankGateway';
import { asaasService, type AsaasEnvironmentConfig } from '../../services/asaasService';
import { iconBoxStyle, panelStyle, sectionHeaderStyle, type SecretState } from './asaasFormUi';

interface AsaasDeploymentChecklistProps {
  environment: BankEnvironment;
  config: AsaasEnvironmentConfig;
  webhookTokenState: SecretState;
}

const requiredEvents = [
  'PAYMENT_CREATED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_OVERDUE',
  'PAYMENT_DELETED',
  'PAYMENT_REFUNDED',
  'PAYMENT_CHECKOUT_VIEWED',
];

export const AsaasDeploymentChecklist: React.FC<AsaasDeploymentChecklistProps> = ({
  environment,
  config,
  webhookTokenState,
}) => (
  <div style={panelStyle}>
    <div style={sectionHeaderStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={iconBoxStyle('#7c3aed', '#f5f3ff')}>
          <ReceiptText size={18} />
        </span>
        <div>
          <strong style={{ display: 'block', color: '#0f172a' }}>Implantação para cobranças</strong>
          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Campos que precisam bater com o painel do Asaas.</span>
        </div>
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
      {[
        { label: 'URL', value: asaasService.getWebhookUrl(environment) },
        { label: 'authToken', value: webhookTokenState === 'configured' ? 'Configurado' : 'Pendente' },
        { label: 'sendType', value: config.tipoEnvio === 'sequencial' ? 'SEQUENTIALLY' : 'NON_SEQUENTIALLY' },
        { label: 'events', value: requiredEvents.join(', ') },
      ].map((item) => (
        <div key={item.label} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', background: '#f8fafc' }}>
          <span style={{ display: 'block', color: '#64748b', fontSize: '0.7rem', fontWeight: 850, textTransform: 'uppercase' }}>{item.label}</span>
          <span style={{ display: 'block', marginTop: '6px', color: '#0f172a', fontSize: '0.78rem', lineHeight: 1.45, wordBreak: 'break-word' }}>{item.value}</span>
        </div>
      ))}
    </div>
  </div>
);
