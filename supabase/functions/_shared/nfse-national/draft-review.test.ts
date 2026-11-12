import {it,expect} from 'vitest';
import {reviewNationalChargeDraft} from './draft-review.ts';
import {pilotFixture} from './pilot-fixtures.ts';
import type {NationalScope} from './adapter.ts';
const scope={environment:'homologacao',issuerCnpj:'00000000000000'} as NationalScope;
it('rejects synthetic omissions before persistence',async()=>{
 const {number:_number,series:_series,issuedAt:_issuedAt,...fields}=pilotFixture();
 await expect(reviewNationalChargeDraft('u',scope,'d','c',fields,{source:{authorize:async()=>{},loadReviewed:async()=>fields},client:{rpc:async()=>{throw Error('SHOULD NOT SAVE');}}})).rejects.toThrow('FISCAL_REVIEW_REQUIRED');
});
it('persists explicitly reviewed national data without issuing or consuming DPS',async()=>{
 const {number:_number,series:_series,issuedAt:_issuedAt,...fields}=pilotFixture();fields.review.ibscbs='NOT_APPLICABLE_CONFIRMED';
 const calls:string[]=[];
 const result=await reviewNationalChargeDraft('u',scope,'d','c',fields,{source:{authorize:async()=>{},loadReviewed:async()=>fields},client:{rpc:async(name)=>{calls.push(name);return {data:{submitted:false,draftId:'d',reviewedAt:'2026-11-12T00:00:00Z'},error:null};}}});
 expect(result.submitted).toBe(false);expect(calls).toEqual(['national_nfse_review_charge_edge']);
});
it('saves standalone service identity without creating or linking a charge',async()=>{
 const {number:_number,series:_series,issuedAt:_issuedAt,...fields}=pilotFixture();fields.review.ibscbs='NOT_APPLICABLE_CONFIRMED';
 let name='';let args:Record<string,unknown>={};
 await reviewNationalChargeDraft('u',scope,'d','',fields,{source:{authorize:async()=>{},loadReviewed:async()=>fields},client:{rpc:async(n,a)=>{name=n;args=a;return {data:{submitted:false,draftId:'d',reviewedAt:'2026-11-12T00:00:00Z'},error:null};}}},null,'SERVICE-001');
 expect(name).toBe('national_nfse_review_service_edge');expect(args.p_service_reference).toBe('SERVICE-001');expect(args).not.toHaveProperty('p_charge_id');
});
