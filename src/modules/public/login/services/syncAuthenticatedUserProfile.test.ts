/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

const storageMocks = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock('../../../../lib/persistedStorage', () => ({
  persistedStorage: storageMocks,
}));

import { syncAuthenticatedUserProfile } from './syncAuthenticatedUserProfile';

const cpfUser = {
  id: 'auth-cpf-1',
  aud: 'authenticated',
  created_at: '2026-09-01T00:00:00.000Z',
  email: 'alias-interno@usuarios.invalid',
  app_metadata: { account_type: 'employee_cpf', login_method: 'cpf' },
  user_metadata: { nome: 'Nome adulterado', cpf: '11111111111' },
} as User;

describe('syncAuthenticatedUserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.getItem.mockReturnValue(JSON.stringify({
      nome: 'Perfil antigo',
      cpf: '22222222222',
      email: 'contato-antigo@empresa.com',
    }));
  });

  it('prioriza identidade e perfil validados pelo contexto do servidor para conta CPF', () => {
    syncAuthenticatedUserProfile(cpfUser, {
      nome: 'Maria da Silva',
      cpf: '52998224725',
      perfil: 'Funcionário',
      authMethod: 'cpf',
    });

    expect(storageMocks.setItem).toHaveBeenCalledOnce();
    const [, serialized] = storageMocks.setItem.mock.calls[0];
    expect(JSON.parse(serialized)).toEqual(expect.objectContaining({
      nome: 'Maria da Silva',
      email: '',
      cpf: '52998224725',
      perfil: 'Funcionário',
      authMethod: 'cpf',
    }));
  });

  it('mantém conta de e-mail quando user_metadata tenta se declarar como CPF', () => {
    const emailUser = {
      ...cpfUser,
      email: 'gestor@empresa.com',
      app_metadata: {},
      user_metadata: { login_method: 'cpf', cpf: '11111111111' },
    } as User;

    syncAuthenticatedUserProfile(emailUser, {
      nome: 'Gestora da Silva',
      email: 'gestor@empresa.com',
      cpf: '52998224725',
      perfil: 'Gestor',
      authMethod: 'email',
    });

    const [, serialized] = storageMocks.setItem.mock.calls[0];
    expect(JSON.parse(serialized)).toEqual(expect.objectContaining({
      email: 'gestor@empresa.com',
      cpf: '52998224725',
      perfil: 'Gestor',
      authMethod: 'email',
    }));
  });

  it('não usa nome, CPF ou perfil do user_metadata no fallback de conta CPF', () => {
    storageMocks.getItem.mockReturnValue(JSON.stringify({
      nome: 'Nome validado anteriormente',
      cpf: '52998224725',
      perfil: 'Funcionário',
    }));
    const userWithPoisonedMetadata = {
      ...cpfUser,
      user_metadata: {
        nome: 'Gestor adulterado',
        cpf: '11111111111',
        perfil: 'Administrador',
      },
    } as User;

    syncAuthenticatedUserProfile(userWithPoisonedMetadata);

    const [, serialized] = storageMocks.setItem.mock.calls[0];
    expect(JSON.parse(serialized)).toEqual(expect.objectContaining({
      nome: 'Nome validado anteriormente',
      cpf: '52998224725',
      perfil: 'Funcionário',
      authMethod: 'cpf',
    }));
  });
});
