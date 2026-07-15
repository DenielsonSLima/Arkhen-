import React from 'react';
import { FileKey2, KeyRound, X } from 'lucide-react';
import type { InterEnvironmentConfig } from '../../types/interTypes';
import { InterSectionCard } from '../InterSectionCard';

interface InterCredentialsSectionProps {
  config: InterEnvironmentConfig;
  onPatch: (changes: Partial<InterEnvironmentConfig>) => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

const readTextFile = async (file: File | undefined, onRead: (content: string) => void) => {
  if (!file) return;
  onRead(await file.text());
};

type CredentialState = 'configured' | 'pending' | 'missing';

const getCredentialState = (configured: boolean, pendingValue: string) => (
  pendingValue.trim() ? 'pending' : configured ? 'configured' : 'missing'
);

const CredentialBadge: React.FC<{ state: CredentialState }> = ({ state }) => (
  <span className={`inter-secret-status is-${state}`}>
    {state === 'configured' ? 'Armazenado com segurança' : state === 'pending' ? 'Pronto para salvar' : 'Ainda não configurado'}
  </span>
);

export const InterCredentialsSection: React.FC<InterCredentialsSectionProps> = ({ config, onPatch, onNotify }) => {
  const clientIdState = getCredentialState(config.clientIdConfigured, config.clientId);
  const clientSecretState = getCredentialState(config.clientSecretConfigured, config.clientSecret);
  const certificateState = getCredentialState(config.certificateConfigured, config.certificatePem);
  const privateKeyState = getCredentialState(config.privateKeyConfigured, config.privateKeyPem);

  return <InterSectionCard
    title="Credenciais e certificado mTLS"
    description="Dados obtidos no Internet Banking do Inter. Os segredos não serão exibidos novamente."
    icon={<KeyRound size={20} />}
  >
    <div className="inter-form-grid">
      <label className="inter-field">
        <span>Client ID</span>
        <input
          type="text"
          className={`is-${clientIdState}`}
          value={config.clientId}
          autoComplete="off"
          placeholder={clientIdState === 'configured' ? '••••••••••••••••' : ''}
          aria-invalid={clientIdState === 'missing'}
          onChange={(event) => onPatch({ clientId: event.target.value })}
        />
        <CredentialBadge state={clientIdState} />
      </label>
      <label className="inter-field">
        <span>Client Secret</span>
        <input
          type="password"
          className={`is-${clientSecretState}`}
          value={config.clientSecret}
          autoComplete="new-password"
          placeholder={clientSecretState === 'configured' ? '••••••••••••••••' : ''}
          aria-invalid={clientSecretState === 'missing'}
          onChange={(event) => onPatch({ clientSecret: event.target.value, clearClientSecret: false })}
        />
        <CredentialBadge state={clientSecretState} />
      </label>
    </div>

    <div className="inter-upload-grid">
      <label className={`inter-upload-card is-${certificateState}`}>
        {(config.certificateConfigured || config.certificatePem) && (
          <button
            type="button"
            className="inter-upload-remove"
            aria-label="Remover certificado público"
            title="Remover certificado"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onPatch({
                certificatePem: '',
                certificateFileName: '',
                certificateConfigured: false,
                clearCertificate: true,
              });
              onNotify('info', 'Certificado marcado para remoção', 'Clique em Salvar Banco Inter para concluir a exclusão com segurança.');
            }}
          >
            <X size={16} />
          </button>
        )}
        <FileKey2 size={22} />
        <span><strong>Certificado público</strong><small>{config.certificateFileName || 'Arquivo .crt ou .pem'}</small></span>
        <input
          type="file"
          accept=".crt,.pem,application/x-pem-file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            event.currentTarget.value = '';
            void readTextFile(file, (content) => onPatch({
              certificatePem: content,
              certificateFileName: file.name,
              clearCertificate: false,
            })).then(() => {
              onNotify('success', 'Certificado carregado', `O arquivo “${file.name}” está pronto. Clique em Salvar Banco Inter para armazená-lo com segurança.`);
            }).catch(() => {
              onNotify('error', 'Falha ao carregar certificado', 'Não foi possível ler o arquivo selecionado. Verifique o formato e tente novamente.');
            });
          }}
        />
        <CredentialBadge state={certificateState} />
      </label>
      <label className={`inter-upload-card is-${privateKeyState}`}>
        {(config.privateKeyConfigured || config.privateKeyPem) && (
          <button
            type="button"
            className="inter-upload-remove"
            aria-label="Remover chave privada"
            title="Remover chave privada"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onPatch({
                privateKeyPem: '',
                privateKeyFileName: '',
                privateKeyConfigured: false,
                clearPrivateKey: true,
              });
              onNotify('info', 'Chave privada marcada para remoção', 'Clique em Salvar Banco Inter para concluir a exclusão com segurança.');
            }}
          >
            <X size={16} />
          </button>
        )}
        <KeyRound size={22} />
        <span><strong>Chave privada</strong><small>{config.privateKeyFileName || 'Arquivo .key ou .pem'}</small></span>
        <input
          type="file"
          accept=".key,.pem,application/x-pem-file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            event.currentTarget.value = '';
            void readTextFile(file, (content) => onPatch({
              privateKeyPem: content,
              privateKeyFileName: file.name,
              clearPrivateKey: false,
            })).then(() => {
              onNotify('success', 'Chave privada carregada', `O arquivo “${file.name}” está pronto. Clique em Salvar Banco Inter para armazená-lo com segurança.`);
            }).catch(() => {
              onNotify('error', 'Falha ao carregar chave privada', 'Não foi possível ler o arquivo selecionado. Verifique o formato e tente novamente.');
            });
          }}
        />
        <CredentialBadge state={privateKeyState} />
      </label>
    </div>

  </InterSectionCard>;
};
