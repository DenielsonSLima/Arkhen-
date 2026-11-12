import { describe,it,expect } from 'vitest';
import { loadNationalCredentials, type NationalCredentialDependencies } from './credentials.ts';
import type { NationalIntent } from './adapter.ts';
const intent={environment:'homologacao',issuerCnpj:'00000000000000'} as NationalIntent;
function deps(): NationalCredentialDependencies { return {
 authorize:async()=>{},load:async()=>({pfxBase64:'synthetic',password:' exact '}),
 parse:async(_p,password)=>{expect(password).toBe(' exact ');return {cnpj:intent.issuerCnpj,
 validFrom:'2026-01-01',validUntil:'2027-01-01',certificatePem:'synthetic-cert',privateKeyPem:'synthetic-key'};},
 now:()=>Date.parse('2026-11-12'),
}; }
describe('server national credential boundary',()=>{
 it('keeps exact password and returns only signing materials',async()=>{
 expect(await loadNationalCredentials('u',intent,deps())).toEqual({certificatePem:'synthetic-cert',privateKeyPem:'synthetic-key'});
 });
 it('rejects expired credential',async()=>{const d=deps();d.now=()=>Date.parse('2028-01-01');await expect(loadNationalCredentials('u',intent,d)).rejects.toThrow('UNAVAILABLE_OR_INVALID');});
 it('redacts parser failures',async()=>{const d=deps();d.parse=async()=>{throw new Error('secret-password');};await expect(loadNationalCredentials('u',intent,d)).rejects.toThrow('NATIONAL_CERTIFICATE_UNAVAILABLE_OR_INVALID');});
 it('rejects production before loading',async()=>{const d=deps();d.load=async()=>{throw new Error('should not load');};await expect(loadNationalCredentials('u',{...intent,environment:'producao'},d)).rejects.toThrow('PRODUCTION_NOT_ENABLED');});
});
