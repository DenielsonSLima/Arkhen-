import { beforeEach, describe, expect, it, vi } from 'vitest';
const invoke = vi.hoisted(() => vi.fn());
vi.mock('../../../../lib/supabase', () => ({ supabase: { functions: { invoke } } }));
import { consultarNfseManual, emitirNfseManual, nfseResultMessage } from './nfseService';

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
  it.each(['confirmada', 'cancelada', 'substituida'] as const)('preserva situação %s na consulta e na mensagem', async (situacao) => {
    for (const ambiente of ['homologacao', 'producao'] as const) {
      invoke.mockResolvedValue({ data: { ok: true, nfseId: '123', ambiente, situacao }, error: null });
      const result = await consultarNfseManual('cobranca');
      expect(result).toEqual({ nfseId: '123', ambiente, situacao });
      expect(nfseResultMessage(result)).toContain(situacao === 'substituida' ? 'substituída' : situacao);
      expect(nfseResultMessage(result)).toContain(ambiente === 'homologacao' ? 'homologação — sem valor fiscal' : 'produção');
      expect(invoke).toHaveBeenLastCalledWith('fiscal-integration', { body: { action: 'consult-nfse', cobranca_id: 'cobranca' } });
    }
  });
  it('não apresenta retorno legado sem situação como nota confirmada', async () => {
    invoke.mockResolvedValue({ data: { ok: true, nfseId: '123', ambiente: 'producao' }, error: null });
    const result = await consultarNfseManual('cobranca');
    expect(nfseResultMessage(result)).toContain('Situação fiscal não informada');
    expect(nfseResultMessage(result)).not.toContain('confirmada');
  });
  it('não transforma uma situação desconhecida em confirmação', async () => {
    invoke.mockResolvedValue({ data: { ok: true, nfseId: '123', ambiente: 'producao', situacao: 'desconhecida' }, error: null });
    await expect(consultarNfseManual('cobranca')).rejects.toThrow('situação desconhecida');
  });
  it('exibe orientação de reconciliação do backend sem repetir a chamada', async () => {
    invoke.mockResolvedValue({ data: null, error: {
      message: 'Edge error', context: new Response(JSON.stringify({ error: 'Consulte o RPS pendente.' }), { status: 400 }),
    } });
    await expect(emitirNfseManual('cobranca')).rejects.toThrow('Consulte o RPS pendente.');
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
