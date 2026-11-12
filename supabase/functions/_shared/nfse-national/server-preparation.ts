import { parseFiscalPkcs12, assertCertificateMatchesCnpj } from '../webiss/certificate.ts';
import { loadNationalCredentials } from './credentials.ts';
import type { NationalIntent, NationalScope } from './adapter.ts';
import type { NationalRpcClient } from './rpc-ledger.ts';
import type { NationalDpsInput } from './dps.types.ts';
import { buildNationalDps } from './dps.ts';
import { requireContract } from './xml.ts';

type SourceSnapshot = Omit<NationalDpsInput,'number'|'series'|'issuedAt'>;
export interface ReviewedNationalSource {
 /** Must check fiscal role and current tenant/config access, not just authentication. */
 authorize(userId: string, scope: NationalScope): Promise<void>;
 /** Server-owned reviewed record only; never map an arbitrary request body here. */
 loadReviewed(userId: string, scope: NationalScope, draftId: string): Promise<SourceSnapshot>;
}
/** Deliberately no transport. Prepares immutable server snapshot + credential in memory. */
export async function prepareNationalServerDraft(client: NationalRpcClient,userId: string,
 scope: NationalScope,draftId: string, source: ReviewedNationalSource) {
 requireContract(scope.environment==='homologacao','NATIONAL_PRODUCTION_NOT_ENABLED');
 await source.authorize(userId,scope);
 const snapshot=await source.loadReviewed(userId,scope,draftId);
 // Validate all fiscal choices before consuming a number; temporary identity is not persisted.
 buildNationalDps({...snapshot,series:'80000',number:'1',issuedAt:new Date().toISOString().slice(0,19)+'+00:00'});
 const prepared=await client.rpc('national_nfse_prepare_edge',{p_user_id:userId,p_intent:{...scope,draftId},p_snapshot:snapshot});
 requireContract(!prepared.error && !!prepared.data && typeof prepared.data==='object','NATIONAL_PREPARATION_FAILED');
 const data=prepared.data as {intent:NationalIntent;snapshot:NationalDpsInput};
 const intent=data.intent;
 requireContract(intent.tenantId===scope.tenantId && intent.companyId===scope.companyId &&
 intent.environment===scope.environment && intent.issuerCnpj===scope.issuerCnpj && intent.draftId===draftId,
 'NATIONAL_PREPARATION_SCOPE_MISMATCH');
 requireContract(buildNationalDps(data.snapshot).referenceId===intent.dpsId,'NATIONAL_DPS_IDENTITY_MISMATCH');
 const credential=await loadNationalCredentials(userId,intent,{
  authorize:source.authorize,
  now:()=>Date.now(),
  async load(actor,bound){
   const result=await client.rpc('national_nfse_credentials_edge',{p_user_id:actor,p_intent:bound});
   requireContract(!result.error && !!result.data && typeof result.data==='object','NATIONAL_CREDENTIAL_LOAD_FAILED');
   const value=result.data as {pfxBase64:string;password:string};
   requireContract(typeof value.pfxBase64==='string' && typeof value.password==='string','NATIONAL_CREDENTIAL_LOAD_FAILED');
   return value;
  },
  async parse(base64,password){const cert=parseFiscalPkcs12(base64,password);assertCertificateMatchesCnpj(cert,intent.issuerCnpj);return cert;},
 });
 return {intent,snapshot:data.snapshot,credential}; // INTERNAL ONLY: never JSON-return from an HTTP handler.
}
