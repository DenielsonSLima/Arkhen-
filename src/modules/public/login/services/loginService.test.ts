import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import type { Usuario } from '../../../gestor/configuracoes/usuarios/services/usuariosService';

const mocks = vi.hoisted(() => ({
  getUsuarioAtual: vi.fn(),
  rpc: vi.fn(),
  signUp: vi.fn(),
  signInWithCpf: vi.fn(),
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    auth: {
      signInWithPassword: vi.fn(),
      signUp: mocks.signUp,
      signOut: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
  },
}));

vi.mock('../../../gestor/configuracoes/usuarios/services/usuariosService', () => ({
  usuariosService: {
    getUsuarioAtual: mocks.getUsuarioAtual,
  },
}));

vi.mock('./passwordRecoveryService', () => ({
  passwordRecoveryService: { sendRecoveryEmail: vi.fn() },
}));

vi.mock('./loginIdentifierService', async () => {
  const actual = await vi.importActual<typeof import('./loginIdentifierService')>(
    './loginIdentifierService',
  );
  return { ...actual, signInWithCpf: mocks.signInWithCpf };
});

import { loginService } from './loginService';
import { CpfLoginUnavailableError } from './loginIdentifierService';

const configuredUser: Usuario = {
  id: 'config-1',
  authUserId: 'auth-1',
  empresaId: 'empresa-1',
  nome: 'Maria da Silva',
  email: '',
  cpf: '52998224725',
  telefone: '',
  formaAcesso: 'cpf',
  perfilId: 'perfil-1',
  perfil: 'Funcionário',
  status: 'Ativo',
  accessConfig: { enabled: false, days: [1, 2, 3, 4, 5], intervals: [], message: '' },
  mustChangePassword: false,
  ultimoAcessoEm: null,
  createdAt: '2026-09-01T00:00:00Z',
};

const authUser = (id: string, appMetadata: Record<string, unknown> = {}) => ({
  id,
  email: 'alias@acesso.invalid',
  app_metadata: appMetadata,
  user_metadata: {},
}) as User;

describe('loginService.authorizeAuthenticatedUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('autoriza pelo contexto vinculado sem executar onboarding', async () => {
    mocks.getUsuarioAtual.mockResolvedValue(configuredUser);

    const result = await loginService.authorizeAuthenticatedUser(
      authUser('auth-1', { account_type: 'employee_cpf' }),
    );

    expect(result).toEqual({
      allowed: true,
      message: '',
      onboarding: {
        empresa_id: 'empresa-1',
        nome: 'Maria da Silva',
        email: '',
        cpf: '52998224725',
        perfil: 'Funcionário',
        auth_method: 'cpf',
      },
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('nunca transforma funcionário CPF sem vínculo em gestor por onboarding', async () => {
    mocks.getUsuarioAtual.mockResolvedValue(null);

    const result = await loginService.authorizeAuthenticatedUser(
      authUser('auth-cpf-sem-vinculo', { account_type: 'employee_cpf' }),
    );

    expect(result.allowed).toBe(false);
    expect(result.message).toContain('configuração de acesso');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('sincroniza e recarrega o contexto da conta tradicional já configurada', async () => {
    const oldConfig = {
      ...configuredUser,
      formaAcesso: 'email' as const,
      email: 'email-antigo@empresa.com',
    };
    const refreshedConfig = { ...oldConfig, email: 'email-novo@empresa.com' };
    mocks.getUsuarioAtual
      .mockResolvedValueOnce(oldConfig)
      .mockResolvedValueOnce(refreshedConfig);
    mocks.rpc.mockResolvedValue({
      data: { empresa_id: 'empresa-1', email: 'email-novo@empresa.com' },
      error: null,
    });

    const result = await loginService.authorizeAuthenticatedUser(authUser('auth-email'));

    expect(result.allowed).toBe(true);
    expect(result.onboarding?.email).toBe('email-novo@empresa.com');
    expect(mocks.rpc).toHaveBeenCalledWith('finalizar_cadastro_auth', { p_payload: {} });
    expect(mocks.getUsuarioAtual).toHaveBeenCalledTimes(2);
  });

  it('preserva onboarding somente para a conta tradicional sem configuração', async () => {
    mocks.getUsuarioAtual
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...configuredUser, formaAcesso: 'email', email: 'gestor@empresa.com' });
    mocks.rpc.mockResolvedValue({ data: { empresa_id: 'empresa-1' }, error: null });

    const result = await loginService.authorizeAuthenticatedUser(authUser('auth-email'));

    expect(result.allowed).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith('finalizar_cadastro_auth', { p_payload: {} });
  });

  it('propaga a mensagem segura de bloqueio produzida pelo banco', async () => {
    mocks.getUsuarioAtual.mockRejectedValue(Object.assign(
      new Error('Seu usuário está inativo.'),
      { blockedByPolicy: true },
    ));

    const result = await loginService.authorizeAuthenticatedUser(authUser('auth-inativo'));

    expect(result).toEqual({
      allowed: false,
      message: 'Seu usuário está inativo.',
      onboarding: null,
      blockedByAccess: true,
    });
  });

  it('não apresenta indisponibilidade técnica como bloqueio de horário', async () => {
    mocks.getUsuarioAtual.mockRejectedValue(Object.assign(
      new Error('O serviço de acesso está temporariamente indisponível. Tente novamente em instantes.'),
      { blockedByPolicy: false },
    ));

    const result = await loginService.authorizeAuthenticatedUser(authUser('auth-email'));

    expect(result).toEqual({
      allowed: false,
      message: 'O serviço de acesso está temporariamente indisponível. Tente novamente em instantes.',
      onboarding: null,
      blockedByAccess: false,
    });
  });
});

describe('loginService.cadastrar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const signupPayload = {
    nome: 'Maria da Silva',
    empresaNome: 'Contabilidade Exemplo',
    cnpj: '12.345.678/0001-90',
    email: 'maria@empresa.com',
    senha: 'Senha123',
    cpf: '529.982.247-25',
    telefone: '(79) 99999-9999',
  };

  it.each([
    [{ cpf: '111.111.111-11' }, 'CPF válido'],
    [{ telefone: '9999' }, 'telefone válido'],
    [{ nome: '<script>' }, 'nome válido'],
  ])('rejeita dados incompatíveis com o onboarding antes de criar Auth', async (patch, message) => {
    const result = await loginService.cadastrar({ ...signupPayload, ...patch });

    expect(result.success).toBe(false);
    expect(result.message).toContain(message);
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
});

describe('loginService.autenticar por CPF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserva a mensagem técnica segura quando a Edge está indisponível', async () => {
    mocks.signInWithCpf.mockRejectedValue(new CpfLoginUnavailableError());

    const result = await loginService.autenticar({
      usuario: '529.982.247-25',
      senha: 'Senha-forte-2026',
      role: 'funcionario',
    });

    expect(result).toEqual({
      success: false,
      message: 'O serviço de login por CPF está temporariamente indisponível. Tente novamente em instantes.',
    });
  });
});
