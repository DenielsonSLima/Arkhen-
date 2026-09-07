import { beforeEach, describe, expect, it, vi } from 'vitest';
const invoke = vi.hoisted(() => vi.fn());
vi.mock('../../../../lib/supabase', () => ({ supabase: { functions: { invoke } } }));
import { emitirNfseManual } from './nfseService';

describe('emissão NFS-e financeira', () => {
  beforeEach(() => invoke.mockReset());
  it('preserva ambiente de homologação para não anunciar nota de produção', async () => {
    invoke.mockResolvedValue({ data: { ok: true, nfseId: '123', ambiente: 'homologacao' }, error: null });
    await expect(emitirNfseManual('cobranca')).resolves.toEqual({ nfseId: '123', ambiente: 'homologacao' });
    expect(invoke).toHaveBeenCalledWith('fiscal-integration', { body: { action: 'emit-nfse', cobranca_id: 'cobranca' } });
  });
  it('recusa resposta sem ambiente confirmado', async () => {
    invoke.mockResolvedValue({ data: { ok: true, nfseId: '123' }, error: null });
    await expect(emitirNfseManual('cobranca')).rejects.toThrow('não identificou o ambiente');
  });
  it('exibe orientação de reconciliação do backend sem repetir a chamada', async () => {
    invoke.mockResolvedValue({ data: null, error: {
      message: 'Edge error', context: new Response(JSON.stringify({ error: 'Consulte o RPS pendente.' }), { status: 400 }),
    } });
    await expect(emitirNfseManual('cobranca')).rejects.toThrow('Consulte o RPS pendente.');
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
