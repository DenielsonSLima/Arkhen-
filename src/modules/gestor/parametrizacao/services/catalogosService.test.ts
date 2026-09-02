import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getCurrentEmpresaId: vi.fn(),
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: { from: mocks.from },
}));

vi.mock('./parametrizacaoSupabase', () => ({
  getCurrentEmpresaId: mocks.getCurrentEmpresaId,
}));

import { catalogosService } from './catalogosService';

const queryBuilder = (result: unknown) => {
  const query: Record<string, any> = {};
  for (const method of ['select', 'update', 'eq', 'order']) {
    query[method] = vi.fn(() => query);
  }
  query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => (
    Promise.resolve(result).then(resolve, reject)
  );
  return query;
};

describe('catalogosService tenant isolation', () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.getCurrentEmpresaId.mockReset();
    mocks.getCurrentEmpresaId.mockResolvedValue('empresa-atual');
  });

  it('lists only catalog items from the current company', async () => {
    const query = queryBuilder({ data: [], error: null });
    mocks.from.mockReturnValue(query);

    await catalogosService.list('tipos_empresa');

    expect(query.eq).toHaveBeenCalledWith('empresa_id', 'empresa-atual');
    expect(query.eq).toHaveBeenCalledWith('tipo', 'tipos_empresa');
  });

  it('returns the canonical catalog order before using the name as a tie-breaker', async () => {
    const query = queryBuilder({
      data: [
        { id: 'demais', codigo: 'demais', nome: 'Demais', descricao: '', sistema: true, ativo: true, ordem: 50 },
        { id: 'epp', codigo: 'epp', nome: 'EPP', descricao: '', sistema: true, ativo: true, ordem: 40 },
        { id: 'mei', codigo: 'mei', nome: 'MEI', descricao: '', sistema: true, ativo: true, ordem: 20 },
        { id: 'me', codigo: 'microempresa', nome: 'ME', descricao: '', sistema: true, ativo: true, ordem: 30 },
      ],
      error: null,
    });
    mocks.from.mockReturnValue(query);

    const result = await catalogosService.list('tipos_empresa');

    expect(result.map((item) => item.nome)).toEqual(['MEI', 'ME', 'EPP', 'Demais']);
    expect(query.order).toHaveBeenNthCalledWith(1, 'ordem', { ascending: true });
    expect(query.order).toHaveBeenNthCalledWith(2, 'nome', { ascending: true });
  });

  it('scopes catalog updates by current company and type', async () => {
    const query = queryBuilder({ error: null });
    mocks.from.mockReturnValue(query);

    await catalogosService.save({
      id: 'item-id',
      tipo: 'naturezas_juridicas',
      nome: 'Associação',
      descricao: '',
      ativo: true,
    });

    expect(query.eq).toHaveBeenCalledWith('id', 'item-id');
    expect(query.eq).toHaveBeenCalledWith('empresa_id', 'empresa-atual');
    expect(query.eq).toHaveBeenCalledWith('tipo', 'naturezas_juridicas');
  });

  it('scopes status changes by current company', async () => {
    const query = queryBuilder({ error: null });
    mocks.from.mockReturnValue(query);

    await catalogosService.setAtivo('item-id', false);

    expect(query.eq).toHaveBeenCalledWith('id', 'item-id');
    expect(query.eq).toHaveBeenCalledWith('empresa_id', 'empresa-atual');
  });
});
