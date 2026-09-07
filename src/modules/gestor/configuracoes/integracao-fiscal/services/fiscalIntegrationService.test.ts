import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../../../../lib/supabase', () => ({
  supabase: { rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test-token' } } }) } }, supabaseProjectUrl: 'https://example.supabase.co',
}));
import { WebIssAdapter, fiscalIntegrationService } from './fiscalIntegrationService';
import { DEFAULT_CONFIG } from './fiscalIntegrationDefaults';

describe('WebISS não simula autorização fiscal', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('adapter legado não emite números ou protocolos fictícios', async () => {
    await expect(new WebIssAdapter().emitNfse(DEFAULT_CONFIG, '1')).rejects.toThrow('backend de faturamento');
    await expect(new WebIssAdapter().testConnection('user', 'password')).rejects.toThrow('serviço fiscal seguro');
  });
  it('não usa WebISS para outro provedor', () => {
    expect(() => fiscalIntegrationService.getAdapter('GINFES')).toThrow('não implementado');
  });
  it('contexto novo começa desabilitado', async () => {
    const draft = await fiscalIntegrationService.getContext({ companyId: 'office', companyName: 'Escritório', uf: 'SE', municipio: 'Itabaiana' });
    expect(draft.context.isActive).toBe(false);
    expect(draft.config.certificadoArquivoConfigured).toBe(false);
    expect(draft.history).toEqual([]);
  });
  it('preserva a senha literal do PFX, incluindo espaços e marcador dentro da senha', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: {
      context: { companyId: 'office', uf: 'SE', municipio: 'Itabaiana' }, config: {}, stats: {}, history: [],
    } }) });
    vi.stubGlobal('fetch', fetchMock);
    const password = '  senha•literal  ';
    await fiscalIntegrationService.uploadCertificate(
      { companyId: 'office', companyName: 'Escritório', uf: 'SE', municipio: 'Itabaiana' },
      { ...DEFAULT_CONFIG, certificadoSenha: password }, new File(['fixture'], 'certificado.pfx'),
    );
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect((request.body as FormData).get('certificadoSenha')).toBe(password);
  });

});
