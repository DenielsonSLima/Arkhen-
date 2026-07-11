import { useState, type FormEvent } from 'react';
import { DEMO_AUTH, loginService, type LoginResponse } from '../services/loginService';
import { cnpjLookupService } from '../../../gestor/gestao-empresarial/services/cnpjLookupService';

export type LoginMode = 'login' | 'signup' | 'recovery';

export const useLogin = () => {
  const [mode, setMode] = useState<LoginMode>('login');
  const [usuario, setUsuario] = useState(DEMO_AUTH.email);
  const [senha, setSenha] = useState(DEMO_AUTH.senha);
  const [signupNome, setSignupNome] = useState(DEMO_AUTH.nome);
  const [signupEmpresa, setSignupEmpresa] = useState(DEMO_AUTH.empresaNome);
  const [signupCnpj, setSignupCnpj] = useState(DEMO_AUTH.cnpj);
  const [signupEmail, setSignupEmail] = useState(DEMO_AUTH.email);
  const [signupSenha, setSignupSenha] = useState(DEMO_AUTH.senha);
  const [signupLogoUrl, setSignupLogoUrl] = useState('');
  const [signupWatermarkPaisagemUrl, setSignupWatermarkPaisagemUrl] = useState('');
  const [signupWatermarkRetratoUrl, setSignupWatermarkRetratoUrl] = useState('');
  const [signupCpf, setSignupCpf] = useState('');
  const [signupTelefone, setSignupTelefone] = useState('');
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessBlockMessage, setAccessBlockMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [recoveryEmail, setRecoveryEmail] = useState(DEMO_AUTH.email);

  const isRecovering = mode === 'recovery';
  const isSigningUp = mode === 'signup';

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const handleLogin = async (e: FormEvent): Promise<LoginResponse | null> => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const response = await loginService.autenticar({
        usuario: usuario.trim(),
        senha,
        role: 'gestor',
      });

      if (!response.success) {
        if (response.blockedByAccess) setAccessBlockMessage(response.message);
        else setError(response.message);
      }
      return response;
    } catch {
      setError('Ocorreu um erro ao tentar realizar o login. Tente novamente.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupSubmit = async (e: FormEvent): Promise<LoginResponse | null> => {
    e.preventDefault();
    setError(null);
    setAccessBlockMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const response = await loginService.cadastrar({
        nome: signupNome,
        empresaNome: signupEmpresa,
        cnpj: signupCnpj,
        email: signupEmail,
        senha: signupSenha,
        logoUrl: signupLogoUrl,
        watermarkPaisagemUrl: signupWatermarkPaisagemUrl,
        watermarkRetratoUrl: signupWatermarkRetratoUrl,
        cpf: signupCpf,
        telefone: signupTelefone,
      });

      if (!response.success) {
        setError(response.message);
        return response;
      }

      setSuccessMessage(response.message);
      if (response.needsConfirmation) {
        setMode('login');
        setUsuario(signupEmail);
        setSenha(signupSenha);
      }
      return response;
    } catch {
      setError('Ocorreu um erro ao criar o cadastro. Tente novamente.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoverySubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!recoveryEmail.trim()) {
      setError('Por favor, informe seu e-mail de recuperação.');
      return;
    }

    setIsLoading(true);

    try {
      await loginService.recuperarSenha(recoveryEmail.trim());
      setSuccessMessage('E-mail enviado. Verifique sua caixa de entrada para resetar a senha.');
    } catch {
      setError('Erro ao enviar e-mail de recuperação. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      await loginService.loginGoogle();
    } catch {
      setError('Erro ao iniciar login com Google. Verifique a configuração do provedor no Supabase.');
      setIsLoading(false);
    }
  };

  const resetStates = () => {
    setError(null);
    setAccessBlockMessage(null);
    setSuccessMessage(null);
  };

  const switchMode = (nextMode: LoginMode) => {
    resetStates();
    setMode(nextMode);
  };

  const handleLookupCnpj = async () => {
    const cleanCnpj = signupCnpj.replace(/\D/g, '');
    if (!cleanCnpj || cleanCnpj.length !== 14) {
      setError('Informe um CNPJ válido com 14 dígitos para busca.');
      return;
    }
    setError(null);
    setIsSearchingCnpj(true);
    try {
      const data = await cnpjLookupService.lookup(cleanCnpj);
      setSignupEmpresa(data.razaoSocial || data.nome || '');
      if (data.email) setSignupEmail(data.email);
      if (data.telefone) setSignupTelefone(data.telefone);
      setSuccessMessage('Dados da empresa carregados com sucesso!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar CNPJ.');
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  return {
    mode,
    switchMode,
    usuario,
    setUsuario,
    senha,
    setSenha,
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
    accessBlockMessage,
    setAccessBlockMessage,
    successMessage,
    isRecovering,
    isSigningUp,
    recoveryEmail,
    setRecoveryEmail,
    handleLogin,
    handleSignupSubmit,
    handleRecoverySubmit,
    handleGoogleLogin,
    resetStates,
  };
};
