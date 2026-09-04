import { useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import loginLogoImg from '../../../../assets/camada-o.png';
import {
  EMPLOYEE_PASSWORD_REQUIREMENTS,
  validateEmployeePassword,
} from '../../../../lib/employeePasswordPolicy';
import { CURRENT_RELEASE } from '../../../../internal/version/release';
import { validatePassword } from '../services/passwordPolicy';
import type { PasswordSetupMode } from '../services/passwordRecoveryService';

interface PasswordResetFormProps {
  mode?: PasswordSetupMode;
  isValidating: boolean;
  isSessionReady: boolean;
  callbackError: string | null;
  onSubmitPassword: (password: string) => Promise<void>;
  onCancel: () => Promise<void>;
}

export const PasswordResetForm = ({
  mode = 'recovery',
  isValidating,
  isSessionReady,
  callbackError,
  onSubmitPassword,
  onCancel,
}: PasswordResetFormProps) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmittingRef.current) return;
    setError(null);

    if (!isSessionReady) {
      setError(
        mode === 'invite'
          ? 'A sessão do convite não está mais disponível. Solicite um novo convite ao gestor.'
          : 'A sessão de recuperação não está mais disponível. Solicite um novo link.',
      );
      return;
    }

    const validationError = mode === 'invite'
      ? validateEmployeePassword(newPassword)
      : validatePassword(newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('A confirmação não corresponde à nova senha.');
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await onSubmitPassword(newPassword);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : mode === 'invite'
          ? 'Não foi possível concluir o primeiro acesso.'
          : 'Não foi possível atualizar a senha.',
      );
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      await onCancel();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Não foi possível voltar ao login.');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const unavailableMessage = error || callbackError
    || (mode === 'invite'
      ? 'Este convite não possui uma sessão válida. Solicite um novo convite ao gestor.'
      : 'Este link não possui uma sessão de recuperação válida. Solicite um novo link.');
  const isInvite = mode === 'invite';

  return (
    <div className="login-card-container animate-fade-in-right">
      <div className="login-card">
        <div className="login-card-header">
          <img src={loginLogoImg} alt="Arkhen Gestão Contábil" className="card-logo-icon" />
          <h1 className="card-title">{isInvite ? 'Criar senha de acesso' : 'Criar nova senha'}</h1>
          <p className="card-subtitle">
            {isValidating
              ? isInvite
                ? 'Validando o convite seguro recebido por e-mail...'
                : 'Validando o link seguro recebido por e-mail...'
              : isSessionReady
              ? isInvite
                ? 'Crie sua senha para concluir o primeiro acesso ao sistema.'
                : 'Defina uma nova senha para concluir a recuperação da sua conta.'
              : isInvite
                ? 'O convite não pôde ser validado.'
                : 'O link de recuperação não pôde ser validado.'}
          </p>
        </div>

        {isValidating ? (
          <div className="login-form">
            <div role="status" className="success-message">
              {isInvite ? 'Validando seu convite...' : 'Validando seu link de recuperação...'}
            </div>
          </div>
        ) : !isSessionReady ? (
          <div className="login-form">
            <div role="alert" className="error-message">{unavailableMessage}</div>
            <button type="button" className="btn-primary" onClick={() => void handleCancel()} disabled={isSubmitting}>
              <ArrowLeft size={18} />
              {isInvite ? 'Voltar ao login' : 'Voltar e solicitar outro link'}
            </button>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            {error && <div role="alert" className="error-message">{error}</div>}

            <div className="form-group">
              <label htmlFor="newPassword" className="form-label">Nova senha</label>
              <div className="input-wrapper">
                <span className="input-icon"><Lock size={18} /></span>
                <input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Ocultar senhas' : 'Exibir senhas'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">Confirmar nova senha</label>
              <div className="input-wrapper">
                <span className="input-icon"><ShieldCheck size={18} /></span>
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <p className="card-subtitle">
              {isInvite
                ? EMPLOYEE_PASSWORD_REQUIREMENTS
                : 'Use pelo menos 6 caracteres, incluindo uma letra e um número.'}
            </p>

            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              <ShieldCheck size={18} />
              {isSubmitting
                ? 'SALVANDO...'
                : isInvite
                ? 'CRIAR SENHA E ATIVAR ACESSO'
                : 'SALVAR NOVA SENHA'}
            </button>

            <div className="back-to-login-container">
              <button
                type="button"
                className="back-to-login-link password-reset-back-button"
                onClick={() => void handleCancel()}
                disabled={isSubmitting}
              >
                <ArrowLeft size={16} />
                Cancelar e voltar ao login
              </button>
            </div>
          </form>
        )}

        <div className="login-card-footer">
          <ShieldCheck size={20} className="footer-secure-icon" />
          <div className="footer-secure-text">
            <strong>{isInvite ? 'Primeiro acesso protegido' : 'Recuperação protegida'}</strong>
            <span>
              {isInvite
                ? 'O acesso ao painel será liberado após a criação da sua senha.'
                : 'O acesso ao painel só será liberado depois que a nova senha for criada.'}
            </span>
          </div>
          <span className="app-version-badge">{CURRENT_RELEASE.label}</span>
        </div>
      </div>
    </div>
  );
};
