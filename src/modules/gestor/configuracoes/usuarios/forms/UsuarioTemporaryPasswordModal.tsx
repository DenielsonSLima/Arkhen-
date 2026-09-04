import { useState } from 'react';
import { Check, Clipboard, KeyRound, ShieldAlert, X } from 'lucide-react';
import { formatCpf } from '../../../../../lib/cpf';
import './UsuarioTemporaryPasswordModal.css';

interface UsuarioTemporaryPasswordModalProps {
  usuarioNome: string;
  cpf: string;
  temporaryPassword: string;
  onClose: () => void;
}

export const UsuarioTemporaryPasswordModal = ({
  usuarioNome,
  cpf,
  temporaryPassword,
  onClose,
}: UsuarioTemporaryPasswordModalProps) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  };

  return (
    <div className="modal-backdrop usuario-temporary-password-backdrop" role="presentation">
      <section
        className="usuario-temporary-password-modal animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="temporary-password-title"
      >
        <div className="usuario-temporary-password-header">
          <span className="usuario-temporary-password-icon"><KeyRound size={22} /></span>
          <div>
            <span className="usuario-access-eyebrow">Primeiro acesso</span>
            <h3 id="temporary-password-title">Senha temporária criada</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar e apagar senha temporária">
            <X size={18} />
          </button>
        </div>

        <p className="usuario-temporary-password-description">
          Entregue estas credenciais diretamente a <strong>{usuarioNome}</strong>.
          Ao entrar, o sistema exigirá uma nova senha.
        </p>

        <dl className="usuario-temporary-password-credentials">
          <div>
            <dt>CPF</dt>
            <dd>{formatCpf(cpf)}</dd>
          </div>
          <div>
            <dt>Senha temporária</dt>
            <dd><code>{temporaryPassword}</code></dd>
          </div>
        </dl>

        <button type="button" className="btn-primary" onClick={() => void copyPassword()}>
          {copyStatus === 'copied' ? <Check size={17} /> : <Clipboard size={17} />}
          {copyStatus === 'copied' ? 'Senha copiada' : 'Copiar senha'}
        </button>
        {copyStatus === 'error' && (
          <p className="usuario-temporary-password-copy-error" role="alert">
            Não foi possível copiar automaticamente. Selecione a senha acima.
          </p>
        )}

        <div className="usuario-temporary-password-warning" role="note">
          <ShieldAlert size={18} />
          <span>
            Esta senha não será salva nem exibida novamente. Ao fechar esta janela,
            será necessário redefini-la caso não tenha sido anotada.
          </span>
        </div>

        <button type="button" className="btn-cancel" onClick={onClose}>
          Já guardei, fechar
        </button>
      </section>
    </div>
  );
};
