import { useEffect, useRef, useState, type ReactNode, type ErrorInfo, Component } from 'react';
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

  const syncUserProfile = (user: any) => {
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
      const updated = {
        nome: metadata.nome || metadata.name || localProfile.nome || 'João Silva',
        email: user.email || localProfile.email || 'joao.silva@arkhen.com.br',
        perfil: localProfile.perfil || 'Administrador',
        avatar: metadata.avatar_url || metadata.picture || localProfile.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
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

    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (!mounted) return;

      if (error || !data.session) {
        authenticatedUserIdRef.current = null;
        queryClient.clear();
        try {
          persistedStorage.removeItem('contabil_auth');
          persistedStorage.removeItem('gestor_user_profile');
        } catch (error) {
          console.error('Erro ao remover auth persistido:', error);
        }
        viewRef.current = 'login';
        setView('login');
        return;
      }

      authenticatedUserIdRef.current = data.session.user.id;

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!mounted) return;
      if (userError || !userData.user) {
        await supabase.auth.signOut({ scope: 'local' });
        queryClient.clear();
        persistedStorage.removeItem('contabil_auth');
        persistedStorage.removeItem('gestor_user_profile');
        viewRef.current = 'login';
        setView('login');
        return;
      }

      syncUserProfile(userData.user);

      try {
        await loginService.completeOnboarding({ email: userData.user.email || undefined });
      } catch (error) {
        console.error('Erro ao finalizar cadastro autenticado:', error);
      }
      persistedStorage.setItem('contabil_auth', 'gestor');
      viewRef.current = 'gestor';
      setView('gestor');
    }).catch((error) => {
      if (!mounted) return;
      console.error('Erro ao validar a sessão inicial:', error);
      queryClient.clear();
      try {
        persistedStorage.removeItem('contabil_auth');
        persistedStorage.removeItem('gestor_user_profile');
      } catch (storageError) {
        console.error('Erro ao limpar autenticação local:', storageError);
      }
      viewRef.current = 'login';
      setView('login');
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const isSameAuthenticatedSession = authenticatedUserIdRef.current === session.user.id;
        authenticatedUserIdRef.current = session.user.id;
        if (isSameAuthenticatedSession && viewRef.current === 'gestor') return;

        queryClient.clear();
        syncUserProfile(session.user);
        void loginService.completeOnboarding({ email: session.user.email || undefined }).catch((error) => {
          console.error('Erro ao finalizar cadastro autenticado:', error);
        });
        persistedStorage.setItem('contabil_auth', 'gestor');
        viewRef.current = 'gestor';
        setView('gestor');
      }

      if (event === 'SIGNED_OUT') {
        authenticatedUserIdRef.current = null;
        queryClient.clear();
        persistedStorage.removeItem('contabil_auth');
        persistedStorage.removeItem('gestor_user_profile');
        sessionStorage.removeItem('contabil_config_active_subtab');
        viewRef.current = 'login';
        setView('login');
      }
    });

    return () => {
      mounted = false;
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
