/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exemploXml } from '../../configuracoes/integracao-fiscal/modelos/nfse/itabaiana/exemplo.test-fixture';

const mock = vi.hoisted(() => {
  const query = { select: vi.fn(), eq: vi.fn(), single: vi.fn(), maybeSingle: vi.fn(), order: vi.fn(), limit: vi.fn() };
  return { query, from: vi.fn(() => query) };
});
vi.mock('../../../../lib/supabase', () => ({ supabase: { from: mock.from } }));
vi.mock('../../configuracoes/integracao-fiscal/modelos/nfse/itabaiana/carregarModelo', () => ({ baixarNfsePdf: vi.fn() }));
import { baixarNfsePdf } from '../../configuracoes/integracao-fiscal/modelos/nfse/itabaiana/carregarModelo';
import { downloadNfseDocument, getNfseDocumentXml } from './nfseDocumentService';

beforeEach(() => {
  vi.clearAllMocks();
  for (const name of ['select', 'eq', 'order', 'limit'] as const) mock.query[name].mockReturnValue(mock.query);
});
describe('XML para o PDF da cobrança', () => {
  it('leva a mesma empresa da cobrança ao carregamento da marca cadastrada', async () => {
    mock.query.single.mockResolvedValue({ data: { nfse_payload: { xml: exemploXml } }, error: null });
    await downloadNfseDocument('empresa-a', 'cobranca', { nfseId: '2026000000001', ambiente: 'producao' });
    expect(baixarNfsePdf).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ empresaId: 'empresa-a' }));
  });
  it.each([
    ['', false, false],
    ['<NfseCancelamento/>', true, false],
    ['<NfseSubstituicao/>', false, true],
    ['<NfseCancelamento/><NfseSubstituicao/>', true, true],
  ])('preserva situação do XML no PDF: %s', async (eventos, cancelada, substituida) => {
    const xml = exemploXml.replace('</CompNfse>', `${eventos}</CompNfse>`);
    for (const ambiente of ['producao', 'homologacao'] as const) {
      mock.query.single.mockResolvedValue({ data: { nfse_payload: { xml } }, error: null });
      mock.query.maybeSingle.mockResolvedValue({ data: { detalhes: { xml } }, error: null });
      await downloadNfseDocument('empresa-a', 'cobranca', { nfseId: '2026000000001', ambiente });
      expect(baixarNfsePdf).toHaveBeenLastCalledWith(expect.anything(), { empresaId: 'empresa-a', ambiente, cancelada, substituida });
    }
  });
  it.each(['cancelada', 'substituida'] as const)('preserva retorno %s quando XML armazenado não contém o evento', async (situacao) => {
    mock.query.single.mockResolvedValue({ data: { nfse_payload: { xml: exemploXml } }, error: null });
    await downloadNfseDocument('empresa-a', 'cobranca', { nfseId: '2026000000001', ambiente: 'producao', situacao });
    expect(baixarNfsePdf).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ [situacao]: true }));
  });
  it('busca produção pela empresa, cobrança e número, sem usar logs de homologação', async () => {
    mock.query.single.mockResolvedValue({ data: { nfse_payload: { xml: exemploXml } }, error: null });
    await expect(getNfseDocumentXml('empresa', 'cobranca', { nfseId: '2026000000001', ambiente: 'producao' })).resolves.toHaveProperty('kind', 'nfse');
    expect(mock.from).toHaveBeenCalledWith('financeiro_cobrancas');
    expect(mock.query.eq.mock.calls).toEqual([['empresa_id', 'empresa'], ['id', 'cobranca'], ['nfse_id', '2026000000001']]);
  });
  it('exige vínculo da homologação com a mesma cobrança, empresa e ambiente', async () => {
    mock.query.maybeSingle.mockResolvedValue({ data: { detalhes: { xml: exemploXml } }, error: null });
    await getNfseDocumentXml('empresa', 'cobranca', { nfseId: '2026000000001', ambiente: 'homologacao' });
    expect(mock.from).toHaveBeenCalledWith('configuracoes_integracao_fiscal_logs');
    expect(mock.query.eq.mock.calls).toContainEqual(['empresa_id', 'empresa']);
    expect(mock.query.eq.mock.calls).toContainEqual(['detalhes->>cobrancaId', 'cobranca']);
    expect(mock.query.eq.mock.calls).toContainEqual(['detalhes->>ambiente', 'homologacao']);
  });
  it('recusa XML ausente, erro de permissão e documento com número divergente', async () => {
    const result = { nfseId: '1', ambiente: 'producao' as const };
    mock.query.single.mockResolvedValue({ data: null, error: { message: 'Sem acesso' } });
    await expect(getNfseDocumentXml('empresa', 'cobranca', result)).rejects.toThrow('Não foi possível');
    mock.query.single.mockResolvedValue({ data: { nfse_payload: {} }, error: null });
    await expect(getNfseDocumentXml('empresa', 'cobranca', result)).rejects.toThrow('não está disponível');
    mock.query.single.mockResolvedValue({ data: { nfse_payload: { xml: exemploXml } }, error: null });
    await expect(getNfseDocumentXml('empresa', 'cobranca', result)).rejects.toThrow('não corresponde');
  });
});
