import React from 'react';
import { CheckCircle2, CircleDollarSign, QrCode, ReceiptText, Webhook, ShoppingCart } from 'lucide-react';
import type { BankGatewayDefinition } from '../../gateway/bankGateway';
import { hasAsaasWebhookToken, type AsaasEnvironmentConfig } from '../services/asaasService';

interface AsaasModulesPanelProps {
  gateway: BankGatewayDefinition;
  config: AsaasEnvironmentConfig;
}

const moduleIcon: Record<string, React.ReactNode> = {
  tudo: <CircleDollarSign size={18} />,
  checkout: <ShoppingCart size={18} />,
  pix: <QrCode size={18} />,
  boleto: <ReceiptText size={18} />,
  webhook: <Webhook size={18} />,
};

export const AsaasModulesPanel: React.FC<AsaasModulesPanelProps> = ({ gateway, config }) => {
  const enabledByModule: Record<string, boolean> = {
    tudo: true,
    checkout: config.checkoutAtivo,
    pix: config.aceitaPix,
    boleto: config.aceitaBoleto,
    webhook: Boolean(config.webhookUrl && hasAsaasWebhookToken(config)),
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
      {gateway.modules.map((item) => {
        const enabled = enabledByModule[item.id];
        return (
          <div
            key={item.id}
            style={{
              border: enabled ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
              background: enabled ? '#f8fbff' : '#ffffff',
              borderRadius: '10px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              minHeight: '130px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <span style={{ width: '34px', height: '34px', borderRadius: '9px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: enabled ? '#dbeafe' : '#f8fafc', color: enabled ? '#1d4ed8' : '#64748b' }}>
                {moduleIcon[item.id]}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', fontWeight: 800, color: enabled ? '#166534' : '#64748b' }}>
                <CheckCircle2 size={13} />
                {enabled ? 'Ativo' : 'Pendente'}
              </span>
            </div>
            <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>{item.label}</strong>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.78rem', lineHeight: 1.45 }}>{item.description}</p>
          </div>
        );
      })}
    </div>
  );
};
