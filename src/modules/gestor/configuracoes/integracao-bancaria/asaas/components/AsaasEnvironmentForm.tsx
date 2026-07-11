import React from 'react';
import { AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
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

const maskedSecret = '••••••••••••••••••••••••';

const secureInputStyle = (configured: boolean): React.CSSProperties => configured
  ? {
    borderColor: '#86efac',
    background: '#f0fdf4',
    color: '#166534',
    fontWeight: 800,
  }
  : {
    borderColor: '#fecaca',
    background: '#fff1f2',
    color: '#991b1b',
  };

const renderSecretStatus = (configured: boolean) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    border: `1px solid ${configured ? '#86efac' : '#fecaca'}`,
    background: configured ? '#f0fdf4' : '#fff1f2',
    color: configured ? '#166534' : '#991b1b',
    borderRadius: '999px',
    padding: '4px 9px',
    fontSize: '0.72rem',
    fontWeight: 850,
  }}>
    {configured ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
    {configured ? 'Configurada' : 'Pendente'}
  </span>
);

const removeButtonStyle: React.CSSProperties = {
  border: '1px solid #fecaca',
  background: '#fff1f2',
  color: '#991b1b',
  borderRadius: '8px',
  padding: '6px 10px',
  fontSize: '0.74rem',
  fontWeight: 850,
  cursor: 'pointer',
};

const undoButtonStyle: React.CSSProperties = {
  ...removeButtonStyle,
  borderColor: '#bfdbfe',
  background: '#eff6ff',
  color: '#1d4ed8',
};

export const AsaasEnvironmentForm: React.FC<AsaasEnvironmentFormProps> = ({
  environment,
  config,
  isSaving,
  onChange,
}) => {
  const hasApiKey = Boolean(!config.clearApiKey && (config.apiKeyConfigured || config.apiKey.trim()));
  const hasWebhookToken = Boolean(!config.clearWebhookToken && (config.webhookTokenConfigured || config.webhookToken.trim()));

  return (
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

    {(!hasApiKey || !hasWebhookToken) && (
      <div style={{ border: '1px solid #fecaca', background: '#fff1f2', color: '#991b1b', borderRadius: '10px', padding: '12px 14px', fontSize: '0.82rem', lineHeight: 1.45, marginBottom: '18px' }}>
        <strong style={{ display: 'block', marginBottom: '4px' }}>Integração incompleta</strong>
        {!hasApiKey && <span style={{ display: 'block' }}>Chave de API obrigatória pendente.</span>}
        {!hasWebhookToken && <span style={{ display: 'block' }}>Token de validação do webhook pendente.</span>}
      </div>
    )}

    <div className="form-item-group">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: 'min(100%, 720px)', gap: '12px' }}>
        <label style={{ margin: 0 }}>Chave de API</label>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          {renderSecretStatus(hasApiKey)}
          {config.apiKeyConfigured && (
            <button
              type="button"
              style={config.clearApiKey ? undoButtonStyle : removeButtonStyle}
              onClick={() => {
                onChange('clearApiKey', !config.clearApiKey);
                onChange('apiKey', '');
              }}
              disabled={isSaving}
            >
              {config.clearApiKey ? 'Desfazer' : 'Remover chave'}
            </button>
          )}
        </div>
      </div>
      <div style={{ position: 'relative', width: 'min(100%, 720px)' }}>
        <input
          type="password"
          value={config.apiKey}
          onChange={(event) => onChange('apiKey', event.target.value)}
          placeholder={config.apiKeyConfigured ? maskedSecret : environment === 'producao' ? '$aact_prod_...' : '$aact_hmlg_...'}
          disabled={isSaving}
          name={`asaas-${environment}-api-key`}
          autoComplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
          spellCheck={false}
          style={{ ...secureInputStyle(hasApiKey), width: '100%', boxSizing: 'border-box', paddingRight: '42px' }}
        />
        {hasApiKey ? (
          <CheckCircle2 size={18} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#16a34a' }} />
        ) : (
          <AlertCircle size={18} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#dc2626' }} />
        )}
      </div>
      <span className="input-helper-text">
        {config.clearApiKey
          ? 'Chave marcada para remoção. Clique em Salvar Asaas para apagar da configuração.'
          : hasApiKey
          ? 'Chave salva com segurança no Supabase Vault. Deixe em branco para manter a atual ou cole uma nova para substituir.'
          : 'Obrigatorio: cole a chave do painel Asaas. Nao compartilhe esse token por print, chat ou e-mail.'}
      </span>
    </div>

    <div style={{ border: '1px solid #fde68a', background: '#fffbeb', color: '#92400e', borderRadius: '10px', padding: '12px 14px', fontSize: '0.82rem', lineHeight: 1.45, marginBottom: '18px' }}>
      <strong style={{ display: 'block', marginBottom: '4px' }}>Atenção com credenciais</strong>
      API Key e Token de Validação são segredos. Não envie em grupos, prints, e-mails ou atendimento. No sistema eles ficam mascarados e gravados criptografados no Supabase Vault.
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
        <label>Versão da API</label>
        <select
          value={config.apiVersion}
          onChange={(event) => onChange('apiVersion', event.target.value)}
          disabled={isSaving}
        >
          <option value="v3">v3</option>
          <option value="v2">v2</option>
        </select>
      </div>
      <div className="form-item-group">
        <label>Tipo de envio</label>
        <select
          value={config.tipoEnvio}
          onChange={(event) => onChange('tipoEnvio', event.target.value)}
          disabled={isSaving}
        >
          <option value="sequencial">Sequencial</option>
          <option value="nao_sequencial">Não sequencial</option>
        </select>
      </div>
      <div className="form-item-group">
        <label>URL do Webhook</label>
        <input
          type="text"
          value={asaasService.getWebhookUrl(environment)}
          readOnly
          aria-readonly="true"
          placeholder="URL gerada automaticamente pelo Supabase"
          style={{ background: '#f8fafc', color: '#475569', cursor: 'not-allowed' }}
        />
        <span className="input-helper-text">URL travada e gerada automaticamente pela Edge Function do Supabase.</span>
      </div>
      <div className="form-item-group">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <label style={{ margin: 0 }}>Token de Validação</label>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            {renderSecretStatus(hasWebhookToken)}
            {config.webhookTokenConfigured && (
              <button
                type="button"
                style={config.clearWebhookToken ? undoButtonStyle : removeButtonStyle}
                onClick={() => {
                  onChange('clearWebhookToken', !config.clearWebhookToken);
                  onChange('webhookToken', '');
                }}
                disabled={isSaving}
              >
                {config.clearWebhookToken ? 'Desfazer' : 'Remover token'}
              </button>
            )}
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type="password"
            value={config.webhookToken}
            onChange={(event) => onChange('webhookToken', event.target.value)}
            placeholder={config.webhookTokenConfigured ? maskedSecret : 'asaas-access-token'}
            disabled={isSaving}
            name={`asaas-${environment}-webhook-token`}
            autoComplete="off"
            data-1p-ignore="true"
            data-lpignore="true"
            spellCheck={false}
            style={{ ...secureInputStyle(hasWebhookToken), width: '100%', boxSizing: 'border-box', paddingRight: '42px' }}
          />
          {hasWebhookToken ? (
            <CheckCircle2 size={18} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#16a34a' }} />
          ) : (
            <AlertCircle size={18} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#dc2626' }} />
          )}
        </div>
        <span className="input-helper-text">
          {config.webhookTokenConfigured
            ? config.clearWebhookToken
              ? 'Token marcado para remoção. Clique em Salvar Asaas para apagar da configuração.'
              : 'Token salvo criptografado. Deixe em branco para manter o atual ou cole um novo para substituir.'
            : 'Valide o header asaas-access-token antes de processar eventos.'}
        </span>
      </div>
    </div>

    <label className="checkbox-container">
      <input
        type="checkbox"
        checked={config.filaSincronizacaoAtiva}
        onChange={(event) => onChange('filaSincronizacaoAtiva', event.target.checked)}
        disabled={isSaving}
      />
      <span className="checkbox-checkmark"></span>
      Fila de sincronização ativada
    </label>

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
};
