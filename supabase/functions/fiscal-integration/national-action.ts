import { handleNationalList } from './national-list-action.ts';
import { handleNationalLoadReview } from './national-load-review-action.ts';
import { handleNationalReview } from './national-review-action.ts';
import type { NationalRpcClient } from '../_shared/nfse-national/rpc-ledger.ts';
/** Does not trust browser snapshots, credentials, permissions or environment gates. */
export async function handleNationalAction(admin: NationalRpcClient, authenticatedUserId: string,
  payload: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  const action = payload.action;
  if (action === 'national-list-reviews') return handleNationalList(admin, authenticatedUserId, payload);
  if ((action === 'national-get-charge-review' || action === 'national-get-service-review')) return handleNationalLoadReview(admin, authenticatedUserId, payload);
  if ((action === 'national-review-draft' || action === 'national-review-service')) return handleNationalReview(admin, authenticatedUserId, payload);
  if (action !== 'national-readiness') {
    return { status: 409, body: { ok: false, code: 'NATIONAL_TRANSPORT_NOT_ENABLED',
      error: 'Emissao e cancelamento nacionais ainda bloqueados. Nenhum envio fiscal foi realizado.' } };
  }
  const configId = payload.fiscal_config_id;
  if (typeof configId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(configId)) {
    return { status: 400, body: { ok: false, code: 'INVALID_FISCAL_CONFIG' } };
  }
  const { data, error } = await admin.rpc('national_nfse_readiness_edge',
    { p_user_id: authenticatedUserId, p_fiscal_config_id: configId });
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    return { status: 403, body: { ok: false, code: 'NATIONAL_CONFIG_UNAVAILABLE' } };
  }
  const result = data as Record<string, unknown>;
  // Explicit allowlist prevents future RPC fields or credentials from escaping to clients.
  return { status: 200, body: { ok: true, provider: 'NATIONAL', liveReady: false,
    productionEnabled: false, certificateConfigured: result.certificateConfigured === true,
    certificateValidUntil: typeof result.certificateValidUntil === 'string' ? result.certificateValidUntil : null,
    blockers: ['NATIONAL_TRANSPORT_NOT_ENABLED', 'NATIONAL_SCHEMA_SIGNATURE_INTEGRATION_PENDING'] } };
}
