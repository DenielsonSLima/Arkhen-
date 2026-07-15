import React from 'react';
import { FileKey2, KeyRound } from 'lucide-react';
import type { InterEnvironmentConfig } from '../../types/interTypes';
import { InterSectionCard } from '../InterSectionCard';

interface InterCredentialsSectionProps {
  config: InterEnvironmentConfig;
  onPatch: (changes: Partial<InterEnvironmentConfig>) => void;
}

const readTextFile = async (file: File | undefined, onRead: (content: string) => void) => {
  if (!file) return;
  onRead(await file.text());
};

const ConfiguredBadge: React.FC<{ configured: boolean }> = ({ configured }) => (
  <span className={`inter-secret-status ${configured ? 'is-configured' : ''}`}>
    {configured ? 'Armazenado com segurança' : 'Ainda não configurado'}
  </span>
);

export const InterCredentialsSection: React.FC<InterCredentialsSectionProps> = ({ config, onPatch }) => (
  <InterSectionCard
    title="Credenciais e certificado mTLS"
    description="Dados obtidos no Internet Banking do Inter. Os segredos não serão exibidos novamente."
    icon={<KeyRound size={20} />}
  >
    <div className="inter-form-grid">
      <label className="inter-field">
        <span>Client ID</span>
        <input
          type="text"
          value={config.clientId}
          autoComplete="off"
          placeholder={config.clientIdConfigured ? 'Client ID configurado' : 'Informe o Client ID'}
          onChange={(event) => onPatch({ clientId: event.target.value })}
        />
      </label>
      <label className="inter-field">
        <span>Client Secret</span>
        <input
          type="password"
          value={config.clientSecret}
          autoComplete="new-password"
          placeholder={config.clientSecretConfigured ? '••••••••••••••••' : 'Informe o Client Secret'}
          onChange={(event) => onPatch({ clientSecret: event.target.value, clearClientSecret: false })}
        />
        <ConfiguredBadge configured={config.clientSecretConfigured} />
      </label>
    </div>

    <div className="inter-upload-grid">
      <label className="inter-upload-card">
        <FileKey2 size={22} />
        <span><strong>Certificado público</strong><small>{config.certificateFileName || 'Arquivo .crt ou .pem'}</small></span>
        <input
          type="file"
          accept=".crt,.pem,application/x-pem-file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            void readTextFile(file, (content) => onPatch({
              certificatePem: content,
              certificateFileName: file?.name || '',
              clearCertificate: false,
            }));
          }}
        />
        <ConfiguredBadge configured={config.certificateConfigured} />
      </label>
      <label className="inter-upload-card">
        <KeyRound size={22} />
        <span><strong>Chave privada</strong><small>{config.privateKeyFileName || 'Arquivo .key ou .pem'}</small></span>
        <input
          type="file"
          accept=".key,.pem,application/x-pem-file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            void readTextFile(file, (content) => onPatch({
              privateKeyPem: content,
              privateKeyFileName: file?.name || '',
              clearPrivateKey: false,
            }));
          }}
        />
        <ConfiguredBadge configured={config.privateKeyConfigured} />
      </label>
    </div>

  </InterSectionCard>
);
