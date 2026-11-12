import {it,expect} from 'vitest';
import forge from 'node-forge';
import {parseFiscalPkcs12} from '../webiss/certificate.ts';
import {prepareNationalServerDraft} from './server-preparation.ts';
import type {NationalScope} from './adapter.ts';
it('parses an ephemeral PFX through the existing real RSA parser with exact password',()=>{
 const keys=forge.pki.rsa.generateKeyPair(2048); const cert=forge.pki.createCertificate();
 cert.publicKey=keys.publicKey;cert.serialNumber='01';cert.validity.notBefore=new Date(Date.now()-60000);
 cert.validity.notAfter=new Date(Date.now()+86400000);cert.setSubject([{name:'commonName',value:'Synthetic:11222333000181'}]);
 cert.setIssuer(cert.subject.attributes);cert.sign(keys.privateKey,forge.md.sha256.create());
 const pfx=forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey,[cert],' exact ',{algorithm:'3des'})).getBytes();
 const result=parseFiscalPkcs12(forge.util.encode64(pfx),' exact ');
 expect(result.cnpj).toBe('11222333000181');expect(result.privateKeyPem).toContain('PRIVATE KEY');
 expect(()=>parseFiscalPkcs12(forge.util.encode64(pfx),'exact')).toThrow();
});
it('denied fiscal authorization stops before source, Vault or allocation RPC',async()=>{
 const scope={environment:'homologacao'} as NationalScope;
 await expect(prepareNationalServerDraft({rpc:async()=>{throw Error('RPC SHOULD NOT RUN');}},'u',scope,'draft',{
 authorize:async()=>{throw Error('FISCAL_ROLE_DENIED');},loadReviewed:async()=>{throw Error('SHOULD NOT LOAD');}
 })).rejects.toThrow('FISCAL_ROLE_DENIED');
});
