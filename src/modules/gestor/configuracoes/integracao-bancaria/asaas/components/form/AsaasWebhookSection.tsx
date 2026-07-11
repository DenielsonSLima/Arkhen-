import React from 'react';
import { AlertCircle, CheckCircle2, Link2, RefreshCcw, Trash2 } from 'lucide-react';
import type { BankEnvironment } from '../../../gateway/bankGateway';
import { asaasService, type AsaasEnvironmentConfig } from '../../services/asaasService';
import {
  buttonStyle,
  iconBoxStyle,
  maskedSecret,
  panelStyle,
  secretIconColor,
  secretInputStyle,
  SecretStatus,
  sectionHeaderStyle,
  type SecretState,
} from './asaasFormUi';

interface AsaasWebhookSectionProps {
  environment: BankEnvironment;
  config: AsaasEnvironmentConfig;
  isSaving: boolean;
  webhookTokenState: SecretState;
  onChange: (field: keyof AsaasEnvironmentConfig, value: string | boolean | number) => void;
  onPatch: (changes: Partial<AsaasEnvironmentConfig>) => void;
}

export const AsaasWebhookSection: React.FC<AsaasWebhookSectionProps> = ({
  environment,
  config,
  isSaving,
  webhookTokenState,
  onChange,
  onPatch,
}) => (
  <div style={panelStyle}>
    <div style={sectionHeaderStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={iconBoxStyle('#0f766e', '#f0fdfa')}>
          <Link2 size={18} />
        </span>
        <div>
          <strong style={{ display: 'block', color: '#0f172a' }}>Webhook Asaas</strong>
          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Endpoint fixo do Supabase para eventos de cobrança.</span>
        </div>
      </div>
      <SecretStatus state={webhookTokenState} />
    </div>

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
    </div>

    <div className="form-row-grid">
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
        <span className="input-helper-text">URL travada. Copie esta URL para o Webhook no painel do Asaas.</span>
      </div>

      <div className="form-item-group">
        <label>Token de autenticação do Webhook</label>
        <div style={{ position: 'relative' }}>
          <input
            type="password"
            value={config.webhookToken}
            onChange={(event) => onPatch({ webhookToken: event.target.value, clearWebhookToken: false })}
            placeholder={config.webhookTokenConfigured && !config.clearWebhookToken ? maskedSecret : '32 a 255 caracteres'}
            disabled={isSaving}
            name={`asaas-${environment}-webhook-token`}
            autoComplete="off"
            data-1p-ignore="true"
            data-lpignore="true"
            spellCheck={false}
            style={secretInputStyle(webhookTokenState)}
          />
          {webhookTokenState === 'pending' ? (
            <AlertCircle size={18} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#dc2626' }} />
          ) : (
            <CheckCircle2 size={18} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: secretIconColor(webhookTokenState) }} />
          )}
        </div>
        <span className="input-helper-text">
          {webhookTokenState === 'removing'
            ? 'O token será removido da configuração quando salvar.'
            : webhookTokenState === 'configured'
            ? 'Token salvo criptografado. Cole um novo apenas se quiser substituir.'
            : 'Use o mesmo token no campo authToken do Webhook Asaas.'}
        </span>
      </div>
    </div>

    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
      {config.webhookTokenConfigured && !config.clearWebhookToken && (
        <button type="button" style={buttonStyle('danger')} onClick={() => onPatch({ webhookToken: '', clearWebhookToken: true })} disabled={isSaving}>
          <Trash2 size={14} />
          Remover token
        </button>
      )}
      {config.clearWebhookToken && (
        <button type="button" style={buttonStyle('undo')} onClick={() => onPatch({ clearWebhookToken: false })} disabled={isSaving}>
          <RefreshCcw size={14} />
          Desfazer remoção do token
        </button>
      )}
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
