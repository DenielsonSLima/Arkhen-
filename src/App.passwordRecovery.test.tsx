/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  globalSignOut: vi.fn(),
  getInitialRecoverySession: vi.fn(),
  recoveryUpdatePassword: vi.fn(),
  recoveryCancel: vi.fn(),
  authorizeAuthenticatedUser: vi.fn(),
  authStateCallback: null as null | ((event: string, session: any) => void),
  unsubscribe: vi.fn(),
  removePersistedItem: vi.fn(),
  resetLocalPersistedContext: vi.fn(),
}));

vi.mock('./lib/supabase', () => ({
  getInitialAuthLocation: () => ({
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  }),
  supabase: {
    auth: {
      getSession: mocks.getSession,
      getUser: mocks.getUser,
      signOut: mocks.globalSignOut,
      onAuthStateChange: vi.fn((callback) => {
        mocks.authStateCallback = callback;
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
      }),
    },
  },
}));

vi.mock('./modules/public/login/services/passwordRecoveryService', async (importOriginal) => {
  const original = await importOriginal<typeof import('./modules/public/login/services/passwordRecoveryService')>();
  return {
    ...original,
    passwordRecoveryService: {
      getInitialSession: mocks.getInitialRecoverySession,
    },
  };
});

vi.mock('./modules/public/login/services/loginService', () => ({
  loginService: {
    authorizeAuthenticatedUser: mocks.authorizeAuthenticatedUser,
  },
}));

vi.mock('./modules/public/login/services/syncAuthenticatedUserProfile', () => ({
  syncAuthenticatedUserProfile: vi.fn(),
}));

vi.mock('./modules/public/login/PasswordRecoveryGate', () => ({
  PasswordRecoveryGate: ({ status, callbackError, onSubmitPassword, onCancel, onContinue }: any) => (
    <div data-testid="password-recovery-gate">
      <output data-testid="recovery-status">{status}</output>
      <output data-testid="recovery-error">{callbackError || ''}</output>
      {status === 'ready' && (
        <button type="button" onClick={() => void onSubmitPassword('NovaSenha123').catch(() => undefined)}>
          concluir redefinição
        </button>
      )}
      {status === 'complete' && (
        <button type="button" onClick={() => void onContinue().catch(() => undefined)}>
          ir para o login
        </button>
      )}
      {status !== 'complete' && (
        <button type="button" onClick={() => void onCancel().catch(() => undefined)}>
          cancelar recuperação
        </button>
      )}
    </div>
  ),
}));

vi.mock('./modules/public/login/LoginPage', () => ({
  LoginPage: () => <div data-testid="login-page" />,
}));
vi.mock('./modules/gestor/layout/GestorLayout', () => ({
  GestorLayout: () => <div data-testid="gestor-layout" />,
}));
vi.mock('./modules/gestor/layout/GestorShellLoading', () => ({
  GestorShellLoading: () => <div data-testid="auth-loading" />,
}));
vi.mock('./modules/gestor/configuracoes/hooks/useConfiguracoesRealtime', () => ({
  useConfiguracoesRealtime: vi.fn(),
}));
vi.mock('./modules/gestor/configuracoes/hooks/usePersistedStorageRealtime', () => ({
  usePersistedStorageRealtime: vi.fn(),
}));
vi.mock('./modules/public/shared/PublicSharedDocumentPage', () => ({
  PublicSharedDocumentPage: () => <div data-testid="shared-page" />,
}));
vi.mock('./modules/public/cobranca/PublicCobrancaPage', () => ({
  PublicCobrancaPage: () => <div data-testid="cobranca-page" />,
}));
vi.mock('./modules/public/landing/LandingPage', () => ({
  LandingPage: () => <div data-testid="landing-page" />,
}));
vi.mock('./modules/public/demowebsite/DemoWebsite', () => ({
  DemoWebsite: () => <div data-testid="demo-page" />,
}));
vi.mock('./stores/internalTabsStore', () => ({ internalTabsStore: { resetToInicio: vi.fn() } }));
vi.mock('./lib/queryClient', () => ({ queryClient: { clear: vi.fn() } }));
vi.mock('./lib/persistedStorage', () => ({
  persistedStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: mocks.removePersistedItem,
    resetLocalContext: mocks.resetLocalPersistedContext,
  },
}));

import App from './App';

const globalSession = {
  user: { id: 'global-user', email: 'global@example.com', user_metadata: {} },
  access_token: 'global-access-token',
  refresh_token: 'global-refresh-token',
};
const recoveryHandle = {
  userId: 'recovery-user',
  updatePassword: mocks.recoveryUpdatePassword,
  cancel: mocks.recoveryCancel,
};
const SUPABASE_STORAGE_KEY = 'sb-dgklhykjwzmeqxejlicz-auth-token';
const GLOBAL_STORAGE_SENTINEL = JSON.stringify(globalSession);

describe('App password recovery isolation', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    localStorage.setItem(SUPABASE_STORAGE_KEY, GLOBAL_STORAGE_SENTINEL);
    mocks.authStateCallback = null;
    mocks.getSession.mockResolvedValue({ data: { session: globalSession }, error: null });
    mocks.getUser.mockResolvedValue({ data: { user: globalSession.user }, error: null });
    mocks.globalSignOut.mockResolvedValue({ error: null });
    mocks.getInitialRecoverySession.mockResolvedValue(recoveryHandle);
    mocks.recoveryUpdatePassword.mockResolvedValue(undefined);
    mocks.recoveryCancel.mockResolvedValue(undefined);
    mocks.authorizeAuthenticatedUser.mockResolvedValue({ allowed: true, message: '', onboarding: null });
    window.history.replaceState({}, '', '/redefinir-senha#type=recovery');
  });

  it('mostra a criação da nova senha sem consultar ou autorizar a sessão global', async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByTestId('recovery-status').textContent).toBe('ready'));
    expect(mocks.getInitialRecoverySession).toHaveBeenCalledOnce();
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.authorizeAuthenticatedUser).not.toHaveBeenCalled();
    expect(screen.queryByTestId('gestor-layout')).toBeNull();
    expect(localStorage.getItem(SUPABASE_STORAGE_KEY)).toBe(GLOBAL_STORAGE_SENTINEL);
  });

  it('mantém callback expirado fora do painel mesmo após SIGNED_IN global', async () => {
    window.history.replaceState(
      {},
      '',
      '/redefinir-senha#error=access_denied&error_code=otp_expired&type=recovery',
    );
    render(<App />);

    await waitFor(() => expect(screen.getByTestId('recovery-status').textContent).toBe('error'));
    expect(screen.getByTestId('recovery-error').textContent).toMatch(/expirou|utilizado/i);
    act(() => mocks.authStateCallback?.('SIGNED_IN', globalSession));

    await waitFor(() => expect(screen.getByTestId('recovery-status').textContent).toBe('error'));
    expect(mocks.getInitialRecoverySession).not.toHaveBeenCalled();
    expect(mocks.authorizeAuthenticatedUser).not.toHaveBeenCalled();
    expect(screen.queryByTestId('gestor-layout')).toBeNull();
  });

  it('não aceita uma sessão comum na rota aberta manualmente', async () => {
    window.history.replaceState({}, '', '/redefinir-senha/');
    render(<App />);

    await waitFor(() => expect(screen.getByTestId('recovery-status').textContent).toBe('error'));
    expect(screen.getByTestId('recovery-error').textContent).toMatch(/link enviado por e-mail/i);
    expect(mocks.getInitialRecoverySession).not.toHaveBeenCalled();
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.authorizeAuthenticatedUser).not.toHaveBeenCalled();
  });

  it('conclui em uma tela terminal e abre o login sem tocar a sessão global', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('recovery-status').textContent).toBe('ready'));

    fireEvent.click(screen.getByRole('button', { name: /concluir redefinição/i }));

    await waitFor(() => expect(screen.getByTestId('recovery-status').textContent).toBe('complete'));
    expect(mocks.recoveryUpdatePassword).toHaveBeenCalledWith('NovaSenha123');
    expect(mocks.globalSignOut).not.toHaveBeenCalled();
    expect(localStorage.getItem(SUPABASE_STORAGE_KEY)).toBe(GLOBAL_STORAGE_SENTINEL);

    fireEvent.click(screen.getByRole('button', { name: /ir para o login/i }));
    expect(await screen.findByTestId('login-page')).toBeDefined();
    expect(window.location.pathname).toBe('/login');
    expect(localStorage.getItem(SUPABASE_STORAGE_KEY)).toBe(GLOBAL_STORAGE_SENTINEL);
  });

  it('ignora SIGNED_IN de outra conta durante uma atualização pendente', async () => {
    let resolveUpdate: (() => void) | undefined;
    mocks.recoveryUpdatePassword.mockReturnValueOnce(new Promise<void>((resolve) => {
      resolveUpdate = resolve;
    }));
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('recovery-status').textContent).toBe('ready'));

    fireEvent.click(screen.getByRole('button', { name: /concluir redefinição/i }));
    await waitFor(() => expect(mocks.recoveryUpdatePassword).toHaveBeenCalledOnce());
    act(() => mocks.authStateCallback?.('SIGNED_IN', globalSession));

    expect(screen.getByTestId('recovery-status').textContent).toBe('ready');
    expect(mocks.authorizeAuthenticatedUser).not.toHaveBeenCalled();
    act(() => resolveUpdate?.());
    await waitFor(() => expect(screen.getByTestId('recovery-status').textContent).toBe('complete'));
    expect(mocks.globalSignOut).not.toHaveBeenCalled();
    expect(localStorage.getItem(SUPABASE_STORAGE_KEY)).toBe(GLOBAL_STORAGE_SENTINEL);
  });

  it('encerra o formulário quando a alteração falha em estado terminal', async () => {
    mocks.recoveryUpdatePassword.mockRejectedValueOnce(new Error('Não foi possível confirmar a alteração.'));
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('recovery-status').textContent).toBe('ready'));

    fireEvent.click(screen.getByRole('button', { name: /concluir redefinição/i }));

    await waitFor(() => expect(screen.getByTestId('recovery-status').textContent).toBe('error'));
    expect(screen.getByTestId('recovery-error').textContent).toMatch(/não foi possível confirmar/i);
    expect(screen.queryByRole('button', { name: /concluir redefinição/i })).toBeNull();
    expect(mocks.globalSignOut).not.toHaveBeenCalled();
  });

  it('cancela somente o handle isolado e volta ao login', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('recovery-status').textContent).toBe('ready'));

    fireEvent.click(screen.getByRole('button', { name: /cancelar recuperação/i }));

    await waitFor(() => expect(mocks.recoveryCancel).toHaveBeenCalledOnce());
    expect(await screen.findByTestId('login-page')).toBeDefined();
    expect(mocks.globalSignOut).not.toHaveBeenCalled();
    expect(localStorage.getItem(SUPABASE_STORAGE_KEY)).toBe(GLOBAL_STORAGE_SENTINEL);
  });

  it('mantém o bootstrap normal do painel fora da recuperação', async () => {
    window.history.replaceState({}, '', '/');
    render(<App />);

    expect(await screen.findByTestId('gestor-layout')).toBeDefined();
    expect(mocks.getSession).toHaveBeenCalledOnce();
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.authorizeAuthenticatedUser).toHaveBeenCalledWith(globalSession.user);
    expect(mocks.getInitialRecoverySession).not.toHaveBeenCalled();
  });
});
