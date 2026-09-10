/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { editableFiscalData } from '../forms/nfse/fiscalFormData';
import { fiscalBillingKeys } from '../queries/useFaturamentoFiscalQueries';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }));
vi.mock('../../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc, functions: { invoke: mocks.invoke } } }));
import { faturamentoFiscalService as service } from './faturamentoFiscalService';
const scope = { fiscalConfigId: 'emitter', clienteId: 'partner', ambiente: 'producao' as const, dataInicial: '2026-01-01', dataFinal: '2026-09-10' };
beforeEach(() => { vi.resetAllMocks(); mocks.rpc.mockResolvedValue({ data: {}, error: null }); mocks.invoke.mockResolvedValue({ data: { ok: true }, error: null }); });
describe('Contrato fiscal Faturamento', () => {
  it('bloqueia transmissão de produção antes de chamar a Edge Function', () => {
    expect(() => service.emit({ ambiente: 'producao' } as Parameters<typeof service.emit>[0])).toThrow('produção não está liberada');
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('encaminha origem e ambiente ao baixar XML de notas consultadas', async () => {
    await service.document({ id: 'external-note', origem: 'consultada', ambiente: 'producao' });
    expect(mocks.rpc).toHaveBeenCalledWith('obter_documento_nfse_webiss', { p_rascunho_id: 'external-note', p_origem: 'consultada', p_ambiente: 'producao' });
  });
  it('consulta WebISS com ambiente e intervalo explícitos sem ação de emissão', async () => {
    await service.sync(scope, scope.dataInicial, scope.dataFinal);
    expect(mocks.invoke).toHaveBeenCalledWith('fiscal-integration', { body: { action: 'sync-consulted-nfse', fiscalConfigId: 'emitter', clienteId: 'partner', ambiente: 'producao', dataInicial: scope.dataInicial, dataFinal: scope.dataFinal } });
  });
  it('copia identificando a fonte no servidor e preservando nova competência e filtro', async () => {
    await service.copy(scope, { id: 'old-note', origem: 'consultada', numero: '292', emissao: '', valor: 405, dados: {}, qualidade: { faltantes: [] } }, '2026-09-01');
    expect(mocks.rpc).toHaveBeenCalledWith('copiar_rascunho_nfse_webiss', {
      p_origem_id: 'old-note', p_origem: 'consultada', p_cliente_id: 'partner', p_fiscal_config_id: 'emitter', p_ambiente: 'producao',
      p_competencia: '2026-09-01', p_data_inicial: scope.dataInicial, p_data_final: scope.dataFinal,
    });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('exclui chaves/número/RPS/assinatura de dados editáveis e não muda período da descrição', () => {
    const result = editableFiscalData({ competencia: '2026-09-01', descricao: 'Serviços de agosto', valor: 405,
      numero: '292', rpsNumero: '40', codigoVerificacao: 'SECRET', Signature: 'value', chaveAcesso: 'key' } as Parameters<typeof editableFiscalData>[0]);
    expect(result).toMatchObject({ competencia: '2026-09-01', descricao: 'Serviços de agosto', valor: 405 });
    for (const key of ['numero', 'rpsNumero', 'codigoVerificacao', 'Signature', 'chaveAcesso']) expect(result).not.toHaveProperty(key);
  });
  it('separa cache de últimas notas por tenant, emitente, tomador, ambiente e período', () => {
    const baseline = fiscalBillingKeys.previous('tenant-a', scope);
    expect(fiscalBillingKeys.previous('tenant-b', scope)).not.toEqual(baseline);
    for (const next of [{ ...scope, clienteId: 'other' }, { ...scope, fiscalConfigId: 'other' }, { ...scope, ambiente: 'homologacao' as const }, { ...scope, dataInicial: '2026-02-01' }]) {
      expect(fiscalBillingKeys.previous('tenant-a', next)).not.toEqual(baseline);
    }
  });
});
