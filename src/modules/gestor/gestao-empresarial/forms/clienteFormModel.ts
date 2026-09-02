import type { CatalogoItem } from '../../parametrizacao/services/catalogosService';
import type { Company } from '../services/gestaoEmpresarialService';
import { formatCnpj } from '../services/cnpjDocument';

export type DocumentType = 'CPF' | 'CNPJ';
export type RegimeCliente = Company['tipo'];
export type RegimeClienteForm = RegimeCliente | '';
export type QuickCreateTarget = 'category' | 'partnerType' | 'companyType' | 'legalNature';
export type CompanyEnquadramento = 'MEI' | 'ME' | 'EPP' | 'Demais';

export const CLIENTE_REGIMES: RegimeCliente[] = [
  'Simples Nacional',
  'Lucro Presumido',
  'Lucro Real',
  'Isenta',
];

export const formatCPF = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
};

export const formatCNPJ = (value: string) => {
  return formatCnpj(value);
};

export const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/^\((\d{2})\)\s*(\d{4})(\d)/, '($1) $2-$3');
  }

  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/^\((\d{2})\)\s*(\d{5})(\d)/, '($1) $2-$3');
};

export const formatCEP = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, '$1-$2');
};

export const getCatalogItemId = (
  items: CatalogoItem[],
  target: { codigo?: string; nome?: string },
) => items.find((item) => (
  (target.codigo && item.codigo === target.codigo)
  || (target.nome && item.nome === target.nome)
))?.id || '';

export const getDefaultCompanyTypeId = (items: CatalogoItem[], regime: RegimeCliente) => {
  if (regime === 'PF') return getCatalogItemId(items, { codigo: 'te-1', nome: 'Pessoa Física' });
  if (regime === 'MEI') return getCatalogItemId(items, { codigo: 'te-2', nome: 'MEI' });
  return '';
};

const normalizeMatchKey = (value?: string | null) => (
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, '')
);

export const isPessoaFisicaCompanyType = (item?: CatalogoItem) => {
  if (!item) return false;
  return ['pessoafisica', 'te1'].includes(normalizeMatchKey(item.codigo))
    || normalizeMatchKey(item.nome) === 'pessoafisica';
};

export const isMeiCompanyType = (item?: CatalogoItem) => {
  if (!item) return false;
  return ['mei', 'te2'].includes(normalizeMatchKey(item.codigo))
    || normalizeMatchKey(item.nome) === 'mei';
};

const findCatalogId = (items: CatalogoItem[], codes: string[], names: string[]) => {
  const codeKeys = new Set(codes.map(normalizeMatchKey));
  const nameKeys = new Set(names.map(normalizeMatchKey));
  return items.find((item) => (
    codeKeys.has(normalizeMatchKey(item.codigo))
    || nameKeys.has(normalizeMatchKey(item.nome))
  ))?.id || '';
};

export const getCompanyTypeIdByEnquadramento = (
  items: CatalogoItem[],
  enquadramento?: CompanyEnquadramento,
) => {
  if (!enquadramento) return '';
  const aliases: Record<CompanyEnquadramento, { codes: string[]; names: string[] }> = {
    MEI: { codes: ['mei', 'te-2'], names: ['MEI'] },
    ME: { codes: ['microempresa', 'me', 'te-3'], names: ['ME', 'Microempresa'] },
    EPP: { codes: ['epp', 'te-4'], names: ['EPP', 'Empresa de Pequeno Porte'] },
    Demais: { codes: ['demais'], names: ['Demais'] },
  };
  const target = aliases[enquadramento];
  return findCatalogId(items, target.codes, target.names);
};

const LEGAL_NATURE_CODE_MAP: Record<string, string> = {
  '2135': 'empresario_individual',
  '2062': 'sociedade_limitada',
  '3999': 'associacao_privada',
  '2046': 'sociedade_anonima',
  '2054': 'sociedade_anonima',
  '2143': 'cooperativa',
  '3069': 'fundacao_privada',
  '2232': 'sociedade_simples',
  '2240': 'sociedade_simples',
  '3220': 'organizacao_religiosa',
};

export const getLegalNatureId = (
  items: CatalogoItem[],
  officialCode?: string,
  officialName?: string,
) => {
  const internalCode = LEGAL_NATURE_CODE_MAP[normalizeMatchKey(officialCode)];
  if (internalCode) {
    const byCode = findCatalogId(items, [internalCode], []);
    if (byCode) return byCode;
  }
  if (!officialName) return '';
  const nameKey = normalizeMatchKey(officialName);
  const aliases: Array<{ code: string; matches: string[] }> = [
    { code: 'empresario_individual', matches: ['empresarioindividual'] },
    { code: 'sociedade_limitada_unipessoal', matches: ['sociedadelimitadaunipessoal', 'slu'] },
    { code: 'sociedade_limitada', matches: ['sociedadeempresarialimitada', 'sociedadelimitada', 'ltda'] },
    { code: 'associacao_privada', matches: ['associacaoprivada', 'associacao'] },
    { code: 'sociedade_anonima', matches: ['sociedadeanonima'] },
    { code: 'cooperativa', matches: ['cooperativa'] },
    { code: 'fundacao_privada', matches: ['fundacaoprivada', 'fundacao'] },
    { code: 'sociedade_simples', matches: ['sociedadesimples'] },
    { code: 'organizacao_religiosa', matches: ['organizacaoreligiosa'] },
  ];
  const alias = aliases.find((item) => item.matches.some((match) => (
    match.length <= 4 ? nameKey === match : nameKey.includes(match)
  )));
  if (alias) return findCatalogId(items, [alias.code], []);
  return items.find((item) => normalizeMatchKey(item.nome) === nameKey)?.id || '';
};

export const getDocumentType = (company: Pick<Company, 'tipo'>): DocumentType => (
  company.tipo === 'PF' ? 'CPF' : 'CNPJ'
);

export const getActiveCategoryName = (
  availableCategories: string[],
  preferred?: string,
) => (
  (preferred && availableCategories.includes(preferred) ? preferred : '')
  || availableCategories[0]
  || ''
);
