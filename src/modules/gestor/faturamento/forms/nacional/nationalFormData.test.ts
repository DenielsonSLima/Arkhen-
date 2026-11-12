import { describe, expect, it } from 'vitest';
import { nationalFieldsFromForm, nationalFormFromFields, assertNationalFormSupported } from './nationalFormData';
const values = { competence:'2026-11-12',issuerName:'Empresa',issuerCnpj:'11222333000181',issuerMunicipality:'2802908',simpleOption:'1',specialRegime:'0',recipientName:'Tomador',recipientType:'CPF',recipientDocument:'12345678901',serviceMunicipality:'2802908',nationalTaxCode:'171901',description:'Serviço contábil',amount:'100,00',issTaxation:'1',issRetention:'1',totalMode:'AMOUNTS',federal:'0.00',state:'0.00',municipal:'0.00',ibscbs:'NOT_APPLICABLE_CONFIRMED' };
describe('national form serialization', () => {
  it('não reserva identidade nem infere regime e mantém ambiente homologação', () => {
    const fields = nationalFieldsFromForm(values);
    expect(fields.environment).toBe('HOMOLOGACAO');
    expect(fields.values.serviceAmount).toBe('100.00');
    expect(fields.issuer.simpleNationalOption).toBe('1');
    expect(fields).not.toHaveProperty('number'); expect(fields).not.toHaveProperty('series'); expect(fields).not.toHaveProperty('issuedAt');
  });
  it('recusa enquadramento ausente, códigos inválidos e omissão sintética', () => {
    expect(() => nationalFieldsFromForm({ ...values, simpleOption:'' })).toThrow('Preencha');
    expect(() => nationalFieldsFromForm({ ...values, simpleOption:'99' })).toThrow('Seleção inválida');
    expect(() => nationalFieldsFromForm({ ...values, ibscbs:'SYNTHETIC_PILOT_OMISSION' })).toThrow('IBS/CBS');
  });
  it('não preenche tributos omitidos com zero e exige endereço coerente', () => {
    expect(() => nationalFieldsFromForm({ ...values, federal:'' })).toThrow('tributos totais');
    expect(() => nationalFieldsFromForm({ ...values, recipientStreet:'Rua' })).toThrow('endereço completo');
  });
});

it('reabre os campos suportados sem perder escolhas ou decimais', () => {
  const original = nationalFieldsFromForm({...values, recipientMunicipality:'2802908',recipientPostalCode:'49000000',recipientStreet:'Rua',recipientNumber:'1',recipientDistrict:'Centro',nbs:'122020000',municipalTaxCode:'001',ibscbs:'DECLARED_CONFIRMED',personalUse:'0',operationCode:'100301',cst:'000',classificationCode:'000001'});
  expect(nationalFieldsFromForm(nationalFormFromFields(original))).toEqual(original);
});

it('bloqueia reabertura que descartaria informação fiscal de outro layout', () => {
  const fields = nationalFieldsFromForm(values);
  expect(() => assertNationalFormSupported(fields)).not.toThrow();
  expect(() => assertNationalFormSupported({...fields, unknownFiscalField:'value'} as typeof fields)).toThrow('não suportados');
});
