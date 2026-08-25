import { useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { LoginBanner } from './components/LoginBanner';
import loginLogoImg from '../../../assets/camada-o.png';
import { CURRENT_RELEASE } from '../../../internal/version/release';
import './Login.css';

interface PasswordResetSuccessPageProps {
  onContinue: () => Promise<void>;
}

export const PasswordResetSuccessPage = ({ onContinue }: PasswordResetSuccessPageProps) => {
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
            <h1 className="card-title">Senha alterada</h1>
            <p className="card-subtitle">
              Sua nova senha foi criada com sucesso. Agora você pode usá-la para entrar no sistema.
            </p>
          </div>

          {error && <div role="alert" className="error-message">{error}</div>}
          <div role="status" className="success-message">Recuperação concluída com segurança.</div>

          <button type="button" className="btn-primary" onClick={() => void handleContinue()} disabled={isContinuing}>
            <ArrowRight size={18} />
            {isContinuing ? 'ABRINDO LOGIN...' : 'IR PARA O LOGIN'}
          </button>

          <div className="login-card-footer">
            <ShieldCheck size={20} className="footer-secure-icon" />
            <div className="footer-secure-text">
              <strong>Sessão de recuperação encerrada</strong>
              <span>Esta aba não mantém mais o acesso temporário do link.</span>
            </div>
            <span className="app-version-badge">{CURRENT_RELEASE.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
