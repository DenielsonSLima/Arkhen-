// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn(), createSignedUrl: vi.fn() }));
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mock.rpc, functions: { invoke: mock.invoke }, storage: { from: () => ({ createSignedUrl: mock.createSignedUrl }) } } }));
vi.mock('../../gestor/documentos/services/documentShareService', () => ({ formatShareDateTime: () => '', hashSharePassword: async () => 'a'.repeat(64) }));
import { checkPassword, createDocumentAccessUrl, fetchPublicShare } from './publicSharedDocumentHelpers';
import type { PublicSharedDocumentPayload } from './types';
const doc = { id: 'row-1', documento: 'arquivo.pdf', storage_bucket: null, storage_path: null };
const share = { shareGroupId: 'group-1', documents: [doc], senhaObrigatoria: true } as PublicSharedDocumentPayload;
beforeEach(() => { vi.clearAllMocks(); window.history.replaceState({}, '', '/shared/d/group-1'); });
describe('entrega pública pelo endpoint autorizado', () => {
  it('desbloqueia com autorização Edge mesmo metadados sem bucket/path', async () => {
    mock.invoke.mockResolvedValue({ data: { ok: true, signedUrl: 'https://storage.example/arquivo' }, error: null });
    const result = await checkPassword('senha', share);
    expect(result.ok).toBe(true);
    expect(mock.invoke).toHaveBeenCalledWith('get-shared-document-url', { body: { shareGroupId: 'group-1', shareRowId: 'row-1', passwordHash: 'a'.repeat(64) } });
    expect(mock.createSignedUrl).not.toHaveBeenCalled();
  });
  it('não desbloqueia senha negada/rate limit e não inventa acesso', async () => {
    mock.invoke.mockResolvedValue({ data: { ok: false }, error: new Error('429') });
    expect((await checkPassword('errada', share)).ok).toBe(false);
  });
  it('rejeita URL de protocolo ativo mesmo resposta ok', async () => {
    mock.invoke.mockResolvedValue({ data: { ok: true, signedUrl: 'javascript:invalid' }, error: null });
    await expect(createDocumentAccessUrl(doc, 'group-1')).rejects.toThrow('URL do arquivo inválida');
  });
  it('não aceita documento inventado no fragmento quando token não existe', async () => {
    window.history.replaceState({}, '', '/shared/d/inexistente#payload-sem-assinatura');
    mock.rpc.mockResolvedValue({ data: [], error: null });
    expect(await fetchPublicShare()).toBeNull();
  });
});
