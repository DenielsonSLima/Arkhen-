import { useEffect, useRef, useState, type ReactNode, type ErrorInfo, Component } from 'react';
import type { User } from '@supabase/supabase-js';
import { LoginPage } from './modules/public/login/LoginPage';
import { PublicSharedDocumentPage } from './modules/public/shared/PublicSharedDocumentPage';
import { PublicCobrancaPage } from './modules/public/cobranca/PublicCobrancaPage';
import { GestorLayout } from './modules/gestor/layout/GestorLayout';
import { GestorShellLoading } from './modules/gestor/layout/GestorShellLoading';
import { useConfiguracoesRealtime } from './modules/gestor/configuracoes/hooks/useConfiguracoesRealtime';
import { usePersistedStorageRealtime } from './modules/gestor/configuracoes/hooks/usePersistedStorageRealtime';
import { internalTabsStore } from './stores/internalTabsStore';
import { supabase } from './lib/supabase';
import { loginService } from './modules/public/login/services/loginService';
import { persistedStorage } from './lib/persistedStorage';
import { LandingPage } from './modules/public/landing/LandingPage';
import { DemoWebsite } from './modules/public/demowebsite/DemoWebsite';
import { navigate } from './lib/navigation';
import { queryClient } from './lib/queryClient';

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
const LEGACY_DEMO_AVATAR = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150';
const LEGACY_DEMO_NAMES = new Set(['João Silva', 'João Silva Demonstração']);
const LEGACY_DEMO_EMAILS = new Set(['joao.silva@arkhen.com.br', 'demo@arkhen.com.br']);

const createInitialsAvatar = (name: string) => {
  const initials = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).replace(/[^a-z0-9]/gi, '').toUpperCase())
    .join('') || 'U';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><rect width="150" height="150" rx="75" fill="#1e293b"/><text x="75" y="82" text-anchor="middle" font-family="Arial,sans-serif" font-size="52" font-weight="700" fill="#c59235">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

interface GestorErrorBoundaryProps {
  onReset: () => void;
  children: ReactNode;
}

interface GestorErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class GestorErrorBoundary extends Component<GestorErrorBoundaryProps, GestorErrorBoundaryState> {
  constructor(props: GestorErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      message: '',
    };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || 'Erro inesperado ao carregar o sistema.',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Erro ao renderizar área do Gestor:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
    this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            alignItems: 'center',
            background: '#0f172a',
            color: '#f8fafc',
            display: 'flex',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <div>
            <h2 style={{ margin: '0 0 12px 0', fontSize: '1.05rem', color: '#f97316' }}>Falha ao abrir o sistema</h2>
            <p style={{ margin: 0 }}>{this.state.message || 'Aconteceu um erro inesperado.'}</p>
            <button
              type="button"
              onClick={this.handleReset}
              style={{
                marginTop: '14px',
                border: 'none',
                background: '#c59235',
                color: '#fff',
                borderRadius: '8px',
                padding: '10px 18px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Voltar ao Login
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  const isSharedDocumentRoute = /^(?:\/shared|\/s)(?:\/|$)/.test(currentPath);
  const isPublicCobrancaRoute = /^\/cobranca(?:\/|$)/.test(currentPath);
  const isLoginOrSignupRoute = currentPath === '/login' || currentPath === '/signup';
  const isDemoWebsiteRoute = currentPath === '/demo-publico';

  const [view, setView] = useState<'loading' | 'login' | 'gestor'>('loading');
  const [authError, setAuthError] = useState<string | null>(null);
  const viewRef = useRef(view);
  const authenticatedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('pushstate', handleLocationChange);
    window.addEventListener('replacestate', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('pushstate', handleLocationChange);
      window.removeEventListener('replacestate', handleLocationChange);
    };
  }, []);

  useConfiguracoesRealtime(view === 'gestor');
  usePersistedStorageRealtime(view === 'gestor');

  const syncUserProfile = (user: User) => {
    try {
      const metadata = user.user_metadata || {};
      const saved = persistedStorage.getItem('gestor_user_profile');
      let localProfile: any = {};
      if (saved) {
        try {
          localProfile = JSON.parse(saved);
        } catch (error) {
          console.error('Erro ao ler perfil do usuário local:', error);
        }
      }
      const storedName = LEGACY_DEMO_NAMES.has(localProfile.nome) ? '' : localProfile.nome;
      const storedEmail = LEGACY_DEMO_EMAILS.has(localProfile.email) ? '' : localProfile.email;
      const storedAvatar = localProfile.avatar === LEGACY_DEMO_AVATAR
        || localProfile.avatar?.startsWith('data:image/svg+xml')
        ? ''
        : localProfile.avatar;
      const nome = metadata.nome || metadata.name || storedName || 'Usuário';
      const updated = {
        nome,
        email: user.email || storedEmail || '',
        perfil: localProfile.perfil || 'Administrador',
        avatar: metadata.avatar_url || metadata.picture || storedAvatar || createInitialsAvatar(nome),
        googleLinked: localProfile.googleLinked || false,
        googleEmail: localProfile.googleEmail || undefined,
      };
      persistedStorage.setItem('gestor_user_profile', JSON.stringify(updated));
      window.dispatchEvent(new Event('profile_updated'));
    } catch (error) {
      console.error('Erro ao sincronizar perfil do usuário localmente:', error);
    }
  };

  useEffect(() => {
    let mounted = true;
    let authStateTimer: number | undefined;

    const clearLocalAuthentication = () => {
      authenticatedUserIdRef.current = null;
      queryClient.clear();
      persistedStorage.removeItem('contabil_auth');
      persistedStorage.removeItem('gestor_user_profile');
    };

    const showLogin = () => {
      clearLocalAuthentication();
      viewRef.current = 'login';
      setView('login');
    };

    const handleBootstrapFailure = async (error: unknown) => {
      console.error('Erro ao preparar a conta autenticada:', error);
      if (!mounted) return;
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

    const activateAuthenticatedUser = async (user: User) => {
      authenticatedUserIdRef.current = user.id;
      queryClient.clear();
      const authorization = await loginService.authorizeAuthenticatedUser(user);
      if (!authorization.allowed) {
        throw new Error(authorization.message);
      }
      if (!mounted || authenticatedUserIdRef.current !== user.id) return;

      syncUserProfile(user);
      persistedStorage.setItem('contabil_auth', 'gestor');
      setAuthError(null);
      viewRef.current = 'gestor';
      setView('gestor');
    };

    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (!mounted) return;

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
      if (!mounted) return;
      if (userError || !userData.user) {
        await handleBootstrapFailure(userError || new Error('Sessão autenticada inválida.'));
        return;
      }

      await activateAuthenticatedUser(userData.user);
    }).catch((error) => {
      if (!mounted) return;
      void handleBootstrapFailure(error);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const isSameAuthenticatedSession = authenticatedUserIdRef.current === session.user.id;
        authenticatedUserIdRef.current = session.user.id;
        if (isSameAuthenticatedSession && viewRef.current === 'gestor') return;

        // O callback de Auth deve retornar antes de novas chamadas ao cliente.
        window.clearTimeout(authStateTimer);
        authStateTimer = window.setTimeout(() => {
          void activateAuthenticatedUser(session.user).catch(handleBootstrapFailure);
        }, 0);
      }

      if (event === 'SIGNED_OUT') {
        clearLocalAuthentication();
        sessionStorage.removeItem('contabil_config_active_subtab');
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
    if (view === 'gestor') {
      internalTabsStore.resetToInicio();
    }
  }, [view]);

  const handleLoginSuccess = () => {
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
  };

  const handleLogout = () => {
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
    return (
      <div className="animate-page-fade">
        <PublicSharedDocumentPage />
      </div>
    );
  }

  if (isPublicCobrancaRoute) {
    return (
      <div className="animate-page-fade">
        <PublicCobrancaPage />
      </div>
    );
  }

  if (view === 'loading') {
    return <GestorShellLoading message="Validando seu acesso..." />;
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

  if (isDemoWebsiteRoute) {
    return (
      <div className="animate-page-fade">
        <DemoWebsite />
      </div>
    );
  }

  return (
    <div className="animate-page-fade">
      <LandingPage />
    </div>
  );
}

export default App;
