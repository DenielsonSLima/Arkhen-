import { supabase } from '../../../../../lib/supabase';
import { assertNationalFormSupported, type NationalDraftFields } from './nationalFormData';
export interface NationalReviewRequest { service_reference?:string; fiscal_config_id: string; charge_id: string; draft_id: string; fields: NationalDraftFields; expected_reviewed_at?: string | null }
export async function saveNationalReview(request: NationalReviewRequest) {
  const { data, error } = await supabase.functions.invoke('fiscal-integration', { body: { action: request.service_reference?'national-review-service':'national-review-draft', ...request } });
  if (error || !data?.ok) throw Error('A revisão nacional não foi salva. Verifique os dados e a disponibilidade da integração; nenhuma transmissão foi solicitada.');
  if (typeof data.reviewedAt !== 'string' || data.draftId !== request.draft_id || data.state !== 'REVIEWED_ONLY' || data.submitted !== false || data.liveReady !== false) throw Error('Resposta inesperada da revisão nacional. Não tente emitir; confira o registro com o suporte.');
  return data as { ok: true; state: 'REVIEWED_ONLY'; submitted: false; liveReady: false; reviewedAt: string; draftId: string };
}
export interface NationalStoredReview {
  draftId: string; fields: NationalDraftFields; state: 'REVIEWED_ONLY' | 'REVIEW_REQUIRED' | 'PREPARED_LOCKED';
  editable: boolean; reviewedAt: string;
}
export async function getNationalChargeReview(configId: string, chargeId: string, serviceReference?: string): Promise<NationalStoredReview | null> {
  const { data, error } = await supabase.functions.invoke('fiscal-integration', {
    body: { action: serviceReference?'national-get-service-review':'national-get-charge-review', fiscal_config_id: configId, charge_id: chargeId, ...(serviceReference?{service_reference:serviceReference}:{}) },
  });
  if (error || data?.ok !== true || data.liveReady !== false || !('review' in data))
    throw Error('Não foi possível carregar a revisão nacional. Tente novamente antes de salvar.');
  if (data.review === null) return null;
  const r = data.review;
  if (typeof r.draftId !== 'string' || !['REVIEWED_ONLY','REVIEW_REQUIRED','PREPARED_LOCKED'].includes(r.state)
    || typeof r.editable !== 'boolean' || r.editable !== (r.state !== 'PREPARED_LOCKED')
    || !r.fields || typeof r.fields !== 'object' || r.fields.environment !== 'HOMOLOGACAO')
    throw Error('Revisão nacional inválida. Nenhuma alteração foi feita.');
  try { assertNationalFormSupported(r.fields); } catch { throw Error('Revisão nacional incompatível. Nenhuma alteração foi feita.'); }
  return r as NationalStoredReview;
}
