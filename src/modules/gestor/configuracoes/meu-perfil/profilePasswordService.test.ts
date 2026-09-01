import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('../../../../lib/supabase', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));

import { profilePasswordService } from './profilePasswordService';

describe('profilePasswordService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('envia a troca de senha CPF para validação autenticada no servidor', async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: true }, error: null });

    await profilePasswordService.changeOwnCpfPassword('NovaSenha2026');

    expect(mocks.invoke).toHaveBeenCalledWith('manage-employee-user', {
      body: { action: 'change_own_password', password: 'NovaSenha2026' },
    });
  });

  it('preserva a mensagem segura devolvida pela função', async () => {
    mocks.invoke.mockResolvedValue({
      data: { ok: false, error: 'A nova senha não atende aos requisitos.' },
      error: null,
    });

    await expect(
      profilePasswordService.changeOwnCpfPassword('senha-fraca'),
    ).rejects.toThrow('A nova senha não atende aos requisitos.');
  });
});
