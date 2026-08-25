import { useEffect } from 'react';
import { LoginBanner } from './components/LoginBanner';
import { PasswordResetForm } from './forms/PasswordResetForm';
import './Login.css';
import './PasswordReset.css';

interface PasswordResetPageProps {
  isValidating: boolean;
  isSessionReady: boolean;
  callbackError: string | null;
  onSubmitPassword: (password: string) => Promise<void>;
  onCancel: () => Promise<void>;
}

export const PasswordResetPage = (props: PasswordResetPageProps) => {
  useEffect(() => {
    document.title = 'Criar nova senha | Arkhen Gestão Contábil';
  }, []);

  return (
    <div className="login-container">
      <LoginBanner />
      <PasswordResetForm {...props} />
    </div>
  );
};
