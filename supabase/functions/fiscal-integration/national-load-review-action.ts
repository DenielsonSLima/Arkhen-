import type { NationalRpcClient } from '../_shared/nfse-national/rpc-ledger.ts';
const uuid = (value: unknown): value is string => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export async function handleNationalLoadReview(admin: NationalRpcClient, userId: string, payload: Record<string, unknown>) {
  const service=payload.action==='national-get-service-review';
  if (!uuid(payload.fiscal_config_id) || (service?(typeof payload.service_reference!=='string'||!/^[A-Z0-9][A-Z0-9._/-]{2,79}$/.test(payload.service_reference)):!uuid(payload.charge_id)))
    return { status: 400, body: { ok: false, code: 'NATIONAL_REVIEW_INVALID_INPUT' } };
  try {
    const result = await admin.rpc(service?'national_nfse_get_service_review_edge':'national_nfse_get_charge_review_edge', {
      p_user_id: userId, p_fiscal_config_id: payload.fiscal_config_id, ...(service?{p_service_reference:payload.service_reference}:{p_charge_id:payload.charge_id}),
    });
    if (result.error || !result.data || typeof result.data !== 'object' || Array.isArray(result.data)) throw Error('DENIED');
    const { review } = result.data as { review?: unknown };
    if (review === null) return { status: 200, body: { ok: true, review: null, liveReady: false } };
    if (!review || typeof review !== 'object' || Array.isArray(review)) throw Error('INVALID_REVIEW');
    const value = review as Record<string, unknown>;
    if (!uuid(value.draftId) || !['PREPARED_LOCKED', 'REVIEW_REQUIRED', 'REVIEWED_ONLY'].includes(String(value.state))
      || typeof value.editable !== 'boolean' || !value.fields || typeof value.fields !== 'object'
      || Array.isArray(value.fields) || typeof value.reviewedAt !== 'string') throw Error('INVALID_REVIEW');
    if (value.editable !== (value.state !== 'PREPARED_LOCKED')) throw Error('INVALID_REVIEW');
    return { status: 200, body: { ok: true, liveReady: false, review: {
      draftId: value.draftId, fields: value.fields, state: value.state, editable: value.editable, reviewedAt: value.reviewedAt,
    } } };
  } catch {
    return { status: 403, body: { ok: false, code: 'NATIONAL_REVIEW_UNAVAILABLE',
      error: 'Nao foi possivel consultar a revisao desta cobranca e emitente.' } };
  }
}
