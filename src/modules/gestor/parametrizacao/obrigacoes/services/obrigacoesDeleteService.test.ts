import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../../../../../lib/supabase', () => ({ supabase: supabaseMock }));

import { obrigacoesService } from './obrigacoesService';

beforeEach(() => {
  vi.clearAllMocks();
  supabaseMock.rpc.mockResolvedValue({ data: {}, error: null });
});

describe('obrigacoesService.delete', () => {
  it('exclui somente por meio da RPC protegida', async () => {
    const id = '11111111-1111-4111-8111-111111111111';

    await obrigacoesService.delete(id);

    expect(supabaseMock.rpc).toHaveBeenCalledWith('excluir_obrigacao_unificada', {
      p_obrigacao_id: id,
    });
  });

  it('rejeita uma identidade inválida antes de acessar o banco', async () => {
    await expect(obrigacoesService.delete('nao-e-uuid')).rejects.toThrow('Obrigação inválida');
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });
});
