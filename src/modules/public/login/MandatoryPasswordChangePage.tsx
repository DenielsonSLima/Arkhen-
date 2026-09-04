import { useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { validateEmployeePassword, EMPLOYEE_PASSWORD_REQUIREMENTS } from '../../../lib/employeePasswordPolicy';
import loginLogoImg from '../../../assets/camada-o.png';
import { CURRENT_RELEASE } from '../../../internal/version/release';
import { LoginBanner } from './components/LoginBanner';
import './Login.css';
import './PasswordReset.css';

interface MandatoryPasswordChangePageProps {
  cpf?: string;
  onSubmitPassword: (password: string) => Promise<void>;
  onLogout: () => void;
}

export const MandatoryPasswordChangePage = ({
  cpf,
  onSubmitPassword,
  onLogout,
}: MandatoryPasswordChangePageProps) => {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submittingRef.current) return;
    setError(null);

    const passwordError = validateEmployeePassword(password, cpf);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmation) {
      setError('A confirmação não corresponde à nova senha.');
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await onSubmitPassword(password);
    } catch (submitError) {
      setError(submitError instanceof Error
        ? submitError.message
        : 'Não foi possível concluir o primeiro acesso.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-container animate-page-fade">
      <LoginBanner />
      <div className="login-card-container animate-fade-in-right">
        <div className="login-card">
          <div className="login-card-header">
            <img src={loginLogoImg} alt="Arkhen Gestão Contábil" className="card-logo-icon" />
            <h1 className="card-title">Crie sua senha definitiva</h1>
            <p className="card-subtitle">
              Por segurança, a senha temporária só permite concluir este primeiro acesso.
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            {error && <div role="alert" className="error-message">{error}</div>}

            <div className="form-group">
              <label htmlFor="mandatory-password" className="form-label">Nova senha</label>
              <div className="input-wrapper">
                <span className="input-icon"><KeyRound size={18} /></span>
                <input
                  id="mandatory-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  required
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
              <label htmlFor="mandatory-password-confirmation" className="form-label">
                Confirmar nova senha
              </label>
              <div className="input-wrapper">
                <span className="input-icon"><ShieldCheck size={18} /></span>
                <input
                  id="mandatory-password-confirmation"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>

            <p className="card-subtitle">{EMPLOYEE_PASSWORD_REQUIREMENTS}</p>

            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              <ShieldCheck size={18} />
              {isSubmitting ? 'SALVANDO...' : 'CRIAR SENHA E CONTINUAR'}
            </button>
            <div className="back-to-login-container">
              <button
                type="button"
                className="back-to-login-link password-reset-back-button"
                onClick={onLogout}
                disabled={isSubmitting}
              >
                <ArrowLeft size={16} /> Sair e voltar ao login
              </button>
            </div>
          </form>

          <div className="login-card-footer">
            <ShieldCheck size={20} className="footer-secure-icon" />
            <div className="footer-secure-text">
              <strong>Acesso restrito</strong>
              <span>Os dados da empresa serão liberados somente após esta troca.</span>
            </div>
            <span className="app-version-badge">{CURRENT_RELEASE.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
