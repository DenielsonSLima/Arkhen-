// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn(), invoke: vi.fn() }));
vi.mock('../../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc, auth: { getUser: mocks.getUser }, functions: { invoke: mocks.invoke } } }));
import { recorrenciaService, recurrenceRequestId, type RecorrenciaInput } from './recorrenciaService';
const input: RecorrenciaInput = {
  clienteEmpresaId: 'client', descricaoServico: 'Honorários [MES]/[ANO]', valorMensal: 405, diaVencimento: 10,
  ativo: true, recorrenciaAtiva: false, gerarPrimeiraCobranca: true,
  recorrenciaConfig: { meioPagamento: 'Ambos', descontoPercentual: 0, jurosPercentual: 1, multaPercentual: 2,
    mensagemBoleto: '', diaProcessamento: 1, primeiraCompetencia: '2026-09-01', competenciaOffset: -1,
    modoFiscal: 'sem_nfse', ambiente: 'homologacao', fiscalConfigId: '', dadosFiscais: {} },
};
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); vi.stubGlobal('crypto', webcrypto);
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('Recorrência durável', () => {
  it('preserva request após resposta perdida do cadastro e retoma sem mudar contrato/termos', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Resposta perdida' } });
    await expect(recorrenciaService.save(input)).rejects.toThrow('Resposta perdida');
    const request = mocks.rpc.mock.calls[0][1].p_request_id;
    mocks.rpc.mockResolvedValueOnce({ data: { contrato: { id: 'saved' }, execucao: { id: 'run' } }, error: null });
    expect(await recorrenciaService.save(structuredClone(input))).toMatchObject({ contrato: { id: 'saved' } });
    expect(mocks.rpc.mock.calls[1][1].p_request_id).toBe(request);
    expect(mocks.rpc.mock.calls[1][1].p_payload).toMatchObject({ automacaoAtiva: false, config: { competenciaOffset: -1, gerarCobranca: true } });
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });
  it('não armazena dados financeiros no navegador e separa request por usuário', async () => {
    const a = await recurrenceRequestId(input, 'a'); const b = await recurrenceRequestId(input, 'b');
    expect(a.id).not.toBe(b.id);
    expect(localStorage.getItem(a.key)).toBe(a.id);
    expect(a.key).not.toContain('Honorários');
    expect((await recurrenceRequestId({ ...input }, 'a')).id).toBe(a.id);
  });
  it('mapeia a configuração do RPC sem reenviar campos auxiliares antigos', async () => {
    mocks.rpc.mockResolvedValue({ data: { id: 'contract', clienteEmpresaId: 'client', descricaoServico: 'Mensalidade',
      valorMensal: 200, diaVencimento: 10, ativo: true, automacaoAtiva: true, config: input.recorrenciaConfig }, error: null });
    const config = await recorrenciaService.config('contract');
    expect(config).toMatchObject({ id: 'contract', recorrenciaAtiva: true, gerarPrimeiraCobranca: false, recorrenciaConfig: input.recorrenciaConfig });
    expect(config).not.toHaveProperty('config');
    expect(config).not.toHaveProperty('automacaoAtiva');
  });
  it('não reporta falha de cadastro quando só a limpeza do armazenamento falha', async () => {
    mocks.rpc.mockResolvedValue({ data: { contrato: { id: 'saved' } }, error: null });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('storage'); });
    await expect(recorrenciaService.save(input)).resolves.toMatchObject({ contrato: { id: 'saved' } });
  });
  it('não confunde nenhuma etapa disponível com cobrança confirmada', async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: true, processed: 0, pending: true, message: 'Aguardando pagamento' }, error: null });
    await expect(recorrenciaService.run('execution')).rejects.toThrow('Aguardando pagamento');
    expect(mocks.invoke).toHaveBeenCalledWith('recurrence-worker', { body: { execucaoId: 'execution' } });
  });
});
