import React from 'react';
import { AlertCircle, CheckCircle2, KeyRound, RefreshCcw, Trash2 } from 'lucide-react';
import type { BankEnvironment } from '../../../gateway/bankGateway';
import type { AsaasEnvironmentConfig } from '../../services/asaasService';
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

interface AsaasCredentialsSectionProps {
  environment: BankEnvironment;
  config: AsaasEnvironmentConfig;
  isSaving: boolean;
  apiKeyState: SecretState;
  onPatch: (changes: Partial<AsaasEnvironmentConfig>) => void;
}

export const AsaasCredentialsSection: React.FC<AsaasCredentialsSectionProps> = ({
  environment,
  config,
  isSaving,
  apiKeyState,
  onPatch,
}) => (
  <div style={panelStyle}>
    <div style={sectionHeaderStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={iconBoxStyle('#c59235', '#fffbeb')}>
          <KeyRound size={18} />
        </span>
        <div>
          <strong style={{ display: 'block', color: '#0f172a' }}>Credenciais do ambiente</strong>
          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Use a chave gerada no painel Asaas deste ambiente.</span>
        </div>
      </div>
      <SecretStatus state={apiKeyState} />
    </div>

    <div className="form-item-group" style={{ width: 'min(100%, 760px)' }}>
      <label>Chave de API</label>
      <div style={{ position: 'relative' }}>
        <input
          type="password"
          value={config.apiKey}
          onChange={(event) => onPatch({ apiKey: event.target.value, clearApiKey: false })}
          placeholder={config.apiKeyConfigured && !config.clearApiKey ? maskedSecret : environment === 'producao' ? '$aact_prod_...' : '$aact_hmlg_...'}
          disabled={isSaving}
          name={`asaas-${environment}-api-key`}
          autoComplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
          spellCheck={false}
          style={secretInputStyle(apiKeyState)}
        />
        {apiKeyState === 'pending' ? (
          <AlertCircle size={18} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#dc2626' }} />
        ) : (
          <CheckCircle2 size={18} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: secretIconColor(apiKeyState) }} />
        )}
      </div>
      <span className="input-helper-text">
        {apiKeyState === 'removing'
          ? 'A chave será removida da configuração quando salvar.'
          : apiKeyState === 'configured'
          ? 'Chave mascarada e salva no Supabase Vault. Cole uma nova apenas se quiser substituir.'
          : 'Obrigatória para criar clientes, cobranças, Pix, boleto e checkout.'}
      </span>
    </div>

    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '12px' }}>
      {config.apiKeyConfigured && !config.clearApiKey && (
        <button type="button" style={buttonStyle('danger')} onClick={() => onPatch({ apiKey: '', clearApiKey: true })} disabled={isSaving}>
          <Trash2 size={14} />
          Remover chave
        </button>
      )}
      {config.clearApiKey && (
        <button type="button" style={buttonStyle('undo')} onClick={() => onPatch({ clearApiKey: false })} disabled={isSaving}>
          <RefreshCcw size={14} />
          Desfazer remoção da chave
        </button>
      )}
    </div>
  </div>
);
