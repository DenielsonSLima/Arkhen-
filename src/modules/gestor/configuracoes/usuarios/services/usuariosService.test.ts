import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveUsuarioInput } from './usuariosService';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock('../../../../../lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    functions: { invoke: mocks.invoke },
  },
}));

import { usuariosService } from './usuariosService';

const accessConfig = {
  enabled: false,
  days: [1, 2, 3, 4, 5],
  intervals: [{ start: '08:00', end: '18:00' }],
  message: 'Acesso fora do horário permitido.',
};

const createInput = (patch: Partial<SaveUsuarioInput> = {}): SaveUsuarioInput => ({
  nome: 'Maria da Silva',
  formaAcesso: 'cpf',
  email: '',
  cpf: '52998224725',
  telefone: '',
  perfilId: '4e115a2e-64c4-47c9-8c6f-709e940b7922',
  perfil: 'Funcionário',
  status: 'Ativo',
  accessConfig,
  ...patch,
});

const createUsuarioRow = (patch: Record<string, unknown> = {}) => ({
  id: 'usuario-1',
  auth_user_id: 'auth-user-1',
  empresa_id: 'empresa-1',
  nome: 'Maria da Silva',
  email: null,
  cpf: '52998224725',
  telefone: null,
  login_method: 'cpf',
  perfil_acesso_id: '4e115a2e-64c4-47c9-8c6f-709e940b7922',
  perfil: 'Funcionário',
  status: 'Ativo',
  access_config: accessConfig,
  must_change_password: true,
  ultimo_acesso_em: null,
  created_at: '2026-09-02T12:00:00.000Z',
  ...patch,
});

describe('usuariosService.saveUsuario', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cria acesso por CPF sem enviar senha e devolve a senha temporária do servidor', async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        ok: true,
        usuario: createUsuarioRow(),
        temporary_password: 'Temp-Segura-4821',
      },
      error: null,
    });

    const result = await usuariosService.saveUsuario(createInput());

    expect(mocks.invoke).toHaveBeenCalledWith('manage-employee-user', {
      body: {
        action: 'create',
        nome: 'Maria da Silva',
        cpf: '52998224725',
        perfil_id: '4e115a2e-64c4-47c9-8c6f-709e940b7922',
        email: null,
        telefone: null,
        access_config: accessConfig,
      },
    });
    const requestBody = mocks.invoke.mock.calls[0]?.[1]?.body as Record<string, unknown>;
    expect(requestBody).not.toHaveProperty('password');
    expect(result).toMatchObject({
      usuario: {
        id: 'usuario-1',
        formaAcesso: 'cpf',
        mustChangePassword: true,
      },
      delivery: {
        type: 'temporary_password',
        temporaryPassword: 'Temp-Segura-4821',
      },
    });
  });

  it('cria acesso por e-mail pela ação invite_email e confirma o destinatário', async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        ok: true,
        usuario: createUsuarioRow({
          email: 'maria@example.com',
          telefone: '79999999999',
          login_method: 'email',
          status: 'Pendente',
          must_change_password: true,
        }),
        invite_sent: true,
      },
      error: null,
    });

    const result = await usuariosService.saveUsuario(createInput({
      formaAcesso: 'email',
      email: '  MARIA@EXAMPLE.COM  ',
      telefone: '79999999999',
    }));

    expect(mocks.invoke).toHaveBeenCalledWith('manage-employee-user', {
      body: {
        action: 'invite_email',
        nome: 'Maria da Silva',
        email: 'maria@example.com',
        cpf: '52998224725',
        telefone: '79999999999',
        perfil_id: '4e115a2e-64c4-47c9-8c6f-709e940b7922',
        access_config: accessConfig,
      },
    });
    expect(result.delivery).toEqual({
      type: 'email_invite',
      email: 'maria@example.com',
    });
  });
});

describe('usuariosService.getUsuarioAtual', () => {
  beforeEach(() => vi.clearAllMocks());

  it('converte RPC ausente/schema cache em indisponibilidade técnica amigável', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST202',
        message: 'Could not find the function public.obter_contexto_usuario_atual',
      },
    });

    await expect(usuariosService.getUsuarioAtual()).rejects.toMatchObject({
      message: 'O serviço de acesso está temporariamente indisponível. Tente novamente em instantes.',
      blockedByPolicy: false,
    });
  });

  it('mantém bloqueios de status ou horário identificados como regra de acesso', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'Acesso fora do horário configurado.' },
    });

    await expect(usuariosService.getUsuarioAtual()).rejects.toMatchObject({
      message: 'Acesso fora do horário configurado.',
      blockedByPolicy: true,
    });
  });
});
