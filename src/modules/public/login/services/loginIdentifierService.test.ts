import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  setSession: vi.fn(),
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
    auth: { setSession: mocks.setSession },
  },
}));

import { parseLoginIdentifier, signInWithCpf } from './loginIdentifierService';

describe('parseLoginIdentifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normaliza e-mail sem alterar o fluxo principal', () => {
    expect(parseLoginIdentifier(' GESTOR@EXEMPLO.COM ')).toEqual({
      type: 'email',
      value: 'gestor@exemplo.com',
    });
  });

  it('normaliza CPF válido para onze dígitos', () => {
    expect(parseLoginIdentifier('529.982.247-25')).toEqual({
      type: 'cpf',
      value: '52998224725',
    });
  });

  it.each(['', 'usuario', '529.982.247-24', 'email@invalido'])('rejeita identificador inválido %s', (value) => {
    expect(parseLoginIdentifier(value)).toBeNull();
  });

  it('autentica CPF sem expor o alias técnico ao cliente', async () => {
    const user = { id: 'auth-cpf-1' };
    mocks.invoke.mockResolvedValue({
      data: { ok: true, access_token: 'access-token', refresh_token: 'refresh-token' },
      error: null,
    });
    mocks.setSession.mockResolvedValue({ data: { user }, error: null });

    await expect(signInWithCpf('529.982.247-25', 'Senha-forte-2026')).resolves.toBe(user);
    expect(mocks.invoke).toHaveBeenCalledWith('manage-employee-user', {
      body: { action: 'login', cpf: '52998224725', password: 'Senha-forte-2026' },
    });
    expect(mocks.setSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
  });

  it('mantém erro genérico quando a autenticação CPF falha', async () => {
    mocks.invoke.mockResolvedValue({
      data: { ok: false },
      error: { context: { status: 401 } },
    });

    await expect(signInWithCpf('52998224725', 'senha-invalida')).rejects.toThrow(
      'E-mail/CPF ou senha inválidos.',
    );
    expect(mocks.setSession).not.toHaveBeenCalled();
  });

  it('distingue indisponibilidade técnica sem chamar de credencial inválida', async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: { context: { status: 503 } },
    });

    await expect(signInWithCpf('52998224725', 'Senha-forte-2026')).rejects.toThrow(
      'temporariamente indisponível',
    );
    expect(mocks.setSession).not.toHaveBeenCalled();
  });

  it('trata falha ao instalar a sessão válida como indisponibilidade', async () => {
    mocks.invoke.mockResolvedValue({
      data: { ok: true, access_token: 'access-token', refresh_token: 'refresh-token' },
      error: null,
    });
    mocks.setSession.mockResolvedValue({ data: { user: null }, error: new Error('network') });

    await expect(signInWithCpf('52998224725', 'Senha-forte-2026')).rejects.toThrow(
      'temporariamente indisponível',
    );
  });
});
