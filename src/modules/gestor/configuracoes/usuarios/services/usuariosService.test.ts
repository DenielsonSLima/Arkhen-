import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('../../../../../lib/supabase', () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
  },
}));

import { usuariosService, type SaveUsuarioInput } from './usuariosService';

const input: SaveUsuarioInput = {
  nome: 'Pessoa Convidada',
  email: 'pessoa@empresa.com.br',
  cpf: '000.000.000-00',
  telefone: '(00) 90000-0000',
  perfil: 'Assistente',
  status: 'Pendente',
  accessConfig: {
    enabled: false,
    days: [1, 2, 3, 4, 5],
    intervals: [{ start: '08:00', end: '18:00' }],
    message: 'Fora do horário.',
  },
};

describe('usuariosService.saveUsuario', () => {
  beforeEach(() => vi.clearAllMocks());

  it('envia convite Auth ao criar um usuário novo', async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        ok: true,
        usuario: {
          id: 'config-user',
          auth_user_id: 'auth-user',
          nome: input.nome,
          email: input.email,
          cpf: input.cpf,
          telefone: input.telefone,
          perfil: input.perfil,
          status: 'Ativo',
          access_config: input.accessConfig,
          ultimo_acesso_em: null,
          created_at: '2026-08-25T00:00:00.000Z',
        },
      },
      error: null,
    });

    const usuario = await usuariosService.saveUsuario(input);

    expect(mocks.invoke).toHaveBeenCalledWith('invite-accounting-user', {
      body: expect.objectContaining({ email: input.email, perfil: input.perfil }),
    });
    expect(usuario.authUserId).toBe('auth-user');
    expect(usuario.status).toBe('Ativo');
  });

  it('expõe a mensagem segura retornada pelo serviço de convite', async () => {
    mocks.invoke.mockResolvedValue({
      data: { ok: false, error: 'Este e-mail já possui acesso vinculado à empresa.' },
      error: null,
    });

    await expect(usuariosService.saveUsuario(input)).rejects.toThrow('Este e-mail já possui acesso');
  });
});
