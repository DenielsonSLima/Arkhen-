import type { NationalDpsInput } from '../../../../../../supabase/functions/_shared/nfse-national/dps.types';
import { nationalFieldGroups } from './nationalFormFields';
export type NationalDraftFields = Omit<NationalDpsInput, 'number' | 'series' | 'issuedAt'>;
export type NationalFormValues = Record<string, string>;
/** Only serializes explicit choices. Fiscal validation remains on the backend. */
export function nationalFieldsFromForm(v: NationalFormValues): NationalDraftFields {
  for (const field of nationalFieldGroups.flatMap(group => group.fields)) {
    if (!field.optional && !v[field.key]?.trim()) throw Error(`Preencha: ${field.label}.`);
    if (v[field.key] && field.options && !field.options.some(([key]) => key === v[field.key])) throw Error(`Seleção inválida: ${field.label}.`);
  }
  if (!['NOT_APPLICABLE_CONFIRMED', 'DECLARED_CONFIRMED'].includes(v.ibscbs)) throw Error('Revise o tratamento IBS/CBS.');
  const decimal = (key: string) => (v[key] || '').trim().replace(',', '.');
  const addressKeys = ['recipientMunicipality', 'recipientPostalCode', 'recipientStreet', 'recipientNumber', 'recipientDistrict'];
  if (addressKeys.some(key => v[key]?.trim()) && !addressKeys.every(key => v[key]?.trim())) throw Error('Preencha o endereço completo do tomador ou deixe todos os campos de endereço em branco.');
  const totalTaxes: NationalDpsInput['values']['totalTaxes'] = v.totalMode === 'SIMPLE_NATIONAL_PERCENTAGE'
    ? { mode: 'SIMPLE_NATIONAL_PERCENTAGE', percentage: decimal('simplePercentage') }
    : { mode: v.totalMode as 'AMOUNTS' | 'PERCENTAGES', federal: decimal('federal'), state: decimal('state'), municipal: decimal('municipal') };
  if (v.totalMode === 'SIMPLE_NATIONAL_PERCENTAGE' ? !v.simplePercentage : !v.federal || !v.state || !v.municipal) throw Error('Informe os tributos totais conforme o modo escolhido, inclusive zero quando aplicável.');
  return {
    purpose: 'REGULAR', environment: 'HOMOLOGACAO', applicationVersion: 'Arkhen-1.0', competence: v.competence,
    issuerMunicipalityCode: v.issuerMunicipality,
    issuer: { taxId: { type: 'CNPJ', value: v.issuerCnpj }, name: v.issuerName,
      simpleNationalOption: v.simpleOption as NationalDpsInput['issuer']['simpleNationalOption'],
      ...(v.simpleAssessment ? { simpleNationalAssessment: v.simpleAssessment as '1' | '2' | '3' } : {}),
      specialTaxRegime: v.specialRegime as NationalDpsInput['issuer']['specialTaxRegime'] },
    recipient: { taxId: { type: v.recipientType as 'CPF' | 'CNPJ', value: v.recipientDocument }, name: v.recipientName,
      ...(v.recipientMunicipality ? { address: { municipalityCode: v.recipientMunicipality, postalCode: v.recipientPostalCode,
        street: v.recipientStreet, number: v.recipientNumber, district: v.recipientDistrict } } : {}) },
    service: { municipalityCode: v.serviceMunicipality, nationalTaxCode: v.nationalTaxCode, description: v.description,
      ...(v.municipalTaxCode ? { municipalTaxCode: v.municipalTaxCode } : {}), ...(v.nbs ? { nbs: v.nbs } : {}) },
    values: { serviceAmount: decimal('amount'), issTaxation: v.issTaxation as '1' | '2' | '4', issRetention: v.issRetention as '1' | '2',
      ...(v.immunity ? { immunityType: v.immunity as '1' | '2' | '3' | '4' | '5' } : {}), ...(v.issRate ? { issRate: decimal('issRate') } : {}), totalTaxes },
    ...(v.ibscbs === 'DECLARED_CONFIRMED' ? { ibscbs: { personalUse: v.personalUse as '0' | '1', operationCode: v.operationCode,
      recipientIsAcquirer: true as const, cst: v.cst, classificationCode: v.classificationCode } } : {}),
    review: { recipientConfirmed: true, competenceConfirmed: true, classificationConfirmed: true,
      ibscbs: v.ibscbs as 'NOT_APPLICABLE_CONFIRMED' | 'DECLARED_CONFIRMED', federalRetentions: 'NONE_CONFIRMED', deductionsAndDiscounts: 'NONE_CONFIRMED' },
  };
}
/** Reopen only the server's national snapshot, never convert WebISS classifications. */
export function nationalFormFromFields(f: NationalDraftFields): NationalFormValues {
  const address = f.recipient.address;
  const total = f.values.totalTaxes;
  return {
    competence: f.competence, issuerName: f.issuer.name || '', issuerCnpj: f.issuer.taxId.value,
    issuerMunicipality: f.issuerMunicipalityCode, simpleOption: f.issuer.simpleNationalOption,
    simpleAssessment: f.issuer.simpleNationalAssessment || '', specialRegime: f.issuer.specialTaxRegime,
    recipientName: f.recipient.name, recipientType: f.recipient.taxId.type, recipientDocument: f.recipient.taxId.value,
    recipientMunicipality: address?.municipalityCode || '', recipientPostalCode: address?.postalCode || '',
    recipientStreet: address?.street || '', recipientNumber: address?.number || '', recipientDistrict: address?.district || '',
    serviceMunicipality: f.service.municipalityCode, nationalTaxCode: f.service.nationalTaxCode,
    municipalTaxCode: f.service.municipalTaxCode || '', nbs: f.service.nbs || '', description: f.service.description,
    amount: f.values.serviceAmount, issTaxation: f.values.issTaxation, issRetention: f.values.issRetention,
    immunity: f.values.immunityType || '', issRate: f.values.issRate || '', totalMode: total.mode,
    federal: 'federal' in total ? total.federal : '', state: 'state' in total ? total.state : '',
    municipal: 'municipal' in total ? total.municipal : '', simplePercentage: 'percentage' in total ? total.percentage : '',
    ibscbs: f.review.ibscbs, personalUse: f.ibscbs?.personalUse || '', operationCode: f.ibscbs?.operationCode || '',
    cst: f.ibscbs?.cst || '', classificationCode: f.ibscbs?.classificationCode || '',
  };
}
function sortedJson(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item)
      .filter(([, child]) => child !== undefined).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, normalize(child)]));
    return item;
  };
  return JSON.stringify(normalize(value));
}
/** Refuse to silently discard fields from newer/unsupported national snapshots. */
export function assertNationalFormSupported(fields: NationalDraftFields): void {
  const restored = nationalFieldsFromForm(nationalFormFromFields(fields));
  if (sortedJson({ ...fields, applicationVersion: restored.applicationVersion }) !== sortedJson(restored))
    throw Error('Esta revisão contém campos não suportados pelo formulário atual. Nenhuma alteração foi feita.');
}
