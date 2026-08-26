import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../lib/supabase', () => ({
  supabase: { from: fromMock, rpc: rpcMock },
}));

import { inicioSetupService } from './inicioSetupService';

describe('inicioSetupService tenant scope', () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: 'empresa-ativa', error: null });
  });

  it('fixa todas as leituras na empresa ativa além de manter o RLS', async () => {
    const scopedTables: string[] = [];
    fromMock.mockImplementation((table: string) => {
      const isConfig = table === 'configuracoes_empresa' || table === 'configuracoes_marca_dagua';
      const isClients = table === 'clientes';
      const terminal = isConfig
        ? { data: null, error: null }
        : isClients ? { data: [], error: null } : { count: 0, error: null };
      const builder = {
        select: vi.fn(),
        eq: vi.fn(),
        maybeSingle: vi.fn(() => Promise.resolve(terminal)),
      };
      builder.select.mockReturnValue(builder);
      builder.eq.mockImplementation((column: string, value: unknown) => {
        if (column === 'empresa_id') {
          scopedTables.push(`${table}:${value}`);
          return builder;
        }
        return Promise.resolve(terminal);
      });
      return builder;
    });

    await inicioSetupService.getStatus();

    expect(rpcMock).toHaveBeenCalledWith('current_empresa_id');
    expect(scopedTables).toEqual([
      'configuracoes_empresa:empresa-ativa',
      'configuracoes_marca_dagua:empresa-ativa',
      'clientes:empresa-ativa',
      'atividades_modelos:empresa-ativa',
      'atividades_rotinas:empresa-ativa',
      'atividades_tarefas:empresa-ativa',
      'configuracoes_usuarios:empresa-ativa',
    ]);
  });
});
