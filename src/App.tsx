import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { LoginPage } from './modules/public/login/LoginPage';
import { PasswordRecoveryGate } from './modules/public/login/PasswordRecoveryGate';
import { PublicSharedDocumentPage } from './modules/public/shared/PublicSharedDocumentPage';
import { PublicCobrancaPage } from './modules/public/cobranca/PublicCobrancaPage';
import { GestorLayout } from './modules/gestor/layout/GestorLayout';
import { GestorShellLoading } from './modules/gestor/layout/GestorShellLoading';
import { GestorErrorBoundary } from './modules/gestor/layout/GestorErrorBoundary';
import { useConfiguracoesRealtime } from './modules/gestor/configuracoes/hooks/useConfiguracoesRealtime';
import { usePersistedStorageRealtime } from './modules/gestor/configuracoes/hooks/usePersistedStorageRealtime';
import { internalTabsStore } from './stores/internalTabsStore';
import { getInitialAuthLocation, supabase } from './lib/supabase';
import { loginService } from './modules/public/login/services/loginService';
import { persistedStorage } from './lib/persistedStorage';
import { LandingPage } from './modules/public/landing/LandingPage';
import { DemoWebsite } from './modules/public/demowebsite/DemoWebsite';
import { navigate } from './lib/navigation';
import { queryClient } from './lib/queryClient';
import { useCurrentPath } from './hooks/useCurrentPath';
import {
  inspectPasswordRecoveryCallback,
  passwordRecoveryService,
  PASSWORD_RECOVERY_PATH,
  PASSWORD_RECOVERY_SESSION_ERROR,
  type PasswordRecoverySession,
} from './modules/public/login/services/passwordRecoveryService';
import { syncAuthenticatedUserProfile } from './modules/public/login/services/syncAuthenticatedUserProfile';

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
type PasswordRecoveryStatus = 'validating' | 'ready' | 'error' | 'complete';

function App() {
  const currentPath = useCurrentPath();
  const initialPasswordRecovery = useRef(inspectPasswordRecoveryCallback(getInitialAuthLocation() || undefined));
  const isSharedDocumentRoute = /^(?:\/shared|\/s)(?:\/|$)/.test(currentPath);
  const isPublicCobrancaRoute = /^\/cobranca(?:\/|$)/.test(currentPath);
  const isLoginOrSignupRoute = currentPath === '/login' || currentPath === '/signup';
  const isPasswordResetRoute = currentPath === PASSWORD_RECOVERY_PATH;
  const isDemoWebsiteRoute = currentPath === '/demo-publico';
  const [view, setView] = useState<'loading' | 'login' | 'password-reset' | 'gestor'>('loading');
  const [authError, setAuthError] = useState<string | null>(null);
  const [passwordRecoveryStatus, setPasswordRecoveryStatus] = useState<PasswordRecoveryStatus>('validating');
  const [passwordRecoveryError, setPasswordRecoveryError] = useState<string | null>(
    initialPasswordRecovery.current.errorMessage,
  );
  const viewRef = useRef(view);
  const authenticatedUserIdRef = useRef<string | null>(null);
  const passwordRecoveryContextRef = useRef(initialPasswordRecovery.current.isRecovery);
  const passwordRecoverySessionRef = useRef<PasswordRecoverySession | null>(null);
  const authFlowGenerationRef = useRef(0);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useConfiguracoesRealtime(view === 'gestor');
  usePersistedStorageRealtime(view === 'gestor');
  useEffect(() => {
    let mounted = true;
    let authStateTimer: number | undefined;

    const invalidatePendingAuthentication = () => {
      authFlowGenerationRef.current += 1;
      window.clearTimeout(authStateTimer);
      authStateTimer = undefined;
      authenticatedUserIdRef.current = null;
    };
    const clearLocalAuthentication = () => {
      authenticatedUserIdRef.current = null;
      queryClient.clear();
      persistedStorage.removeItem('contabil_auth');
      persistedStorage.removeItem('gestor_user_profile');
    };
    const showLogin = () => {
      invalidatePendingAuthentication();
      clearLocalAuthentication();
      passwordRecoveryContextRef.current = false;
      passwordRecoverySessionRef.current = null;
      setPasswordRecoveryStatus('error');
      setPasswordRecoveryError(null);
      viewRef.current = 'login';
      setView('login');
    };
    const showPasswordRecovery = (
      status: PasswordRecoveryStatus,
      errorMessage: string | null = null,
    ) => {
      invalidatePendingAuthentication();
      queryClient.clear();
      persistedStorage.resetLocalContext();
      passwordRecoveryContextRef.current = true;
      setPasswordRecoveryStatus(status);
      setPasswordRecoveryError(errorMessage);
      setAuthError(null);
      if (window.location.pathname !== PASSWORD_RECOVERY_PATH) navigate(PASSWORD_RECOVERY_PATH);
      viewRef.current = 'password-reset';
      setView('password-reset');
    };
    const handleBootstrapFailure = async (error: unknown) => {
      console.error('Erro ao preparar a conta autenticada:', error);
      if (!mounted || passwordRecoveryContextRef.current) return;
      setAuthError(error instanceof Error ? error.message : 'Não foi possível preparar sua conta. Tente entrar novamente.');
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (signOutError) {
        console.error('Erro ao encerrar sessão incompleta:', signOutError);
      }
      if (mounted) {
        if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
          navigate('/login');
        }
        showLogin();
      }
    };
    const activateAuthenticatedUser = async (user: User, generation: number) => {
      if (generation !== authFlowGenerationRef.current
        || passwordRecoveryContextRef.current
        || window.location.pathname === PASSWORD_RECOVERY_PATH) return;
      authenticatedUserIdRef.current = user.id;
      queryClient.clear();
      const authorization = await loginService.authorizeAuthenticatedUser(user);
      if (!mounted
        || generation !== authFlowGenerationRef.current
        || passwordRecoveryContextRef.current
        || window.location.pathname === PASSWORD_RECOVERY_PATH
        || authenticatedUserIdRef.current !== user.id) return;
      if (!authorization.allowed) {
        throw new Error(authorization.message);
      }
      syncAuthenticatedUserProfile(user);
      persistedStorage.setItem('contabil_auth', 'gestor');
      setAuthError(null);
      viewRef.current = 'gestor';
      setView('gestor');
    };

    const bootstrapMainSession = async () => {
      const bootstrapGeneration = authFlowGenerationRef.current;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted
          || bootstrapGeneration !== authFlowGenerationRef.current
          || passwordRecoveryContextRef.current) return;
        if (error || !data.session) {
          try {
            showLogin();
          } catch (storageError) {
            console.error('Erro ao remover auth persistido:', storageError);
            viewRef.current = 'login';
            setView('login');
          }
          return;
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (!mounted
          || bootstrapGeneration !== authFlowGenerationRef.current
          || passwordRecoveryContextRef.current) return;
        if (userError || !userData.user) {
          await handleBootstrapFailure(userError || new Error('Sessão autenticada inválida.'));
          return;
        }
        await activateAuthenticatedUser(userData.user, bootstrapGeneration);
      } catch (error) {
        if (!mounted
          || bootstrapGeneration !== authFlowGenerationRef.current
          || passwordRecoveryContextRef.current) return;
        await handleBootstrapFailure(error);
      }
    };

    const preparePasswordRecovery = async () => {
      const callback = initialPasswordRecovery.current;
      if (callback.errorMessage) {
        showPasswordRecovery('error', callback.errorMessage);
        return;
      }
      if (!callback.hasRecoveryProof) {
        showPasswordRecovery('error', 'Abra o link enviado por e-mail para criar uma nova senha.');
        return;
      }

      showPasswordRecovery('validating');
      try {
        const recoverySession = await passwordRecoveryService.getInitialSession();
        if (!mounted) return;
        passwordRecoverySessionRef.current = recoverySession;
        showPasswordRecovery('ready');
      } catch (error) {
        if (!mounted) return;
        passwordRecoverySessionRef.current = null;
        showPasswordRecovery(
          'error',
          error instanceof Error ? error.message : PASSWORD_RECOVERY_SESSION_ERROR,
        );
      }
    };

    if (initialPasswordRecovery.current.isRecovery
      || window.location.pathname === PASSWORD_RECOVERY_PATH) {
      void preparePasswordRecovery();
    } else {
      void bootstrapMainSession();
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (passwordRecoveryContextRef.current
        || window.location.pathname === PASSWORD_RECOVERY_PATH
        || event === 'PASSWORD_RECOVERY') return;

      if (event === 'SIGNED_IN' && session) {
        const isSameAuthenticatedSession = authenticatedUserIdRef.current === session.user.id;
        invalidatePendingAuthentication();
        const generation = authFlowGenerationRef.current;
        authenticatedUserIdRef.current = session.user.id;
        if (isSameAuthenticatedSession && viewRef.current === 'gestor') return;

        // O callback de Auth deve retornar antes de novas chamadas ao cliente.
        window.clearTimeout(authStateTimer);
        authStateTimer = window.setTimeout(() => {
          void activateAuthenticatedUser(session.user, generation).catch((error) => {
            if (generation !== authFlowGenerationRef.current
              || passwordRecoveryContextRef.current) return;
            void handleBootstrapFailure(error);
          });
        }, 0);
      }

      if (event === 'SIGNED_OUT') {
        invalidatePendingAuthentication();
        clearLocalAuthentication();
        passwordRecoveryContextRef.current = false;
        passwordRecoverySessionRef.current = null;
        setPasswordRecoveryStatus('error');
        setAuthError(null);
        sessionStorage.removeItem('contabil_config_active_subtab');
        if (window.location.pathname === PASSWORD_RECOVERY_PATH) navigate('/login');
        viewRef.current = 'login';
        setView('login');
      }
    });

    return () => {
      mounted = false;
      window.clearTimeout(authStateTimer);
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (view === 'gestor') internalTabsStore.resetToInicio();
  }, [view]);

  const handleLoginSuccess = () => {
    passwordRecoveryContextRef.current = false;
    passwordRecoverySessionRef.current = null;
    setPasswordRecoveryStatus('error');
    setPasswordRecoveryError(null);
    authFlowGenerationRef.current += 1;
    queryClient.clear();
    internalTabsStore.resetToInicio();
    persistedStorage.removeItem('contabil_internal_tabs_state');
    sessionStorage.removeItem('contabil_config_active_subtab');
    try {
      setAuthError(null);
      persistedStorage.setItem('contabil_auth', 'gestor');
      viewRef.current = 'gestor';
      setView('gestor');
    } catch (error) {
      console.error('Erro ao gravar auth persistido:', error);
      viewRef.current = 'gestor';
      setView('gestor');
    }
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) syncAuthenticatedUserProfile(data.user);
    }).catch((error) => {
      console.error('Erro ao sincronizar perfil após o login:', error);
    });
  };

  const leavePasswordRecovery = async () => {
    const recoverySession = passwordRecoverySessionRef.current;
    if (recoverySession) await recoverySession.cancel();
    if (passwordRecoverySessionRef.current === recoverySession) {
      passwordRecoverySessionRef.current = null;
    }
    authFlowGenerationRef.current += 1;
    setPasswordRecoveryStatus('error');
    setPasswordRecoveryError(null);
    queryClient.clear();
    authenticatedUserIdRef.current = null;
    persistedStorage.resetLocalContext();
    if (window.location.pathname !== '/login') navigate('/login');
    viewRef.current = 'login';
    setView('login');
  };

  const handlePasswordUpdate = async (password: string) => {
    const recoverySession = passwordRecoverySessionRef.current;
    if (!recoverySession) throw new Error(PASSWORD_RECOVERY_SESSION_ERROR);
    await recoverySession.updatePassword(password);
    passwordRecoverySessionRef.current = null;
    setPasswordRecoveryError(null);
    setPasswordRecoveryStatus('complete');
  };

  const handleLogout = () => {
    authFlowGenerationRef.current += 1;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await supabase.auth.signOut();
        }
      } catch (error) {
        console.error('Erro ao realizar logout no Supabase:', error);
      } finally {
        queryClient.clear();
        authenticatedUserIdRef.current = null;
        try {
          persistedStorage.removeItem('contabil_auth');
          persistedStorage.removeItem('gestor_user_profile');
          sessionStorage.removeItem('contabil_config_active_subtab');
        } catch (error) {
          console.error('Erro ao remover auth persistido:', error);
        }
        viewRef.current = 'login';
        setView('login');
      }
    })();
  };

  useEffect(() => {
    if (view !== 'gestor') return undefined;

    let timeoutId: any;
    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        handleLogout();
      }, INACTIVITY_LIMIT_MS);
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      window.clearTimeout(timeoutId);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
    };
  }, [view]);

  if (isSharedDocumentRoute) {
    return <div className="animate-page-fade"><PublicSharedDocumentPage /></div>;
  }

  if (isPublicCobrancaRoute) {
    return <div className="animate-page-fade"><PublicCobrancaPage /></div>;
  }

  if (isDemoWebsiteRoute) {
    return <div className="animate-page-fade"><DemoWebsite /></div>;
  }

  if (view === 'loading') return <GestorShellLoading message="Validando seu acesso..." />;

  if (view === 'password-reset' || isPasswordResetRoute) {
    return (
      <PasswordRecoveryGate
        status={passwordRecoveryStatus}
        callbackError={passwordRecoveryError}
        onSubmitPassword={handlePasswordUpdate}
        onCancel={() => leavePasswordRecovery()}
        onContinue={() => leavePasswordRecovery()}
      />
    );
  }

  if (view === 'gestor') {
    return (
      <div className="animate-page-fade">
        <GestorErrorBoundary onReset={handleLogout}>
          <GestorLayout onLogout={handleLogout} />
        </GestorErrorBoundary>
      </div>
    );
  }

  if (isLoginOrSignupRoute) {
    return (
      <div className="animate-page-fade">
        {authError && (
          <div role="alert" className="error-message" style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10000, maxWidth: 560 }}>
            {authError}
          </div>
        )}
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onBackToLanding={() => navigate('/')}
        />
      </div>
    );
  }

  return <div className="animate-page-fade"><LandingPage /></div>;
}
export default App;
