import React, { useState } from 'react';
import { Lock, Eye, EyeOff, KeyRound, LockKeyhole } from 'lucide-react';
import loginLogoImg from '../../../../assets/camada-o.png';
import signatureLogoImg from '../../../../assets/chatgpt-login.png';

interface SharedDocumentUnlockFormProps {
  onUnlock: (password: string) => Promise<void>;
  error?: string;
  empresaNome: string;
  empresaLogo?: string | null;
}

export const SharedDocumentUnlockForm: React.FC<SharedDocumentUnlockFormProps> = ({
  onUnlock,
  error,
  empresaNome,
  empresaLogo,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password.trim() || isLoading) return;
    setIsLoading(true);
    try {
      await onUnlock(password);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-card-container animate-fade-in-right" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
      <div className="login-card" style={{ width: '100%', maxWidth: '440px', boxSizing: 'border-box' }}>
        <div className="login-card-header">
          {empresaLogo ? (
            <img 
              src={empresaLogo} 
              alt={empresaNome} 
              className="card-logo-icon" 
            />
          ) : (
            <img 
              src={loginLogoImg} 
              alt="Brand Logo" 
              className="card-logo-icon" 
            />
          )}
          <h2 className="card-title" style={{ fontSize: '1.45rem', marginTop: '10px' }}>
            Arquivo Protegido
          </h2>
          <p className="card-subtitle">
            Este link compartilhado por <strong>{empresaNome}</strong> exige senha para acesso.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label className="form-label" htmlFor="sharePassword">
              Senha de Acesso
            </label>
            <div className="input-wrapper">
              <span className="input-icon">
                <Lock size={18} />
              </span>
              <input
                id="sharePassword"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="Insira a senha do link"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={isLoading || !password.trim()}
            style={{ marginTop: '12px' }}
          >
            <KeyRound size={16} />
            {isLoading ? 'Verificando...' : 'Desbloquear Acesso'}
          </button>
        </form>

        <div className="login-card-footer">
          <span className="footer-secure-icon">
            <LockKeyhole size={18} style={{ color: 'var(--color-gold-primary)' }} />
          </span>
          <div className="footer-secure-text">
            <strong>Ambiente seguro e criptografado</strong>
            <span>Os arquivos correspondentes a este link estão protegidos por criptografia de ponta a ponta.</span>
          </div>
        </div>
      </div>

      <div className="developer-signature">
        <img src={signatureLogoImg} alt="Dailabs Logo" className="developer-signature-icon" />
        <div className="developer-signature-copy">
          <span className="developer-signature-brand">DAILABS</span>
          <span className="developer-signature-subtitle">CREATIVE AI & SOFTWARES</span>
        </div>
      </div>
    </div>
  );
};
