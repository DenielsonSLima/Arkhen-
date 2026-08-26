import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const order = vi.fn();
  const or = vi.fn();
  const select = vi.fn();
  const update = vi.fn();
  const builder = { order, or, select, update };
  select.mockReturnValue(builder);
  update.mockReturnValue(builder);
  return { builder, order, or, select, update, from: vi.fn(() => builder) };
});

vi.mock('../../../../lib/supabase', () => ({
  supabase: { from: mocks.from },
}));

import { documentShareService } from './documentShareService';

describe('documentShareService: falhas persistentes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('não converte falha de listagem em uma lista vazia enganosa', async () => {
    mocks.order.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });

    await expect(documentShareService.list()).rejects.toThrow(
      'Não foi possível carregar os compartilhamentos',
    );
  });

  it('propaga a falha de revogação e informa que o link continua ativo', async () => {
    mocks.or.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });

    await expect(documentShareService.revoke('grupo-real')).rejects.toThrow(
      'O link continua ativo',
    );
  });
});
