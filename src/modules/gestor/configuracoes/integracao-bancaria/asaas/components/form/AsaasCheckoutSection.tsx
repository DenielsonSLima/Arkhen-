import React from 'react';
import { Link2 } from 'lucide-react';
import type { AsaasEnvironmentConfig } from '../../services/asaasService';
import { iconBoxStyle, panelStyle, sectionHeaderStyle } from './asaasFormUi';

interface AsaasCheckoutSectionProps {
  config: AsaasEnvironmentConfig;
  isSaving: boolean;
  onChange: (field: keyof AsaasEnvironmentConfig, value: string | boolean | number) => void;
}

export const AsaasCheckoutSection: React.FC<AsaasCheckoutSectionProps> = ({
  config,
  isSaving,
  onChange,
}) => (
  <div style={panelStyle}>
    <div style={sectionHeaderStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={iconBoxStyle('#0f766e', '#ecfdf5')}>
          <Link2 size={18} />
        </span>
        <div>
          <strong style={{ display: 'block', color: '#0f172a' }}>Checkout Asaas</strong>
          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Link de pagamento respeitando os meios habilitados acima.</span>
        </div>
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(220px, 340px)', gap: '16px', alignItems: 'end' }}>
      <label className="checkbox-container" style={{ margin: 0 }}>
        <input
          type="checkbox"
          checked={Boolean(config.checkoutAtivo)}
          onChange={(event) => onChange('checkoutAtivo', event.target.checked)}
          disabled={isSaving}
        />
        <span className="checkbox-checkmark"></span>
        Habilitar link/checkout do Asaas
      </label>

      <div className="form-item-group" style={{ margin: 0 }}>
        <label>Parcelamento Máximo</label>
        <select
          value={config.maxParcelas}
          onChange={(event) => onChange('maxParcelas', parseInt(event.target.value, 10) || 1)}
          disabled={isSaving || !config.aceitaCartao}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((item) => (
            <option key={item} value={item}>Até {item}x sem juros</option>
          ))}
        </select>
      </div>
    </div>

    {!config.aceitaCartao && (
      <div style={{ marginTop: '12px', border: '1px solid #dbeafe', background: '#eff6ff', color: '#1e40af', borderRadius: '10px', padding: '10px 12px', fontSize: '0.78rem', fontWeight: 750 }}>
        Cartão está desabilitado. Cobranças "Boleto + Pix" serão emitidas como boleto com Pix associado, sem enviar forma indefinida ao Asaas.
      </div>
    )}
  </div>
);
