import type { Company } from '../services/gestaoEmpresarialService';

export type DocumentType = 'CPF' | 'CNPJ';
export type RegimeCliente = Company['tipo'];
export type CategoriaCliente = string;

export const CLIENTE_REGIMES: RegimeCliente[] = [
  'Não informado',
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
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
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

export const validateClienteIdentification = (
  docType: DocumentType,
  document: string,
  razaoSocial: string,
  nomeFantasia: string,
) => {
  const cleanDocument = document.replace(/\D/g, '');

  if (!cleanDocument) return `Por favor, informe o ${docType}.`;
  if (docType === 'CNPJ' && cleanDocument.length !== 14) return 'CNPJ incompleto.';
  if (docType === 'CPF' && cleanDocument.length !== 11) return 'CPF incompleto.';
  if (!razaoSocial.trim()) {
    return docType === 'CNPJ' ? 'A Razão Social é obrigatória.' : 'O Nome Completo é obrigatório.';
  }
  if (!nomeFantasia.trim()) {
    return docType === 'CNPJ'
      ? 'O Nome Fantasia é obrigatório.'
      : 'O Apelido/Nome Fantasia é obrigatório.';
  }

  return null;
};
