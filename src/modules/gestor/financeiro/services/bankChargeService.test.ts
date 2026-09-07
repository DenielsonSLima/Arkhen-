import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({
  auth: { getSession: vi.fn() },
  functions: { invoke: vi.fn() },
}));
vi.mock('../../../../lib/supabase', () => ({ supabase: client }));

describe('retentativas de cobrança Inter', () => {
  const payload = { cliente_empresa_id: 'cliente-1', valor: 500, data_vencimento: '2026-10-01', meio_pagamento: 'Pix' };
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('crypto', webcrypto);
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    client.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
  });

  it('preserva a referência após resposta inconclusiva e recarregamento do módulo', async () => {
    client.functions.invoke.mockResolvedValueOnce({ data: null, error: new Error('timeout') });
    const first = await import('./bankChargeService');
    await expect(first.requestBankCharge(payload)).rejects.toThrow('mesma emissão');
    const id = client.functions.invoke.mock.calls[0][1].body.request_id;
    vi.resetModules();
    client.functions.invoke.mockResolvedValueOnce({ data: { ok: true, cobranca: { id: 'saved' } }, error: null });
    const reloaded = await import('./bankChargeService');
    await reloaded.requestBankCharge(payload);
    expect(client.functions.invoke.mock.calls[1][1].body.request_id).toBe(id);
  });

  it('compartilha uma requisição entre cliques concorrentes', async () => {
    client.functions.invoke.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { data: { ok: true, cobranca: { id: 'saved' } }, error: null };
    });
    const { requestBankCharge } = await import('./bankChargeService');
    const [first, second] = await Promise.all([requestBankCharge(payload), requestBankCharge(payload)]);
    expect(client.functions.invoke).toHaveBeenCalledOnce();
    expect(first).toEqual(second);
  });

  it('permite uma nova emissão intencional após sucesso confirmado', async () => {
    client.functions.invoke.mockResolvedValue({ data: { ok: true, cobranca: { id: 'saved' } }, error: null });
    const { requestBankCharge } = await import('./bankChargeService');
    await requestBankCharge(payload);
    await requestBankCharge(payload);
    expect(client.functions.invoke.mock.calls[0][1].body.request_id)
      .not.toBe(client.functions.invoke.mock.calls[1][1].body.request_id);
  });

  it('não compartilha referência pendente entre usuários', async () => {
    client.functions.invoke.mockResolvedValue({ data: { ok: false, error: 'Aguardando Inter' }, error: null });
    const { requestBankCharge } = await import('./bankChargeService');
    await expect(requestBankCharge(payload)).rejects.toThrow();
    client.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-2' } } } });
    await expect(requestBankCharge(payload)).rejects.toThrow();
    expect(client.functions.invoke.mock.calls[0][1].body.request_id)
      .not.toBe(client.functions.invoke.mock.calls[1][1].body.request_id);
  });
});
