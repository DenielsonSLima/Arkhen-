import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getUser: vi.fn(),
  companySingle: vi.fn(),
  profileSingle: vi.fn(),
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    auth: { getUser: mocks.getUser },
    from: (table: string) => ({
      select: () => ({
        eq: () => table === 'configuracoes_empresa'
          ? { maybeSingle: mocks.companySingle }
          : { eq: () => ({ eq: () => ({ maybeSingle: mocks.profileSingle }) }) },
      }),
    }),
  },
}));

import { resolveDocumentShareIdentity } from './documentShareIdentity';

describe('resolveDocumentShareIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: 'empresa-real', error: null });
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'usuario-real', user_metadata: {} } },
      error: null,
    });
    mocks.companySingle.mockResolvedValue({
      data: { nome_fantasia: 'Escritório Real', razao_social: 'Escritório Real Ltda.' },
      error: null,
    });
    mocks.profileSingle.mockResolvedValue({ data: { nome: 'Pessoa Responsável' }, error: null });
  });

  it('usa somente a empresa e o responsável vinculados à sessão', async () => {
    await expect(resolveDocumentShareIdentity()).resolves.toEqual({
      empresaId: 'empresa-real',
      empresaNome: 'Escritório Real',
      usuarioNome: 'Pessoa Responsável',
    });
  });

  it('bloqueia o compartilhamento quando a empresa não tem nome real', async () => {
    mocks.companySingle.mockResolvedValue({
      data: { nome_fantasia: '', razao_social: '' },
      error: null,
    });

    await expect(resolveDocumentShareIdentity()).rejects.toThrow('Complete o nome do escritório');
  });

  it('bloqueia o compartilhamento quando o ator não pode ser identificado', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'usuario-real', user_metadata: { nome: 'Nome autodeclarado' } } },
      error: null,
    });
    mocks.profileSingle.mockResolvedValue({ data: null, error: null });

    await expect(resolveDocumentShareIdentity()).rejects.toThrow('Complete seu nome');
  });
});
