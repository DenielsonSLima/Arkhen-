import React from 'react';
import { LoginBanner } from './components/LoginBanner';
import { LoginForm } from './forms/LoginForm';
import { SignupForm } from './forms/SignupForm';
import { useLogin } from './hooks/useLogin';
import './Login.css';

interface LoginPageProps {
  onLoginSuccess: () => void;
  onBackToLanding?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onBackToLanding }) => {
  const loginState = useLogin();

  React.useEffect(() => {
    document.title = loginState.isSigningUp 
      ? 'Criar Conta | Arkhen Gestão Contábil' 
      : 'Entrar | Arkhen Gestão Contábil';
  }, [loginState.isSigningUp]);

  if (loginState.isSigningUp) {
    return (
      <div className="signup-page-container">
        <SignupForm 
          loginState={loginState} 
          onLoginSuccess={onLoginSuccess} 
        />
      </div>
    );
  }

  return (
    <div className="login-container">
      {/* Left side: Banner branding and details */}
      <LoginBanner />

      {/* Right side: Login white floating card */}
      <LoginForm 
        loginState={loginState} 
        onLoginSuccess={onLoginSuccess} 
        onBackToLanding={onBackToLanding} 
      />
    </div>
  );
};
