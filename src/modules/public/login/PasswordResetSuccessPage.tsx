import { useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { LoginBanner } from './components/LoginBanner';
import loginLogoImg from '../../../assets/camada-o.png';
import { CURRENT_RELEASE } from '../../../internal/version/release';
import type { PasswordSetupMode } from './services/passwordRecoveryService';
import './Login.css';

interface PasswordResetSuccessPageProps {
  mode?: PasswordSetupMode;
  onContinue: () => Promise<void>;
}

export const PasswordResetSuccessPage = ({ mode = 'recovery', onContinue }: PasswordResetSuccessPageProps) => {
  const [isContinuing, setIsContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    setIsContinuing(true);
    setError(null);
    try {
      await onContinue();
    } catch (continueError) {
      setError(continueError instanceof Error ? continueError.message : 'Não foi possível abrir o login.');
      setIsContinuing(false);
    }
  };

  return (
    <div className="login-container">
      <LoginBanner />
      <div className="login-card-container animate-fade-in-right">
        <div className="login-card">
          <div className="login-card-header">
            <img src={loginLogoImg} alt="Arkhen Gestão Contábil" className="card-logo-icon" />
            <h1 className="card-title">{mode === 'invite' ? 'Acesso ativado' : 'Senha alterada'}</h1>
            <p className="card-subtitle">
              {mode === 'invite'
                ? 'Sua senha foi criada com sucesso. Agora você pode entrar no sistema.'
                : 'Sua nova senha foi criada com sucesso. Agora você pode usá-la para entrar no sistema.'}
            </p>
          </div>

          {error && <div role="alert" className="error-message">{error}</div>}
          <div role="status" className="success-message">
            {mode === 'invite'
              ? 'Primeiro acesso concluído com segurança.'
              : 'Recuperação concluída com segurança.'}
          </div>

          <button type="button" className="btn-primary" onClick={() => void handleContinue()} disabled={isContinuing}>
            <ArrowRight size={18} />
            {isContinuing ? 'ABRINDO LOGIN...' : 'IR PARA O LOGIN'}
          </button>

          <div className="login-card-footer">
            <ShieldCheck size={20} className="footer-secure-icon" />
            <div className="footer-secure-text">
              <strong>
                {mode === 'invite' ? 'Sessão do convite encerrada' : 'Sessão de recuperação encerrada'}
              </strong>
              <span>Esta aba não mantém mais o acesso temporário do link.</span>
            </div>
            <span className="app-version-badge">{CURRENT_RELEASE.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
