import React from 'react';
import { Building2, User, Lock, Eye, EyeOff, LogIn, LockKeyhole, Mail, ArrowLeft } from 'lucide-react';
import { useLogin } from '../hooks/useLogin';
import loginLogoImg from '../../../../assets/camada-o.png';
import signatureLogoImg from '../../../../assets/chatgpt-login.png';

interface LoginFormProps {
  loginState: ReturnType<typeof useLogin>;
  onLoginSuccess: () => void;
  onBackToLanding?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ loginState, onLoginSuccess, onBackToLanding }) => {
  const {
    usuario,
    setUsuario,
    senha,
    setSenha,
    showPassword,
    togglePasswordVisibility,
    isLoading,
    error,
    accessBlockMessage,
    setAccessBlockMessage,
    successMessage,
    isRecovering,
    switchMode,
    recoveryEmail,
    setRecoveryEmail,
    handleLogin,
    handleRecoverySubmit,
    handleGoogleLogin,
    resetStates,
  } = loginState;

  const handleSubmit = async (e: React.FormEvent) => {
    const res = await handleLogin(e);
    if (res && res.success) {
      onLoginSuccess();
    }
  };

  const handleToggleToRecovery = (e: React.MouseEvent) => {
    e.preventDefault();
    resetStates();
    switchMode('recovery');
  };

  const handleToggleToLogin = (e: React.MouseEvent) => {
    e.preventDefault();
    resetStates();
    switchMode('login');
  };

  const handleToggleToSignup = (e: React.MouseEvent) => {
    e.preventDefault();
    resetStates();
    switchMode('signup');
  };

  return (
    <div className="login-card-container animate-fade-in-right">
      {accessBlockMessage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.64)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              width: 'min(430px, 100%)',
              background: '#ffffff',
              border: '1px solid rgba(197, 146, 53, 0.42)',
              borderRadius: '12px',
              boxShadow: '0 28px 80px rgba(0, 0, 0, 0.28)',
              padding: '24px',
            }}
          >
            <h3 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: '1.18rem', fontWeight: 850 }}>
              Acesso fora do período permitido
            </h3>
            <p style={{ margin: 0, color: '#64748b', lineHeight: 1.6, fontSize: '0.92rem' }}>
              {accessBlockMessage}
            </p>
            <button
              type="button"
              className="btn-primary"
              style={{ marginTop: '18px', width: '100%' }}
              onClick={() => setAccessBlockMessage(null)}
            >
              Entendi
            </button>
          </div>
        </div>
      )}
      <div className="login-card">
        {/* Logo Header */}
        <div className="login-card-header" style={{ position: 'relative' }}>
          {onBackToLanding && (
            <button 
              onClick={onBackToLanding}
              style={{
                position: 'absolute',
                top: '-10px',
                left: '-10px',
                background: 'none',
                border: 'none',
                color: '#888888',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'color 0.2s',
                padding: '8px'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = '#c59235'}
              onMouseOut={(e) => e.currentTarget.style.color = '#888888'}
            >
              <ArrowLeft size={14} /> Voltar ao site
            </button>
          )}
          <img 
            src={loginLogoImg} 
            alt="Brand Logo" 
            className="card-logo-icon" 
            style={{ cursor: onBackToLanding ? 'pointer' : 'default' }}
            onClick={onBackToLanding}
          />
          <h2 className="card-title">
            {isRecovering ? 'Recuperar Senha' : 'Bem-vindo de volta!'}
          </h2>
          <p className="card-subtitle">
            {isRecovering
              ? 'Digite seu e-mail para receber as instruções de recuperação'
              : 'Acesse sua conta para continuar'}
          </p>
        </div>

        {/* Dynamic Forms */}
        {isRecovering ? (
          /* PASSWORD RECOVERY FORM */
          <form onSubmit={handleRecoverySubmit} className="login-form">
            {error && <div className="error-message">{error}</div>}
            {successMessage && <div className="success-message">{successMessage}</div>}

            <div className="form-group">
              <label htmlFor="recoveryEmail" className="form-label">
                E-mail
              </label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <Mail size={18} />
                </span>
                <input
                  id="recoveryEmail"
                  type="email"
                  className="form-input"
                  placeholder="Digite seu e-mail cadastrado"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? 'ENVIANDO...' : 'ENVIAR INSTRUÇÕES'}
            </button>

            <div className="back-to-login-container">
              <a href="#login" className="back-to-login-link" onClick={handleToggleToLogin}>
                <ArrowLeft size={16} />
                Voltar para o login
              </a>
            </div>
          </form>
        ) : (
          /* NORMAL LOGIN FORM */
          <>
            <form onSubmit={handleSubmit} className="login-form">
              {error && <div className="error-message">{error}</div>}

              {/* User Input */}
              <div className="form-group">
                <label htmlFor="usuario" className="form-label">
                  Usuário
                </label>
                <div className="input-wrapper">
                  <span className="input-icon">
                    <User size={18} />
                  </span>
                  <input
                    id="usuario"
                    type="email"
                    className="form-input"
                    placeholder="Digite seu e-mail"
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="form-group">
                <label htmlFor="senha" className="form-label">
                  Senha
                </label>
                <div className="input-wrapper">
                  <span className="input-icon">
                    <Lock size={18} />
                  </span>
                  <input
                    id="senha"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Digite sua senha"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={togglePasswordVisibility}
                    aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="forgot-password-container">
                  <a href="#recuperar" className="forgot-password-link" onClick={handleToggleToRecovery}>
                    Esqueci minha senha
                  </a>
                </div>
              </div>

              {/* Main Submit Button */}
              <button type="submit" className="btn-primary" disabled={isLoading}>
                <LogIn size={18} className="btn-icon" />
                {isLoading ? 'ACESSANDO...' : 'ACESSAR SISTEMA'}
              </button>
            </form>

            {successMessage && <div className="success-message" style={{ marginTop: '12px' }}>{successMessage}</div>}

            {/* Separator */}
            <div className="form-separator">
              <span className="separator-text">ou</span>
            </div>

            <button
              type="button"
              className="btn-google"
              onClick={handleToggleToSignup}
              disabled={isLoading}
            >
              <Building2 size={18} />
              Criar empresa e usuário
            </button>

            {/* Google Sign-in Button */}
            <button
              type="button"
              className="btn-google"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <svg className="google-icon" width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.797 2.717v2.258h2.909c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.909-2.258c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.938 5.482 18 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.177 0 7.549 0 9s.347 2.823.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.32 0 2.507.454 3.44 1.347l2.58-2.58C13.46 1.087 11.423 0 9 0 5.482 0 2.438 2.062.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Fazer login com o Google
            </button>
          </>
        )}

        {/* Footer info */}
        <div className="login-card-footer">
          <LockKeyhole size={18} className="footer-secure-icon" />
          <div className="footer-secure-text">
            <strong>Ambiente seguro e certificado</strong>
            <span>Seus dados estão protegidos com criptografia de ponta a ponta.</span>
          </div>
        </div>
      </div>
      <div className="developer-signature">
        <img
          src={signatureLogoImg}
          alt="DAILABS"
          className="developer-signature-icon"
        />
        <div className="developer-signature-copy">
          <span className="developer-signature-brand">DAILABS</span>
          <span className="developer-signature-subtitle">CREATIVE AI & SOFTWARES</span>
        </div>
      </div>
    </div>
  );
};
