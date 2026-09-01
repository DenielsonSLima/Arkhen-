import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../../../../../lib/supabase', () => ({
  supabase: { rpc: mocks.rpc },
}));

import { usuariosService } from './usuariosService';

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
