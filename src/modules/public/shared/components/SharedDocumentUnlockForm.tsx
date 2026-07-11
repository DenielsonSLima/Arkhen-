import React, { useState } from 'react';
import { Lock, Eye, EyeOff, KeyRound, LockKeyhole, Loader2 } from 'lucide-react';
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
    <div 
      className="login-card-container animate-fade-in-right" 
      style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        boxSizing: 'border-box',
        backgroundColor: '#f1f5f9', /* Fundo cinza claro exato */
        position: 'relative',
        overflow: 'hidden',
        padding: '20px'
      }}
    >
      {/* 1. Canto Superior Esquerdo: Logo Arkhen */}
      <div style={{ position: 'absolute', top: '30px', left: '30px', zIndex: 10, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img src={loginLogoImg} alt="Logo Arkhen" style={{ width: '38px', height: '38px', objectFit: 'contain' }} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, textAlign: 'left' }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#090b0e', letterSpacing: '1px' }}>Arkhen</span>
          <span style={{ fontSize: '0.7rem', color: '#c59235', fontWeight: 600, letterSpacing: '0.5px' }}>Gestão Contábil</span>
        </div>
      </div>

      {/* 2. Card de Desbloqueio Branco */}
      <div 
        className="login-card" 
        style={{ 
          width: '100%', 
          maxWidth: '440px', 
          boxSizing: 'border-box',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.05)',
          padding: '40px 30px',
          zIndex: 5
        }}
      >
        <div className="login-card-header" style={{ textAlign: 'center', marginBottom: '24px' }}>
          {empresaLogo ? (
            <img 
              src={empresaLogo} 
              alt={empresaNome} 
              style={{ 
                width: '80px', 
                height: '80px', 
                borderRadius: '50%', /* Circular exato */
                objectFit: 'contain', 
                background: '#ffffff', 
                border: '1.5px solid #e2e8f0', 
                padding: '4px',
                boxShadow: '0 4px 10px rgba(0,0,0,0.03)',
                display: 'block',
                margin: '0 auto 16px auto'
              }} 
            />
          ) : (
            <div 
              style={{ 
                width: '80px', 
                height: '80px', 
                borderRadius: '50%', /* Circular exato */
                background: '#eff6ff', 
                border: '1.5px solid #bfdbfe', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: '#2563eb',
                boxShadow: '0 4px 10px rgba(0,0,0,0.03)',
                margin: '0 auto 16px auto'
              }}
            >
              <Lock size={36} />
            </div>
          )}
          <h2 className="card-title" style={{ fontSize: '1.45rem', marginTop: '10px', color: '#0f172a', fontWeight: 800 }}>
            Arquivo Protegido
          </h2>
          <p className="card-subtitle" style={{ fontSize: '0.86rem', color: '#64748b', marginTop: '6px', lineHeight: 1.4 }}>
            Este link compartilhado por <strong>{empresaNome}</strong> exige senha para acesso.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message" style={{ backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2', borderRadius: '8px', padding: '10px', fontSize: '0.8rem', marginBottom: '16px', fontWeight: 600 }}>{error}</div>}

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" htmlFor="sharePassword" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
              Senha de Acesso
            </label>
            <div className="input-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span className="input-icon" style={{ position: 'absolute', left: '12px', color: '#94a3b8' }}>
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
                style={{
                  width: '100%',
                  padding: '12px 40px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: '#0f172a',
                  transition: 'border-color 0.2s'
                }}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={isLoading || !password.trim()}
            style={{ 
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background 0.2s'
            }}
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            {isLoading ? 'Verificando...' : 'Desbloquear Acesso'}
          </button>
        </form>

        <div className="login-card-footer" style={{ display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f1f5f9', alignItems: 'flex-start' }}>
          <span className="footer-secure-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: '#f0fdf4', color: '#16a34a', minWidth: '32px' }}>
            <LockKeyhole size={16} />
          </span>
          <div className="footer-secure-text" style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', lineHeight: 1.35 }}>
            <strong style={{ fontSize: '0.78rem', color: '#1e293b', fontWeight: 700 }}>Ambiente seguro e criptografado</strong>
            <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>Os arquivos correspondentes a este link estão protegidos por criptografia de ponta a ponta.</span>
          </div>
        </div>
      </div>

      {/* 3. Rodapé Centralizado com copyright */}
      <div style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 1, color: '#64748b', fontSize: '0.74rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
        <span>© 2026 | Arkhen Gestão Contábil</span>
      </div>

      {/* 4. Assinatura Dailabs no canto inferior direito da tela (cor escura sobre o fundo claro!) */}
      <div className="developer-signature" style={{ color: '#0f172a', opacity: 0.8, right: '30px', bottom: '24px', position: 'absolute', zIndex: 1 }}>
        <img src={signatureLogoImg} alt="Dailabs Logo" className="developer-signature-icon" />
        <div className="developer-signature-copy">
          <span className="developer-signature-brand" style={{ color: '#0f172a' }}>DAILABS</span>
          <span className="developer-signature-subtitle" style={{ fontSize: '0.6rem', letterSpacing: '0.8px', color: '#475569' }}>CREATIVE AI & SOFTWARES</span>
        </div>
      </div>
    </div>
  );
};
