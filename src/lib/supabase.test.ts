/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn((..._args: [unknown, unknown, { auth: Record<string, unknown> }]) => ({ auth: {} })),
  urlsSeenByCreateClient: [] as string[],
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => {
    mocks.urlsSeenByCreateClient.push(window.location.href);
    return mocks.createClient(...args as [unknown, unknown, { auth: Record<string, unknown> }]);
  },
}));

describe('Supabase recovery bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.createClient.mockClear();
    mocks.urlsSeenByCreateClient.length = 0;
    window.history.replaceState({}, '', '/login');
  });

  it('captura o callback antes do cliente global, sanitiza a URL e entrega os tokens uma única vez', async () => {
    window.history.replaceState(
      {},
      '',
      '/redefinir-senha?origem=email#access_token=access-secret&refresh_token=refresh-secret&type=recovery&expires_in=3600',
    );

    const module = await import('./supabase');
    const globalOptions = mocks.createClient.mock.calls[0]?.[2] as { auth: Record<string, unknown> };

    expect(globalOptions.auth).toMatchObject({
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'implicit',
    });
    expect(mocks.urlsSeenByCreateClient[0]).not.toMatch(/access-secret|refresh-secret/);
    expect(window.location.href).not.toMatch(/access_token|refresh_token/);
    expect(window.location.search).toBe('?origem=email');
    expect(module.getInitialAuthLocation()).toEqual({
      pathname: '/redefinir-senha',
      search: '',
      hash: '#type=recovery',
    });
    expect(module.takeInitialPasswordRecoveryTokens()).toEqual({
      accessToken: 'access-secret',
      refreshToken: 'refresh-secret',
      mode: 'recovery',
    });
    expect(module.takeInitialPasswordRecoveryTokens()).toBeNull();
  });

  it('captura e sanitiza o convite antes de criar o cliente global', async () => {
    window.history.replaceState(
      {},
      '',
      '/login?origem=convite#access_token=invite-access&refresh_token=invite-refresh&type=invite&expires_in=3600',
    );

    const module = await import('./supabase');
    const globalOptions = mocks.createClient.mock.calls[0]?.[2] as { auth: Record<string, unknown> };

    expect(globalOptions.auth.detectSessionInUrl).toBe(false);
    expect(mocks.urlsSeenByCreateClient[0]).not.toMatch(/invite-access|invite-refresh/);
    expect(window.location.href).not.toMatch(/access_token|refresh_token/);
    expect(window.location.search).toBe('?origem=convite');
    expect(module.getInitialAuthLocation()).toEqual({
      pathname: '/login',
      search: '',
      hash: '#type=invite',
    });
    expect(module.takeInitialPasswordRecoveryTokens()).toEqual({
      accessToken: 'invite-access',
      refreshToken: 'invite-refresh',
      mode: 'invite',
    });
  });

  it('mantém a detecção automática apenas em navegação normal', async () => {
    window.history.replaceState({}, '', '/login?origem=site#secao');

    const module = await import('./supabase');
    const globalOptions = mocks.createClient.mock.calls[0]?.[2] as { auth: Record<string, unknown> };

    expect(globalOptions.auth.detectSessionInUrl).toBe(true);
    expect(window.location.pathname).toBe('/login');
    expect(window.location.search).toBe('?origem=site');
    expect(window.location.hash).toBe('#secao');
    expect(module.takeInitialPasswordRecoveryTokens()).toBeNull();
  });

  it('falha fechado para callback expirado ou com tokens incompletos', async () => {
    window.history.replaceState(
      {},
      '',
      '/redefinir-senha#access_token=partial&type=recovery&error=access_denied&error_code=otp_expired',
    );

    const module = await import('./supabase');
    const globalOptions = mocks.createClient.mock.calls[0]?.[2] as { auth: Record<string, unknown> };

    expect(globalOptions.auth.detectSessionInUrl).toBe(false);
    expect(module.takeInitialPasswordRecoveryTokens()).toBeNull();
    expect(module.getInitialAuthLocation()?.hash).toContain('error_code=otp_expired');
    expect(window.location.href).not.toContain('partial');
  });

  it('não permite que o cliente global troque um código PKCE na rota de recuperação', async () => {
    window.history.replaceState({}, '', '/redefinir-senha/?code=pkce-secret&origem=email');

    const module = await import('./supabase');
    const globalOptions = mocks.createClient.mock.calls[0]?.[2] as { auth: Record<string, unknown> };

    expect(globalOptions.auth.detectSessionInUrl).toBe(false);
    expect(module.getInitialAuthLocation()).toMatchObject({
      pathname: '/redefinir-senha/',
      search: '?code=present',
    });
    expect(window.location.search).toBe('?origem=email');
    expect(module.takeInitialPasswordRecoveryTokens()).toBeNull();
  });

  it('cria clientes temporários sem persistência e com chaves isoladas', async () => {
    const module = await import('./supabase');

    module.createIsolatedPasswordRecoveryClient();
    module.createIsolatedPasswordRecoveryClient();
    const firstOptions = mocks.createClient.mock.calls[1]?.[2] as { auth: Record<string, unknown> };
    const secondOptions = mocks.createClient.mock.calls[2]?.[2] as { auth: Record<string, unknown> };

    expect(firstOptions.auth).toMatchObject({
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: 'implicit',
    });
    expect(firstOptions.auth.storageKey).not.toBe(secondOptions.auth.storageKey);
  });
});
