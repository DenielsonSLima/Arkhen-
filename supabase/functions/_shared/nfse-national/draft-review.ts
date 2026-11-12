import type {NationalDpsInput} from './dps.types.ts';
import {buildNationalDps} from './dps.ts';
import type {NationalScope} from './adapter.ts';
import type {NationalRpcClient} from './rpc-ledger.ts';
import type {ReviewedNationalSource} from './server-preparation.ts';
import {requireContract} from './xml.ts';
export type NationalDraftFields=Omit<NationalDpsInput,'number'|'series'|'issuedAt'>;
/** Explicit national choices, never translated from WebISS enum/code defaults. */
export async function reviewNationalChargeDraft(userId:string,scope:NationalScope,draftId:string,chargeId:string,
 fields:NationalDraftFields,deps:{source:ReviewedNationalSource;client:NationalRpcClient}, expectedReviewedAt:string|null=null, serviceReference?:string) {
 requireContract(scope.environment==='homologacao' && fields.environment==='HOMOLOGACAO','NATIONAL_PRODUCTION_NOT_ENABLED');
 await deps.source.authorize(userId,scope);
 requireContract(fields.issuer.taxId.type==='CNPJ' && fields.issuer.taxId.value===scope.issuerCnpj,'NATIONAL_ISSUER_MISMATCH');
 requireContract(!('number' in fields) && !('series' in fields) && !('issuedAt' in fields),'NATIONAL_SERVER_IDENTITY_REQUIRED');
 requireContract(fields.review.ibscbs!=='SYNTHETIC_PILOT_OMISSION','NATIONAL_FISCAL_REVIEW_REQUIRED');
 // Pure validator enforces required national codes/choices. No number is consumed here.
 buildNationalDps({...fields,series:'80000',number:'1',issuedAt:new Date().toISOString().slice(0,19)+'+00:00'});
 const saved=await deps.client.rpc(serviceReference?'national_nfse_review_service_edge':'national_nfse_review_charge_edge',{
 p_user_id:userId,p_intent:{...scope,draftId},...(serviceReference?{p_service_reference:serviceReference}:{p_charge_id:chargeId}),p_snapshot:fields,p_expected_reviewed_at:expectedReviewedAt});
 if(saved.error || !saved.data) throw Error('NATIONAL_REVIEW_SAVE_FAILED');
 const record=saved.data as {reviewedAt?:unknown;draftId?:unknown};
 if(typeof record.reviewedAt!=='string'||record.draftId!==draftId) throw Error('NATIONAL_REVIEW_SAVE_UNCONFIRMED');
 return {state:'REVIEWED_ONLY' as const,submitted:false as const,reviewedAt:record.reviewedAt,draftId};
}
