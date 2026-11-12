import { describe, expect, it } from 'vitest';
import { buildNationalDps } from './dps';
import type { NationalDpsInput } from './dps.types';
import { buildNationalCancellation, projectCancellationState, type CancellationInput } from './events';
const fixture=(): NationalDpsInput=>({environment:'HOMOLOGACAO',purpose:'REGULAR',issuedAt:'2026-11-12T12:00:00-03:00',
 applicationVersion:'ARKHEN_TEST_ONLY',series:'1',number:'123',competence:'2026-11-12',issuerMunicipalityCode:'2803401',
 issuer:{taxId:{type:'CNPJ',value:'00000000000000'},simpleNationalOption:'1',specialTaxRegime:'0'},
 recipient:{taxId:{type:'CNPJ',value:'00000000000000'},name:'Tomador Sintetico'},
 service:{municipalityCode:'2803401',nationalTaxCode:'080101',description:'Teste sem valor fiscal'},
 values:{serviceAmount:'1.00',issTaxation:'1',issRetention:'1',totalTaxes:{mode:'AMOUNTS',federal:'0.00',state:'0.00',municipal:'0.00'}},
 review:{recipientConfirmed:true,competenceConfirmed:true,classificationConfirmed:true,ibscbs:'SYNTHETIC_PILOT_OMISSION',federalRetentions:'NONE_CONFIRMED',deductionsAndDiscounts:'NONE_CONFIRMED'}});
const cancel:CancellationInput={environment:'HOMOLOGACAO',applicationVersion:'ARKHEN_TEST_ONLY',occurredAt:'2026-11-12T12:00:00-03:00',
 accessKey:'0'.repeat(50),author:{type:'CNPJ',value:'00000000000000'},eventCode:'101101',reasonCode:'1',reason:'Solicitacao sintetica sem valor fiscal'};
describe('National XML builders offline only',()=>{
 it('builds stable DPS id and escapes data',()=>{
  const f=fixture(); f.service.description='Teste <sem> & valor fiscal'; const built=buildNationalDps(f);
  expect(built.referenceId).toMatch(/^DPS\d{42}$/); expect(built.xml).toContain('&lt;sem&gt; &amp;');
  expect(built.xml).toContain('<tpAmb>2</tpAmb>'); expect(built.xml).toContain('<dCompet>2026-11-12</dCompet>');
 });
 it('does not silently discard unsupported fiscal fields',()=>{
  const f=fixture(); expect(()=>buildNationalDps({...f,values:{...f.values,unknownTax:'2.00'}} as never)).toThrow('UNSUPPORTED_FIELD');
 });
 it('rejects synthetic omissions in production',()=>expect(()=>buildNationalDps({...fixture(),environment:'PRODUCAO'})).toThrow('IBSCBS_REVIEW_REQUIRED'));
 it('builds cancellation separately from administrative analysis',()=>{
  expect(buildNationalCancellation(cancel).kind).toBe('CANCELLATION');
  expect(buildNationalCancellation({...cancel,eventCode:'101103'}).kind).toBe('CANCELLATION_REQUEST');
 });
 it('does not forge municipality events',()=>expect(()=>buildNationalCancellation({...cancel,eventCode:'105104'} as never)).toThrow('UNSUPPORTED_EVENT'));
 it('never marks analysis request as cancellation',()=>{
  const event={accessKey:cancel.accessKey,environment:'HOMOLOGACAO' as const,code:'101103',sequence:'001',id:`EVT${cancel.accessKey}101103001`};
  expect(projectCancellationState(cancel.accessKey,'HOMOLOGACAO',[event])).toBe('AWAITING_ANALYSIS');
  expect(()=>projectCancellationState(cancel.accessKey,'PRODUCAO',[event])).toThrow('EVENT_IDENTITY_MISMATCH');
 });
});
