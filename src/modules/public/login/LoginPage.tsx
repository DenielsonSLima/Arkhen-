import React from 'react';
import { LoginBanner } from './components/LoginBanner';
import { LoginForm } from './forms/LoginForm';
import './Login.css';

interface LoginPageProps {
  onLoginSuccess: () => void;
  onBackToLanding?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onBackToLanding }) => {
  React.useEffect(() => {
    document.title = 'Entrar | ARKHEN Gestão Contábil';
  }, []);

  return (
    <div className="login-container">
      {/* Left side: Banner branding and details */}
      <LoginBanner />

      {/* Right side: Login white floating card */}
      <LoginForm onLoginSuccess={onLoginSuccess} onBackToLanding={onBackToLanding} />
    </div>
  );
};
