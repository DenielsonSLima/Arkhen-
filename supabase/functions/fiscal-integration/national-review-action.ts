import type {NationalRpcClient} from '../_shared/nfse-national/rpc-ledger.ts';
import {nationalReviewedSource} from '../_shared/nfse-national/reviewed-source.ts';
import {reviewNationalChargeDraft,type NationalDraftFields} from '../_shared/nfse-national/draft-review.ts';
import type {NationalScope} from '../_shared/nfse-national/adapter.ts';
const uuid=(v:unknown):v is string=>typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export async function handleNationalReview(admin:NationalRpcClient,userId:string,payload:Record<string,unknown>) {
 const service=payload.action==='national-review-service';
 if(!uuid(payload.fiscal_config_id)||!uuid(payload.draft_id)||(service?(typeof payload.service_reference!=='string'||!/^[A-Z0-9][A-Z0-9._/-]{2,79}$/.test(payload.service_reference)):!uuid(payload.charge_id))||!payload.fields||typeof payload.fields!=='object'||Array.isArray(payload.fields)||JSON.stringify(payload.fields).length>32768
 ||(payload.expected_reviewed_at!==null && payload.expected_reviewed_at!==undefined && (typeof payload.expected_reviewed_at!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(payload.expected_reviewed_at))))
 return {status:400,body:{ok:false,code:'NATIONAL_REVIEW_INVALID_INPUT'}};
 try {
  const context=await admin.rpc('national_nfse_review_context_edge',{p_user_id:userId,p_fiscal_config_id:payload.fiscal_config_id});
  if(context.error||!context.data||typeof context.data!=='object') throw Error('DENIED');
  const scope=context.data as NationalScope;
  if(scope.companyId!==payload.fiscal_config_id||!uuid(scope.tenantId)||scope.environment!=='homologacao'||!/^\d{14}$/.test(scope.issuerCnpj)) throw Error('INVALID_CONTEXT');
  const result=await reviewNationalChargeDraft(userId,scope,payload.draft_id,typeof payload.charge_id==='string'?payload.charge_id:'',payload.fields as NationalDraftFields,
   {source:nationalReviewedSource(admin),client:admin}, typeof payload.expected_reviewed_at==='string'?payload.expected_reviewed_at:null,service?String(payload.service_reference):undefined);
  return {status:200,body:{ok:true,...result,liveReady:false}};
 } catch {
  return {status:409,body:{ok:false,code:'NATIONAL_REVIEW_REJECTED',error:'Revise os campos fiscais, a cobranca e sua permissao. Nada foi emitido.'}};
 }
}
