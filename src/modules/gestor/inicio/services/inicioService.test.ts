import { beforeEach, describe, expect, it, vi } from 'vitest';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../../../lib/supabase', () => ({ supabase: { rpc } }));
import { inicioService } from './inicioService';
describe('indicadores e validades do início', () => {
  beforeEach(() => rpc.mockReset());
  it('preserva agregados completos recebidos do servidor sem cortar pelos cards', async () => {
    const stats = { total: 250, pendentes: 220, empresasAtivas: 19, usuarios: [] };
    rpc.mockResolvedValue({ data: stats, error: null });
    await expect(inicioService.getDashboardData()).resolves.toEqual({ stats });
    expect(rpc).toHaveBeenCalledWith('obter_inicio_operacional');
  });
  it('propaga falha do banco em vez de apresentar estatística fictícia', async () => {
    const error = new Error('Sem permissão'); rpc.mockResolvedValue({ data: null, error });
    await expect(inicioService.getDashboardData()).rejects.toThrow('Sem permissão');
    await expect(inicioService.getVencimentosProximos()).rejects.toThrow('Sem permissão');
  });
  it('consulta validade persistida e distingue resposta inválida de lista vazia', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: null, error: null });
    await expect(inicioService.getVencimentosProximos()).resolves.toEqual([]);
    await expect(inicioService.getVencimentosProximos()).rejects.toThrow('validades');
    expect(rpc).toHaveBeenCalledWith('obter_alertas_validade_inicio');
  });
});
