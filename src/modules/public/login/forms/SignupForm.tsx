import React from 'react';
import { Building2, FileCheck2, User, Lock, Eye, EyeOff, LockKeyhole, Mail, ArrowLeft, UploadCloud, Phone } from 'lucide-react';
import { useLogin } from '../hooks/useLogin';
import { uploadImageAsset } from '../../../gestor/shared/uploadImageAsset';
import loginLogoImg from '../../../../assets/camada-o.png';
import signatureLogoImg from '../../../../assets/chatgpt-login.png';

interface SignupFormProps {
  loginState: ReturnType<typeof useLogin>;
  onLoginSuccess: () => void;
}

export const SignupForm: React.FC<SignupFormProps> = ({ loginState, onLoginSuccess }) => {
  const {
    signupNome,
    setSignupNome,
    signupEmpresa,
    setSignupEmpresa,
    signupCnpj,
    setSignupCnpj,
    signupEmail,
    setSignupEmail,
    signupSenha,
    setSignupSenha,
    signupConfirmSenha,
    setSignupConfirmSenha,
    signupLogoUrl,
    setSignupLogoUrl,
    signupWatermarkPaisagemUrl,
    setSignupWatermarkPaisagemUrl,
    signupWatermarkRetratoUrl,
    setSignupWatermarkRetratoUrl,
    signupCpf,
    setSignupCpf,
    signupTelefone,
    setSignupTelefone,
    isSearchingCnpj,
    handleLookupCnpj,
    showPassword,
    togglePasswordVisibility,
    isLoading,
    error,
    setError,
    successMessage,
    handleSignupSubmit,
    switchMode,
  } = loginState;

  const handleSubmit = async (e: React.FormEvent) => {
    const res = await handleSignupSubmit(e);
    if (res && res.success && !res.needsConfirmation) {
      onLoginSuccess();
    }
  };

  return (
    <>
      <div className="signup-page-card animate-fade-in">
        {/* Back Button */}
        <button
          onClick={() => switchMode('login')}
          className="signup-back-btn"
          title="Voltar para o Login"
        >
          <ArrowLeft size={16} /> Voltar para o login
        </button>

        {/* Header */}
        <div className="signup-page-header">
          <img src={loginLogoImg} alt="Brand Logo" className="signup-logo-icon" />
          <h2 className="signup-title">Criar Conta da sua Empresa</h2>
          <p className="signup-subtitle">
            Preencha as informações para ativar a sua empresa e configurar o usuário gestor administrador.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="signup-form-body">
          {error && <div className="error-message">{error}</div>}
          {successMessage && <div className="success-message">{successMessage}</div>}

          <div className="signup-columns-grid">
            {/* Coluna Esquerda: Dados da Empresa */}
            <div className="signup-col">
              <h3 className="signup-col-title">Dados da Empresa</h3>

              {/* CNPJ with Lookup Button */}
              <div className="form-group">
                <label htmlFor="signupCnpj" className="form-label">CNPJ</label>
                <div className="input-group-row">
                  <div className="input-wrapper" style={{ flex: 1 }}>
                    <span className="input-icon"><FileCheck2 size={18} /></span>
                    <input
                      id="signupCnpj"
                      type="text"
                      className="form-input"
                      placeholder="00.000.000/0000-00"
                      value={signupCnpj}
                      onChange={(e) => setSignupCnpj(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-search-cnpj"
                    onClick={handleLookupCnpj}
                    disabled={isLoading || isSearchingCnpj}
                  >
                    {isSearchingCnpj ? 'Buscando...' : 'Buscar CNPJ'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="signupEmpresa" className="form-label">Nome da Empresa</label>
                <div className="input-wrapper">
                  <span className="input-icon"><Building2 size={18} /></span>
                  <input
                    id="signupEmpresa"
                    type="text"
                    className="form-input"
                    placeholder="Razão social ou nome fantasia"
                    value={signupEmpresa}
                    onChange={(e) => setSignupEmpresa(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              {/* Upload Logo */}
              <div className="form-group">
                <label className="form-label">Logotipo da Empresa</label>
                <div className="signup-upload-box">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const url = await uploadImageAsset(file, 'logos', signupEmail || 'temp');
                          setSignupLogoUrl(url);
                        } catch (err: any) {
                          setError(err.message);
                        }
                      }
                    }}
                    className="signup-file-input"
                    id="logo-upload"
                  />
                  <label htmlFor="logo-upload" className="signup-upload-label">
                    {signupLogoUrl ? (
                      <img src={signupLogoUrl} alt="Logo" className="signup-upload-preview" />
                    ) : (
                      <>
                        <UploadCloud size={24} />
                        <span>Selecionar Logo da Empresa (PNG ou JPG)</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Watermarks (Landscape and Portrait) */}
              <div className="watermarks-upload-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label text-xs" style={{ fontSize: '0.75rem' }}>Marca d'Água (Paisagem)</label>
                  <div className="signup-upload-box small">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const url = await uploadImageAsset(file, 'watermarks-landscape', signupEmail || 'temp');
                            setSignupWatermarkPaisagemUrl(url);
                          } catch (err: any) {
                            setError(err.message);
                          }
                        }
                      }}
                      className="signup-file-input"
                      id="watermark-land-upload"
                    />
                    <label htmlFor="watermark-land-upload" className="signup-upload-label">
                      {signupWatermarkPaisagemUrl ? (
                        <img src={signupWatermarkPaisagemUrl} alt="Paisagem" className="signup-upload-preview" />
                      ) : (
                        <>
                          <UploadCloud size={18} />
                          <span>Selecionar Paisagem</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label text-xs" style={{ fontSize: '0.75rem' }}>Marca d'Água (Retrato)</label>
                  <div className="signup-upload-box small">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const url = await uploadImageAsset(file, 'watermarks-portrait', signupEmail || 'temp');
                            setSignupWatermarkRetratoUrl(url);
                          } catch (err: any) {
                            setError(err.message);
                          }
                        }
                      }}
                      className="signup-file-input"
                      id="watermark-port-upload"
                    />
                    <label htmlFor="watermark-port-upload" className="signup-upload-label">
                      {signupWatermarkRetratoUrl ? (
                        <img src={signupWatermarkRetratoUrl} alt="Retrato" className="signup-upload-preview" />
                      ) : (
                        <>
                          <UploadCloud size={18} />
                          <span>Selecionar Retrato</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna Direita: Dados do Usuário */}
            <div className="signup-col">
              <h3 className="signup-col-title">Dados do Usuário Gestor</h3>

              <div className="form-group">
                <label htmlFor="signupNome" className="form-label">Nome Completo</label>
                <div className="input-wrapper">
                  <span className="input-icon"><User size={18} /></span>
                  <input
                    id="signupNome"
                    type="text"
                    className="form-input"
                    placeholder="Nome completo do responsável"
                    value={signupNome}
                    onChange={(e) => setSignupNome(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="signupEmail" className="form-label">E-mail de Acesso</label>
                <div className="input-wrapper">
                  <span className="input-icon"><Mail size={18} /></span>
                  <input
                    id="signupEmail"
                    type="email"
                    className="form-input"
                    placeholder="exemplo@empresa.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="signupCpf" className="form-label">CPF</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><User size={18} /></span>
                    <input
                      id="signupCpf"
                      type="text"
                      className="form-input"
                      placeholder="000.000.000-00"
                      value={signupCpf}
                      onChange={(e) => setSignupCpf(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="signupTelefone" className="form-label">Telefone</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><Phone size={18} /></span>
                    <input
                      id="signupTelefone"
                      type="text"
                      className="form-input"
                      placeholder="(00) 00000-0000"
                      value={signupTelefone}
                      onChange={(e) => setSignupTelefone(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="signupSenha" className="form-label">Senha</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><Lock size={18} /></span>
                    <input
                      id="signupSenha"
                      type={showPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Crie sua senha"
                      value={signupSenha}
                      onChange={(e) => setSignupSenha(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="signupConfirmSenha" className="form-label">Confirmar Senha</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><Lock size={18} /></span>
                    <input
                      id="signupConfirmSenha"
                      type={showPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Repita a senha"
                      value={signupConfirmSenha}
                      onChange={(e) => setSignupConfirmSenha(e.target.value)}
                      disabled={isLoading}
                      required
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
                </div>
              </div>

              {/* Password Strength Checklist */}
              <div className="password-strength-container">
                <div className={`strength-requirement ${signupSenha.length >= 6 ? 'fulfilled' : ''}`}>
                  <span className="requirement-dot"></span>
                  <span className="requirement-text">Mínimo 6 caracteres</span>
                </div>
                <div className={`strength-requirement ${(signupSenha && /[a-zA-Z]/.test(signupSenha) && /[0-9]/.test(signupSenha)) ? 'fulfilled' : ''}`}>
                  <span className="requirement-dot"></span>
                  <span className="requirement-text">Letras e números</span>
                </div>
                <div className={`strength-requirement ${(signupSenha && signupSenha === signupConfirmSenha) ? 'fulfilled' : ''}`}>
                  <span className="requirement-dot"></span>
                  <span className="requirement-text">Senhas coincidem</span>
                </div>
              </div>
            </div>
          </div>

          <button type="submit" className="signup-submit-btn" disabled={isLoading}>
            {isLoading ? 'CRIANDO CONTA...' : 'CRIAR CADASTRO DA EMPRESA'}
          </button>
        </form>

        {/* Footer secure info */}
        <div className="signup-page-footer">
          <div className="signup-secure-info">
            <LockKeyhole size={18} className="footer-secure-icon" />
            <div className="footer-secure-text">
              <strong>Ambiente criptografado e seguro</strong>
              <span>Seus dados de cadastro estão protegidos com segurança de ponta a ponta.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dailabs Brand placed in the background of the screen */}
      <div className="signup-developer-signature animate-fade-in">
        <img src={signatureLogoImg} alt="DAILABS" className="signup-signature-icon" />
        <div className="signup-signature-copy">
          <span className="signup-signature-brand">DAILABS</span>
          <span className="signup-signature-text">CREATIVE AI & SOFTWARE</span>
        </div>
      </div>
    </>
  );
};
