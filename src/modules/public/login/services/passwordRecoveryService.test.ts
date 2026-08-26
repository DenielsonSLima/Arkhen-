/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  takeTokens: vi.fn(),
  createIsolatedClient: vi.fn(),
  isolatedSetSession: vi.fn(),
  isolatedUpdateUser: vi.fn(),
  isolatedSignOut: vi.fn(),
  isolatedDispose: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  globalUpdateUser: vi.fn(),
  globalSignOut: vi.fn(),
  globalSetSession: vi.fn(),
}));

vi.mock('../../../../lib/supabase', () => ({
  takeInitialPasswordRecoveryTokens: mocks.takeTokens,
  createIsolatedPasswordRecoveryClient: mocks.createIsolatedClient,
  supabase: {
    auth: {
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      updateUser: mocks.globalUpdateUser,
      signOut: mocks.globalSignOut,
      setSession: mocks.globalSetSession,
    },
  },
}));

let recoveryModule: typeof import('./passwordRecoveryService');

describe('password recovery callback', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    recoveryModule = await import('./passwordRecoveryService');
  });

  it('detecta callback implicit e a rota dedicada', () => {
    expect(recoveryModule.inspectPasswordRecoveryCallback({
      pathname: '/login',
      search: '',
      hash: '#type=recovery',
    })).toEqual({ isRecovery: true, hasRecoveryProof: true, errorMessage: null });

    expect(recoveryModule.inspectPasswordRecoveryCallback({
      pathname: '/login',
      search: '',
      hash: '#type=invite',
    })).toEqual({ isRecovery: true, hasRecoveryProof: true, errorMessage: null });

    expect(recoveryModule.inspectPasswordRecoveryCallback({
      pathname: recoveryModule.PASSWORD_RECOVERY_PATH,
      search: '',
      hash: '',
    })).toEqual({ isRecovery: true, hasRecoveryProof: false, errorMessage: null });
  });

  it('explica callback expirado e falha fechado para PKCE', () => {
    expect(recoveryModule.inspectPasswordRecoveryCallback({
      pathname: recoveryModule.PASSWORD_RECOVERY_PATH,
      search: '',
      hash: '#error=access_denied&error_code=otp_expired&type=recovery',
    }).errorMessage).toMatch(/expirou|utilizado/i);

    expect(recoveryModule.inspectPasswordRecoveryCallback({
      pathname: `${recoveryModule.PASSWORD_RECOVERY_PATH}/`,
      search: '?code=present',
      hash: '',
    }).errorMessage).toMatch(/não pôde ser validado/i);
  });

  it('gera o redirect exato para criar a nova senha', () => {
    expect(recoveryModule.getPasswordRecoveryRedirectUrl('https://contabil.example.com')).toBe(
      'https://contabil.example.com/redefinir-senha',
    );
  });
});

describe('passwordRecoveryService', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.takeTokens.mockReturnValue({
      accessToken: 'recovery-access-token',
      refreshToken: 'recovery-refresh-token',
    });
    mocks.createIsolatedClient.mockReturnValue({
      auth: {
        setSession: mocks.isolatedSetSession,
        updateUser: mocks.isolatedUpdateUser,
        signOut: mocks.isolatedSignOut,
        dispose: mocks.isolatedDispose,
      },
    });
    mocks.isolatedSetSession.mockResolvedValue({
      data: { user: { id: 'recovery-user' }, session: {} },
      error: null,
    });
    mocks.isolatedUpdateUser.mockResolvedValue({
      data: { user: { id: 'recovery-user' } },
      error: null,
    });
    mocks.isolatedSignOut.mockResolvedValue({ error: null });
    mocks.isolatedDispose.mockResolvedValue(undefined);
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    recoveryModule = await import('./passwordRecoveryService');
  });

  it('envia o e-mail com o redirect dedicado', async () => {
    await recoveryModule.passwordRecoveryService.sendRecoveryEmail('usuario@example.com');

    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(
      'usuario@example.com',
      { redirectTo: `${window.location.origin}/redefinir-senha` },
    );
  });

  it('inicializa uma única sessão isolada mesmo com duas chamadas concorrentes', async () => {
    const first = recoveryModule.passwordRecoveryService.getInitialSession();
    const second = recoveryModule.passwordRecoveryService.getInitialSession();

    expect(first).toBe(second);
    const [firstSession, secondSession] = await Promise.all([first, second]);
    expect(firstSession).toBe(secondSession);
    expect(mocks.takeTokens).toHaveBeenCalledOnce();
    expect(mocks.createIsolatedClient).toHaveBeenCalledOnce();
    expect(mocks.isolatedSetSession).toHaveBeenCalledOnce();
    expect(mocks.isolatedSetSession).toHaveBeenCalledWith({
      access_token: 'recovery-access-token',
      refresh_token: 'recovery-refresh-token',
    });
  });

  it('atualiza somente pelo mesmo cliente isolado', async () => {
    const session = await recoveryModule.passwordRecoveryService.getInitialSession();
    await session.updatePassword('NovaSenha123');

    expect(session.userId).toBe('recovery-user');
    expect(mocks.isolatedUpdateUser).toHaveBeenCalledWith({ password: 'NovaSenha123' });
    expect(mocks.isolatedSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mocks.isolatedDispose).toHaveBeenCalledOnce();
    expect(mocks.globalUpdateUser).not.toHaveBeenCalled();
    expect(mocks.globalSetSession).not.toHaveBeenCalled();
    expect(mocks.globalSignOut).not.toHaveBeenCalled();
  });

  it('conclui em estado terminal sem aguardar um sign-out remoto pendente', async () => {
    mocks.isolatedSignOut.mockReturnValueOnce(new Promise(() => undefined));
    const session = await recoveryModule.passwordRecoveryService.getInitialSession();

    await expect(session.updatePassword('NovaSenha123')).resolves.toBeUndefined();
    await vi.waitFor(() => expect(mocks.isolatedSignOut).toHaveBeenCalledOnce());
    await expect(session.updatePassword('OutraSenha123')).rejects.toThrow(/sessão de recuperação/i);
    expect(mocks.isolatedUpdateUser).toHaveBeenCalledOnce();
    expect(mocks.isolatedDispose).toHaveBeenCalledOnce();
  });

  it('mantém o sucesso terminal quando o cleanup rejeita', async () => {
    mocks.isolatedSignOut.mockRejectedValueOnce(new Error('network unavailable'));
    const session = await recoveryModule.passwordRecoveryService.getInitialSession();

    await expect(session.updatePassword('NovaSenha123')).resolves.toBeUndefined();
    await expect(session.updatePassword('OutraSenha123')).rejects.toThrow(/sessão de recuperação/i);
    expect(mocks.isolatedUpdateUser).toHaveBeenCalledOnce();
    expect(mocks.isolatedDispose).toHaveBeenCalledOnce();
  });

  it('terminaliza o handle após qualquer erro retornado pela mutação', async () => {
    mocks.isolatedUpdateUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Falha ao confirmar a alteração' },
    });
    const session = await recoveryModule.passwordRecoveryService.getInitialSession();

    await expect(session.updatePassword('SenhaValida123')).rejects.toThrow('Falha ao confirmar a alteração');
    await expect(session.updatePassword('OutraSenha123')).rejects.toThrow(/sessão de recuperação/i);
    expect(mocks.isolatedUpdateUser).toHaveBeenCalledOnce();
    expect(mocks.isolatedDispose).toHaveBeenCalledOnce();
  });

  it('falha fechado e fica terminal se a resposta da mutação trouxer outro usuário', async () => {
    mocks.isolatedUpdateUser.mockResolvedValueOnce({
      data: { user: { id: 'another-user' } },
      error: null,
    });
    const session = await recoveryModule.passwordRecoveryService.getInitialSession();

    await expect(session.updatePassword('NovaSenha123')).rejects.toThrow(/sessão de recuperação/i);
    await expect(session.updatePassword('OutraSenha123')).rejects.toThrow(/sessão de recuperação/i);
    expect(mocks.isolatedUpdateUser).toHaveBeenCalledOnce();
  });

  it('recusa link sem tokens ou sem usuário validado', async () => {
    mocks.takeTokens.mockReturnValueOnce(null);
    await expect(recoveryModule.passwordRecoveryService.getInitialSession())
      .rejects.toThrow(/sessão de recuperação/i);
    expect(mocks.createIsolatedClient).not.toHaveBeenCalled();
  });

  it('descarta o cliente quando o token não valida um usuário', async () => {
    mocks.isolatedSetSession.mockResolvedValueOnce({ data: { user: null }, error: null });

    await expect(recoveryModule.passwordRecoveryService.getInitialSession())
      .rejects.toThrow(/sessão de recuperação/i);
    expect(mocks.isolatedUpdateUser).not.toHaveBeenCalled();
    expect(mocks.isolatedDispose).toHaveBeenCalledOnce();
  });

  it('cancela apenas a sessão isolada e torna o handle terminal', async () => {
    const session = await recoveryModule.passwordRecoveryService.getInitialSession();

    await session.cancel();
    await expect(session.updatePassword('NovaSenha123')).rejects.toThrow(/sessão de recuperação/i);
    expect(mocks.isolatedSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mocks.isolatedDispose).toHaveBeenCalledOnce();
    expect(mocks.globalSignOut).not.toHaveBeenCalled();
  });

  it('cancela sem aguardar um sign-out remoto pendente', async () => {
    mocks.isolatedSignOut.mockReturnValueOnce(new Promise(() => undefined));
    const session = await recoveryModule.passwordRecoveryService.getInitialSession();

    await expect(session.cancel()).resolves.toBeUndefined();
    expect(mocks.isolatedDispose).toHaveBeenCalledOnce();
    await expect(session.updatePassword('NovaSenha123')).rejects.toThrow(/sessão de recuperação/i);
  });

  it('propaga a falha do envio do e-mail', async () => {
    mocks.resetPasswordForEmail.mockResolvedValueOnce({ error: { message: 'SMTP indisponível' } });

    await expect(recoveryModule.passwordRecoveryService.sendRecoveryEmail('usuario@example.com'))
      .rejects.toThrow('SMTP indisponível');
  });
});
