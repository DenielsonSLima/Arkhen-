import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('../../../../../lib/supabase', () => ({
  supabase: { rpc: mocks.rpc },
}));

import {
  MODULES_REQUEST_TIMEOUT_MS,
  modulosSistemaService,
} from './modulosSistemaService';

describe('modulosSistemaService.list', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falha em estado recuperável quando a RPC não responde', async () => {
    vi.useFakeTimers();
    mocks.rpc.mockReturnValueOnce(new Promise<never>(() => undefined));
    const request = modulosSistemaService.list();
    const rejection = expect(request).rejects.toThrow(/demorou além do esperado/i);

    await vi.advanceTimersByTimeAsync(MODULES_REQUEST_TIMEOUT_MS);

    await rejection;
  });

  it('preserva a resposta válida da RPC', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        canManage: true,
        modulos: [{
          id: 'inicio',
          nome: 'Início',
          descricao: 'Painel',
          categoria: 'Essencial',
          obrigatorio: true,
          habilitado: true,
          ordem: 1,
        }],
      },
      error: null,
    });

    await expect(modulosSistemaService.list()).resolves.toMatchObject({
      available: true,
      canManage: true,
      modulos: [{ id: 'inicio', habilitado: true }],
    });
  });
});
