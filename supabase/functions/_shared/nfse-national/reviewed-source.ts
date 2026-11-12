import type { NationalRpcClient } from './rpc-ledger.ts';
import type { ReviewedNationalSource } from './server-preparation.ts';
import type { NationalDpsInput } from './dps.types.ts';
/** No client payload fallback: fiscal permissions and reviewed data are loaded from private tables. */
export function nationalReviewedSource(client: NationalRpcClient): ReviewedNationalSource {
 return {
  async authorize(userId,scope) {
   const result=await client.rpc('national_nfse_authorize_edge',{p_user_id:userId,p_intent:scope});
   if(result.error || result.data!==true) throw new Error('NATIONAL_FISCAL_PERMISSION_DENIED');
  },
  async loadReviewed(userId,scope,draftId) {
   const result=await client.rpc('national_nfse_reviewed_source_edge',{p_user_id:userId,p_intent:{...scope,draftId}});
   if(result.error || !result.data || typeof result.data!=='object') throw new Error('NATIONAL_REVIEW_REQUIRED');
   const data=result.data as {snapshot:unknown;sourceRevision:unknown};
   if(!data.snapshot || typeof data.snapshot!=='object' || typeof data.sourceRevision!=='string' || !data.sourceRevision)
    throw new Error('NATIONAL_REVIEW_REQUIRED');
   return data.snapshot as Omit<NationalDpsInput,'number'|'series'|'issuedAt'>;
  },
 };
}
