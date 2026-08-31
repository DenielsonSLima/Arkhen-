import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  getUser: vi.fn(),
  usuariosNot: vi.fn(),
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    from: mocks.from,
    rpc: mocks.rpc,
    auth: { getUser: mocks.getUser },
  },
}));

import { rotinasAtividadesService } from './rotinasAtividadesService';

const createQuery = (data: unknown, not = vi.fn()) => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    not,
    order: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.not.mockReturnValue(query);
  query.order.mockResolvedValue({ data, error: null });
  return query;
};

describe('rotinasAtividadesService responsáveis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.usuariosNot.mockClear();
    mocks.rpc.mockImplementation(async (name: string) => (
      name === 'current_empresa_id'
        ? { data: '10000000-0000-4000-8000-000000000001', error: null }
        : { data: [], error: null }
    ));
    mocks.getUser.mockResolvedValue({ data: { user: { id: '20000000-0000-4000-8000-000000000001' } }, error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'configuracoes_usuarios') {
        return createQuery([
          { id: 'sem-auth', auth_user_id: null, nome: 'Sem acesso', perfil_id: null },
          { id: 'com-auth', auth_user_id: '20000000-0000-4000-8000-000000000001', nome: 'Com acesso', perfil_id: 'perfil' },
        ], mocks.usuariosNot);
      }
      return createQuery([]);
    });
  });

  it('consulta e expõe somente responsáveis com acesso autenticado', async () => {
    const workspace = await rotinasAtividadesService.getWorkspace();

    expect(mocks.usuariosNot).toHaveBeenCalledWith('auth_user_id', 'is', null);
    expect(workspace.usuarios).toEqual([{
      configUsuarioId: 'com-auth',
      userId: '20000000-0000-4000-8000-000000000001',
      nome: 'Com acesso',
    }]);
  });
});
