import type { CatalogoItem } from '../../parametrizacao/services/catalogosService';
import type { Company } from '../services/gestaoEmpresarialService';

export type DocumentType = 'CPF' | 'CNPJ';
export type RegimeCliente = Company['tipo'];

export const CLIENTE_REGIMES: RegimeCliente[] = [
  'PF',
  'MEI',
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
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
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

  return getCatalogItemId(items, { codigo: 'te-3', nome: 'Microempresa' })
    || items.find((item) => item.codigo !== 'te-1')?.id
    || '';
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
