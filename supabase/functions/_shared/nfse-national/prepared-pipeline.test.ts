import { test, expect } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { buildNationalDps } from './dps';
import { pilotFixture, pilotAccessKey, syntheticAuthorizedNote } from './pilot-fixtures';
import { createHomologationSchemaValidator } from './homologation-schema';
import { decodeFiscalXml, encodeFiscalXml } from './pilot-codec';
import { runPreparedNationalDraft, type PreparedPipelineDependencies } from './prepared-pipeline';
import type { NationalIntent, NationalRecord } from './adapter';
import { buildNationalCancellation } from './events';
import { prepareNationalSignedXml } from './provider';
import { createNationalMtlsTransport } from './mtls';
const id='10000000-0000-4000-8000-000000000001';

test('pipeline validates XSD, signs, archives exact XML and never resends finalized draft',async()=>{
 const dir=await mkdtemp('/tmp/arkhen-pipeline-test-');
 try {
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=SYNTHETIC-ONLY',
   '-keyout',`${dir}/key.pem`,'-out',`${dir}/cert.pem`],{stdio:['ignore','ignore','pipe']});
  const credential={privateKeyPem:await readFile(`${dir}/key.pem`,'utf8'),certificatePem:await readFile(`${dir}/cert.pem`,'utf8')};
  const input=pilotFixture();
  const intent:NationalIntent={tenantId:id,companyId:id,draftId:id,environment:'homologacao',issuerCnpj:input.issuer.taxId.value,
   dpsId:buildNationalDps(input).referenceId,snapshotHash:'a'.repeat(64)};
  let record:NationalRecord|undefined;let posts=0;let authorizations=0;let archive='';let exactSigned='';
  const deps:PreparedPipelineDependencies={schema:createHomologationSchemaValidator(),credential,signatureProfile:'RSA_SHA256',
   async authorize(){authorizations++;},assertLiveContract(){},
   ledger(prepared){exactSigned=prepared.signedDpsXml;return {
    async reserve(value){record??={intent:value,dispatched:false};return structuredClone(record);},
    async claim(){if(record!.dispatched)return false;record!.dispatched=true;return true;},
    async settle(_,outcome){if(outcome.state==='AUTHORIZED')expect(archive).toContain('<NFSe');record!.outcome=outcome;},
   };},
   async archive(_,document){expect(document.signedDpsXml).toBe(exactSigned);archive=document.authorizedXml;},
   transport:{async request(method,_path,body){
    if(method==='GET')return {status:404,body:new TextEncoder().encode('{}')};
    posts++;const signed=decodeFiscalXml(JSON.parse(body!).dpsXmlGZipB64);
    return {status:201,body:new TextEncoder().encode(JSON.stringify({tipoAmbiente:2,idDps:intent.dpsId,chaveAcesso:pilotAccessKey,
     nfseXmlGZipB64:encodeFiscalXml(syntheticAuthorizedNote(signed,credential))}))};
   }},
  };
  const cancellation = buildNationalCancellation({environment:'HOMOLOGACAO',applicationVersion:'ARKHEN_TEST_ONLY',
    occurredAt:'2026-11-12T12:00:00-03:00',accessKey:pilotAccessKey,author:{type:'CNPJ',value:intent.issuerCnpj},
    eventCode:'101101',reasonCode:'1',reason:'Teste sintetico sem valor fiscal'});
  const signedCancellation=await prepareNationalSignedXml(cancellation,deps);
  expect(signedCancellation.signedXml).toContain('<Signature');
  expect(signedCancellation.liveReady).toBe(false);
  expect((await runPreparedNationalDraft(id,intent,input,deps)).state).toBe('AUTHORIZED');
  expect((await runPreparedNationalDraft(id,intent,input,deps)).state).toBe('AUTHORIZED');
  expect(posts).toBe(1);expect(authorizations).toBe(4);expect(archive).toContain('<NFSe');
  await expect(runPreparedNationalDraft(id,{...intent,issuerCnpj:'1'.repeat(14)},input,deps)).rejects.toThrow('ISSUER_MISMATCH');
  expect(posts).toBe(1);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('real mTLS remains blocked before any socket for both read and write',()=>{
 expect(()=>createNationalMtlsTransport('PRODUCAO',{certificateChainPem:'',privateKeyPem:''})).toThrow('NOT_ENABLED');
 const transport=createNationalMtlsTransport('HOMOLOGACAO',{certificateChainPem:'',privateKeyPem:''});
 try{
  expect(()=>transport.request('GET',`/dps/DPS${'0'.repeat(42)}`)).toThrow('CONTRACT_UNVERIFIED');
  expect(()=>transport.request('POST','/nfse','{}')).toThrow('CONTRACT_UNVERIFIED');
  expect(()=>transport.request('GET','https://untrusted.example/')).toThrow('UNSUPPORTED_FISCAL_ROUTE');
 }finally{transport.close();}
});
