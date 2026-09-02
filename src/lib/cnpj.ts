const CNPJ_BASE_LENGTH = 12;
const CNPJ_LENGTH = 14;
const CNPJ_PATTERN = /^[A-Z0-9]{12}[0-9]{2}$/;

export const normalizeCnpj = (value: string): string => (
  value.toUpperCase().replace(/[^A-Z0-9]/g, '')
);

export const formatCnpj = (value: string): string => {
  const normalized = normalizeCnpj(value).slice(0, CNPJ_LENGTH);
  const groups = [
    normalized.slice(0, 2),
    normalized.slice(2, 5),
    normalized.slice(5, 8),
    normalized.slice(8, 12),
    normalized.slice(12, 14),
  ];

  let formatted = groups[0];
  if (normalized.length > 2) formatted += `.${groups[1]}`;
  if (normalized.length > 5) formatted += `.${groups[2]}`;
  if (normalized.length > 8) formatted += `/${groups[3]}`;
  if (normalized.length > 12) formatted += `-${groups[4]}`;
  return formatted;
};

export const formatCpfOrCnpj = (value: string): string => {
  const raw = String(value || '').trim();
  const normalized = normalizeCnpj(raw);
  if (CNPJ_PATTERN.test(normalized)) return formatCnpj(normalized);

  const cpf = raw.replace(/\D/g, '');
  if (cpf.length === 11) {
    return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return raw;
};

const cnpjCharacterValue = (character: string): number => character.charCodeAt(0) - 48;

const calculateCnpjDigit = (base: string, weights: number[]): number => {
  const sum = weights.reduce(
    (total, weight, index) => total + cnpjCharacterValue(base[index]) * weight,
    0,
  );
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
};

export const isValidCnpj = (value: string): boolean => {
  const cnpj = normalizeCnpj(value);
  if (!CNPJ_PATTERN.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;

  const base = cnpj.slice(0, CNPJ_BASE_LENGTH);
  const firstDigit = calculateCnpjDigit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = calculateCnpjDigit(
    `${base}${firstDigit}`,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );

  return cnpj.endsWith(`${firstDigit}${secondDigit}`);
};

export const matchesCnpjSearch = (value: string, query: string): boolean => {
  const normalizedQuery = normalizeCnpj(query);
  return Boolean(normalizedQuery) && normalizeCnpj(value).includes(normalizedQuery);
};
