import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ maybeSingle: vi.fn(), upsert: vi.fn() }));
vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
    from: () => {
      const query = { select: () => query, eq: () => query, ...db };
      return query;
    },
  },
}));
vi.mock('../../parametrizacao/services/parametrizacaoSupabase', () => ({
  getCurrentEmpresaId: async () => 'empresa-1',
}));
import { documentosPreferencesService as service } from './documentosPreferencesService';

beforeEach(() => {
  vi.clearAllMocks();
  db.upsert.mockResolvedValue({ error: null });
});

describe('preferências de documentos', () => {
  it('recupera a data de último acesso persistida como texto', async () => {
    const date = '2026-09-06T12:00:00.000Z';
    await service.setPageLastAccess(date);
    const saved = db.upsert.mock.calls[0][0];
    db.maybeSingle.mockResolvedValue({ data: { valor: saved.valor }, error: null });
    expect(await service.getPageLastAccess()).toBe(date);
  });

  it.each([null, {}, 42, ''])('ignora data ausente ou inválida: %j', async valor => {
    db.maybeSingle.mockResolvedValue({ data: { valor }, error: null });
    expect(await service.getPageLastAccess()).toBeNull();
  });

  it('preserva as preferências de gaveta em formato objeto', async () => {
    db.maybeSingle.mockResolvedValue({ data: { valor: { pessoal: false } }, error: null });
    expect(await service.getDrawerState('pessoal')).toBe(false);
  });
});
