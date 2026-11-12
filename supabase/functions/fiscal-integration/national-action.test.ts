import { describe, expect, it, vi } from 'vitest';
import { handleNationalAction } from './national-action';
const id='10000000-0000-4000-8000-000000000001';
describe('National handler fail-closed',()=>{
  it.each(['national-emit','national-cancel','national-consult'])('blocks %s without RPC or transport',async action=>{
    const rpc=vi.fn(); const result=await handleNationalAction({rpc},id,{action,environment:'homologacao',productionEnabled:true});
    expect(result.status).toBe(409); expect(rpc).not.toHaveBeenCalled();
  });
  it('forwards only authenticated identity and configuration id',async()=>{
    const rpc=vi.fn(async()=>({data:{certificateConfigured:true,certificateValidUntil:'2027-01-01',secret:'never expose',liveReady:true},error:null}));
    const result=await handleNationalAction({rpc},id,{action:'national-readiness',fiscal_config_id:id,userId:'forged',tenantId:'forged'});
    expect(rpc).toHaveBeenCalledWith('national_nfse_readiness_edge',{p_user_id:id,p_fiscal_config_id:id});
    expect(result.body.liveReady).toBe(false); expect(result.body).not.toHaveProperty('secret');
  });
  it('does not leak RPC errors',async()=>{
    const rpc=vi.fn(async()=>({data:null,error:{message:'sensitive detail'}}));
    const result=await handleNationalAction({rpc},id,{action:'national-readiness',fiscal_config_id:id});
    expect(result.status).toBe(403); expect(JSON.stringify(result)).not.toContain('sensitive');
  });
});

it('reviews national data with server-derived context and never dispatches',async()=>{
 const {pilotFixture}=await import('../_shared/nfse-national/pilot-fixtures');
 const {number:_number,series:_series,issuedAt:_issuedAt,...fields}=pilotFixture();
 fields.review.ibscbs='NOT_APPLICABLE_CONFIRMED';
 const calls:string[]=[];
 const rpc=vi.fn(async(name:string)=>{calls.push(name);return {error:null,data:name==='national_nfse_review_context_edge'
 ? {tenantId:id,companyId:id,environment:'homologacao',issuerCnpj:'00000000000000'}
 : name==='national_nfse_authorize_edge' ? true : {state:'REVIEWED_ONLY',submitted:false,draftId:id,reviewedAt:'2026-11-12T00:00:00Z'}};});
 const result=await handleNationalAction({rpc},id,{action:'national-review-draft',fiscal_config_id:id,draft_id:id,charge_id:id,fields,tenantId:'forged'});
 expect(result.status).toBe(200);expect(result.body.submitted).toBe(false);
 expect(calls).toEqual(['national_nfse_review_context_edge','national_nfse_authorize_edge','national_nfse_review_charge_edge']);
});
it('rejects malformed review before any RPC',async()=>{
 const rpc=vi.fn();expect((await handleNationalAction({rpc},id,{action:'national-review-draft'})).status).toBe(400);expect(rpc).not.toHaveBeenCalled();
});
it('reopening forwards authenticated identity, not browser tenant/user',async()=>{
 const rpc=vi.fn(async()=>({data:{review:null,secret:'hidden'},error:null}));
 const result=await handleNationalAction({rpc},id,{action:'national-get-charge-review',fiscal_config_id:id,charge_id:id,userId:'fake',tenantId:'fake'});
 expect(result).toEqual({status:200,body:{ok:true,review:null,liveReady:false}});
 expect(rpc).toHaveBeenCalledWith('national_nfse_get_charge_review_edge',{p_user_id:id,p_fiscal_config_id:id,p_charge_id:id});
});
it('reopening denies invalid identifiers and redacts backend errors',async()=>{
 const rpc=vi.fn(async()=>({data:null,error:{message:'private details'}}));
 expect((await handleNationalAction({rpc},id,{action:'national-get-charge-review',charge_id:id})).status).toBe(400);
 expect(rpc).not.toHaveBeenCalled();
 const result=await handleNationalAction({rpc},id,{action:'national-get-charge-review',fiscal_config_id:id,charge_id:id});
 expect(result.status).toBe(403);expect(JSON.stringify(result)).not.toContain('private details');
});
it('lists scoped national reviews without exposing extra RPC fields',async()=>{
 const rpc=vi.fn(async()=>({error:null,data:{items:[{chargeId:id,serviceReference:'',draftId:id,recipientName:'Test',competence:'2026-11-12',amount:'1.00',state:'REVIEWED_ONLY',reviewedAt:'2026-11-12T00:00:00Z',secret:'hidden'}],hasMore:false,credentials:'hidden'}}));
 const result=await handleNationalAction({rpc},id,{action:'national-list-reviews',fiscal_config_id:id,offset:0,userId:'forged'});
 expect(result.status).toBe(200);expect(JSON.stringify(result.body)).not.toContain('hidden');
 expect(rpc).toHaveBeenCalledWith('national_nfse_list_reviews_edge',{p_user_id:id,p_fiscal_config_id:id,p_offset:0});
});
it('rejects unbounded national review paging before RPC',async()=>{
 const rpc=vi.fn();const result=await handleNationalAction({rpc},id,{action:'national-list-reviews',fiscal_config_id:id,offset:10001});
 expect(result.status).toBe(400);expect(rpc).not.toHaveBeenCalled();
});
it('requires a normalized service reference and rejects missing identity before RPC',async()=>{
 const rpc=vi.fn();const result=await handleNationalAction({rpc},id,{action:'national-review-service',fiscal_config_id:id,draft_id:id,fields:{},service_reference:'bad ref'});
 expect(result.status).toBe(400);expect(rpc).not.toHaveBeenCalled();
});
it('loads standalone review only through authenticated service scope',async()=>{
 const rpc=vi.fn(async()=>({error:null,data:{review:null}}));
 const result=await handleNationalAction({rpc},id,{action:'national-get-service-review',fiscal_config_id:id,service_reference:'SERVICE-001',userId:'forged'});
 expect(result.status).toBe(200);expect(rpc).toHaveBeenCalledWith('national_nfse_get_service_review_edge',{p_user_id:id,p_fiscal_config_id:id,p_service_reference:'SERVICE-001'});
});
