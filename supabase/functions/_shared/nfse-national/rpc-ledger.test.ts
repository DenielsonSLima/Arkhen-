import { describe, expect, it, vi } from 'vitest';
import { nationalRpcLedger } from './rpc-ledger';
import type { NationalIntent } from './adapter';
const intent:NationalIntent={tenantId:'t',companyId:'c',draftId:'d',environment:'homologacao',issuerCnpj:'0',dpsId:'DPS',snapshotHash:'a'};
describe('National RPC adapter',()=>{
 it('binds every operation to the authenticated user and preserves exact prepared bytes',async()=>{
  const rpc=vi.fn(async()=>({data:{intent,dispatched:false},error:null}));
  const ledger=nationalRpcLedger({rpc},'authenticated-user',{snapshot:{fiscal:'snapshot'},signedDpsXml:'exact XML'});
  await ledger.reserve(intent);
  expect(rpc).toHaveBeenCalledWith('national_nfse_reserve_edge',{p_user_id:'authenticated-user',p_intent:intent,p_snapshot:{fiscal:'snapshot'},p_signed_xml:'exact XML'});
 });
 it('does not treat truthy RPC strings as a successful claim',async()=>{
  const rpc=vi.fn(async()=>({data:'true',error:null}));
  const ledger=nationalRpcLedger({rpc},'u',{snapshot:{},signedDpsXml:'x'});
  await expect(ledger.claim(intent)).rejects.toThrow('INVALID_NATIONAL_LEDGER_RESPONSE');
 });
 it('does not expose raw database errors or silently continue',async()=>{
  const rpc=vi.fn(async()=>({data:null,error:{message:'private detail'}}));
  const ledger=nationalRpcLedger({rpc},'u',{snapshot:{},signedDpsXml:'x'});
  await expect(ledger.reserve(intent)).rejects.toThrow('NATIONAL_LEDGER_UNAVAILABLE');
 });
});
