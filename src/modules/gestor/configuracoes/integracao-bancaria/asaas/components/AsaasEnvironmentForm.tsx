import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { asaasService, type AsaasEnvironmentConfig } from '../services/asaasService';
import type { BankEnvironment } from '../../gateway/bankGateway';

interface AsaasEnvironmentFormProps {
  environment: BankEnvironment;
  config: AsaasEnvironmentConfig;
  isSaving: boolean;
  onChange: (field: keyof AsaasEnvironmentConfig, value: string | boolean | number) => void;
}

const environmentLabel: Record<BankEnvironment, string> = {
  producao: 'Produção',
  homologacao: 'Homologação',
};

export const AsaasEnvironmentForm: React.FC<AsaasEnvironmentFormProps> = ({
  environment,
  config,
  isSaving,
  onChange,
}) => (
  <div className="config-form" style={{ padding: 0, border: 'none', boxShadow: 'none' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '14px 16px', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#f8fafc', marginBottom: '18px' }}>
      <div>
        <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.92rem' }}>{environmentLabel[environment]}</strong>
        <span style={{ color: '#64748b', fontSize: '0.78rem' }}>{asaasService.getBaseUrl(environment)}</span>
      </div>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: environment === 'producao' ? '#b91c1c' : '#2563eb', fontSize: '0.76rem', fontWeight: 800 }}>
        <ShieldCheck size={15} />
        {environment === 'producao' ? 'Valores reais' : 'Sandbox de testes'}
      </span>
    </div>

    <div className="form-item-group">
      <label>Chave de API</label>
      <input
        type="password"
        value={config.apiKey}
        onChange={(event) => onChange('apiKey', event.target.value)}
        placeholder={environment === 'producao' ? '$aact_prod_...' : '$aact_hmlg_...'}
        disabled={isSaving}
      />
      <span className="input-helper-text">Token gerado no painel Asaas do ambiente selecionado.</span>
    </div>

    <div className="form-divider-title">Meios e Checkout</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '16px' }}>
      {[
        ['aceitaBoleto', 'Boleto Bancário'],
        ['aceitaPix', 'Pix'],
        ['aceitaCartao', 'Cartão de Crédito'],
        ['checkoutAtivo', 'Checkout Asaas'],
      ].map(([field, label]) => (
        <label key={field} className="checkbox-container" style={{ margin: 0 }}>
          <input
            type="checkbox"
            checked={Boolean(config[field as keyof AsaasEnvironmentConfig])}
            onChange={(event) => onChange(field as keyof AsaasEnvironmentConfig, event.target.checked)}
            disabled={isSaving}
          />
          <span className="checkbox-checkmark"></span>
          {label}
        </label>
      ))}
    </div>

    <div className="form-item-group" style={{ maxWidth: '260px', marginBottom: '24px' }}>
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

    <div className="form-divider-title">Webhook</div>
    <div className="form-row-grid">
      <div className="form-item-group">
        <label>URL do Webhook</label>
        <input
          type="text"
          value={config.webhookUrl}
          onChange={(event) => onChange('webhookUrl', event.target.value)}
          placeholder="https://sua-api.com/webhooks/asaas"
          disabled={isSaving}
        />
      </div>
      <div className="form-item-group">
        <label>Token de Validação</label>
        <input
          type="password"
          value={config.webhookToken}
          onChange={(event) => onChange('webhookToken', event.target.value)}
          placeholder="asaas-access-token"
          disabled={isSaving}
        />
        <span className="input-helper-text">Valide o header asaas-access-token antes de processar eventos.</span>
      </div>
    </div>

    <label className="checkbox-container">
      <input
        type="checkbox"
        checked={config.emailNotificacao}
        onChange={(event) => onChange('emailNotificacao', event.target.checked)}
        disabled={isSaving}
      />
      <span className="checkbox-checkmark"></span>
      Enviar alertas automáticos de cobrança para o e-mail do cliente
    </label>
  </div>
);
