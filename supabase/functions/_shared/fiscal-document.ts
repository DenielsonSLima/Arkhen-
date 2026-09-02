const CNPJ_PATTERN = /^[A-Z0-9]{12}[0-9]{2}$/;
const CPF_PATTERN = /^[0-9]{11}$/;
const CNPJ_FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_SECOND_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export type FiscalDocumentKind = "cpf" | "cnpj";

export interface FiscalDocument {
  kind: FiscalDocumentKind;
  value: string;
}

export const normalizeFiscalDocument = (value: unknown): string => (
  String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[./\-\s]/g, "")
);

const cnpjCharacterValue = (character: string): number => (
  character.charCodeAt(0) - 48
);

const calculateCnpjDigit = (base: string, weights: number[]): number => {
  const sum = weights.reduce(
    (total, weight, index) => total + cnpjCharacterValue(base[index]) * weight,
    0,
  );
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
};

export const isValidCnpj = (value: unknown): boolean => {
  const normalized = normalizeFiscalDocument(value);
  if (
    !CNPJ_PATTERN.test(normalized) ||
    (/^[0-9]{14}$/.test(normalized) && /^(\d)\1{13}$/.test(normalized))
  ) return false;

  const base = normalized.slice(0, 12);
  const firstDigit = calculateCnpjDigit(base, CNPJ_FIRST_WEIGHTS);
  const secondDigit = calculateCnpjDigit(
    `${base}${firstDigit}`,
    CNPJ_SECOND_WEIGHTS,
  );
  return normalized.endsWith(`${firstDigit}${secondDigit}`);
};

export const parseFiscalDocument = (
  value: unknown,
  label = "CPF/CNPJ",
): FiscalDocument => {
  const normalized = normalizeFiscalDocument(value);
  if (CPF_PATTERN.test(normalized)) return { kind: "cpf", value: normalized };
  if (isValidCnpj(normalized)) return { kind: "cnpj", value: normalized };
  throw new Error(`${label} invalido.`);
};

export const requireValidCnpj = (
  value: unknown,
  label = "CNPJ",
): string => {
  const normalized = normalizeFiscalDocument(value);
  if (!isValidCnpj(normalized)) throw new Error(`${label} invalido.`);
  return normalized;
};
