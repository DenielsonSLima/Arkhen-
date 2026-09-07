import { supabase } from '../../../../lib/supabase';

type BankChargeResponse = {
  ok?: boolean;
  error?: string;
  cobranca?: unknown;
  integracao?: unknown;
};

const pendingIds = new Map<string, string>();
const running = new Map<string, Promise<BankChargeResponse>>();

const storage = () => {
  try { return globalThis.localStorage; } catch { return undefined; }
};

const getRequestId = (key: string) => {
  let id = pendingIds.get(key);
  try { id ||= storage()?.getItem(key) || undefined; } catch { /* Private storage. */ }
  if (!id || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) id = crypto.randomUUID();
  pendingIds.set(key, id);
  try { storage()?.setItem(key, id); } catch { /* The backend also keeps the attempt. */ }
  return id;
};

// Keep only an opaque digest and request ID locally, never payer or banking data.
export const requestBankCharge = async (payload: Record<string, unknown>): Promise<BankChargeResponse> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user.id) throw new Error('Sessão ausente. Entre novamente para emitir a cobrança.');
  const canonical = JSON.stringify(Object.fromEntries(Object.entries(payload).sort(([a], [b]) => a.localeCompare(b))));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const key = `arkhen:inter:request:${session.user.id}:${fingerprint}`;
  const existing = running.get(key);
  if (existing) return existing;

  const requestId = getRequestId(key);
  const operation = (async () => {
    const { data, error } = await supabase.functions.invoke('bank-create-charge', {
      body: { ...payload, request_id: requestId },
    });
    if (error) {
      const context = 'context' in error ? error.context : null;
      const detail = context instanceof Response ? await context.clone().json().catch(() => null) : null;
      throw new Error(detail?.error || 'Não foi possível confirmar a cobrança. Tente novamente para consultar a mesma emissão.');
    }
    if (!data?.ok || !data.cobranca) throw new Error(data?.error || 'O Inter ainda não confirmou a cobrança. Tente novamente para consultar a mesma emissão.');
    pendingIds.delete(key);
    try { storage()?.removeItem(key); } catch { /* Server-side idempotency remains authoritative. */ }
    return data as BankChargeResponse;
  })();
  running.set(key, operation);
  try { return await operation; } finally { running.delete(key); }
};
