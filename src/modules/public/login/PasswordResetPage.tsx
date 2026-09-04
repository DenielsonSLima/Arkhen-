import { useEffect } from 'react';
import { LoginBanner } from './components/LoginBanner';
import { PasswordResetForm } from './forms/PasswordResetForm';
import type { PasswordSetupMode } from './services/passwordRecoveryService';
import './Login.css';
import './PasswordReset.css';

interface PasswordResetPageProps {
  mode: PasswordSetupMode;
  isValidating: boolean;
  isSessionReady: boolean;
  callbackError: string | null;
  onSubmitPassword: (password: string) => Promise<void>;
  onCancel: () => Promise<void>;
}

export const PasswordResetPage = (props: PasswordResetPageProps) => {
  useEffect(() => {
    document.title = props.mode === 'invite'
      ? 'Ativar acesso | Arkhen Gestão Contábil'
      : 'Criar nova senha | Arkhen Gestão Contábil';
  }, [props.mode]);

  return (
    <div className="login-container">
      <LoginBanner />
      <PasswordResetForm {...props} />
    </div>
  );
};
