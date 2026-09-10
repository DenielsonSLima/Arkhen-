import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
  return { query, rpc: vi.fn(), from: vi.fn(() => query) };
});
vi.mock('../../../../../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
import { marcaDaguaService } from './marcaDaguaService';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.select.mockReturnValue(mocks.query);
  mocks.query.eq.mockReturnValue(mocks.query);
  mocks.query.maybeSingle.mockResolvedValue({ data: null, error: null });
});
describe('Consulta da marca por empresa', () => {
  it('filtra explicitamente pelo tenant recebido na geração da nota', async () => {
    await marcaDaguaService.getMarcaDaguaConfigDaEmpresa('empresa-a');
    await marcaDaguaService.getMarcaDaguaConfigDaEmpresa('empresa-b');
    expect(mocks.query.eq.mock.calls).toEqual([['empresa_id', 'empresa-a'], ['empresa_id', 'empresa-b']]);
  });
  it('usa a empresa da sessão na prévia e nas configurações', async () => {
    mocks.rpc.mockResolvedValue({ data: 'empresa-sessao', error: null });
    await marcaDaguaService.getMarcaDaguaConfig();
    expect(mocks.rpc).toHaveBeenCalledWith('current_empresa_id');
    expect(mocks.query.eq).toHaveBeenCalledWith('empresa_id', 'empresa-sessao');
  });
  it('não consulta sem empresa nem oculta falha de permissão', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('Sessão inválida') });
    await expect(marcaDaguaService.getMarcaDaguaConfig()).rejects.toThrow('identificar');
    await expect(marcaDaguaService.getMarcaDaguaConfigDaEmpresa('')).rejects.toThrow('Empresa obrigatória');
    expect(mocks.from).not.toHaveBeenCalled();
    mocks.query.maybeSingle.mockResolvedValue({ data: null, error: new Error('Sem permissão') });
    await expect(marcaDaguaService.getMarcaDaguaConfigDaEmpresa('empresa-a')).rejects.toThrow('Sem permissão');
  });
});
