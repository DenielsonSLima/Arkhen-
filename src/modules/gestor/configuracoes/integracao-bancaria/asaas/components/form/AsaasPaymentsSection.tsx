import React from 'react';
import { CreditCard } from 'lucide-react';
import type { AsaasEnvironmentConfig } from '../../services/asaasService';
import { iconBoxStyle, panelStyle, sectionHeaderStyle } from './asaasFormUi';

interface AsaasPaymentsSectionProps {
  config: AsaasEnvironmentConfig;
  isSaving: boolean;
  onChange: (field: keyof AsaasEnvironmentConfig, value: string | boolean | number) => void;
}

const checkboxItems: Array<[keyof AsaasEnvironmentConfig, string]> = [
  ['aceitaBoleto', 'Boleto Bancário'],
  ['aceitaPix', 'Pix'],
  ['aceitaCartao', 'Cartão de Crédito'],
];

export const AsaasPaymentsSection: React.FC<AsaasPaymentsSectionProps> = ({
  config,
  isSaving,
  onChange,
}) => (
  <div style={panelStyle}>
    <div style={sectionHeaderStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={iconBoxStyle('#2563eb', '#eff6ff')}>
          <CreditCard size={18} />
        </span>
        <div>
          <strong style={{ display: 'block', color: '#0f172a' }}>Meios de pagamento</strong>
          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Meios liberados para emissão de cobranças.</span>
        </div>
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '16px' }}>
      {checkboxItems.map(([field, label]) => (
        <label key={field} className="checkbox-container" style={{ margin: 0 }}>
          <input
            type="checkbox"
            checked={Boolean(config[field])}
            onChange={(event) => onChange(field, event.target.checked)}
            disabled={isSaving}
          />
          <span className="checkbox-checkmark"></span>
          {label}
        </label>
      ))}
    </div>
  </div>
);
