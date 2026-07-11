import { useState, type FormEvent } from 'react';
import { DEMO_AUTH, loginService, type LoginResponse } from '../services/loginService';

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
    showPassword,
    togglePasswordVisibility,
    isLoading,
    error,
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
