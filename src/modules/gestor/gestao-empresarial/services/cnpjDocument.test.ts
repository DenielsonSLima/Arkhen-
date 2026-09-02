import { describe, expect, it } from 'vitest';
import {
  formatCnpj,
  formatCpfOrCnpj,
  isValidCnpj,
  matchesCnpjSearch,
  normalizeCnpj,
} from './cnpjDocument';

describe('cnpjDocument', () => {
  it('normalizes and formats numeric and alphanumeric CNPJs', () => {
    expect(normalizeCnpj('00.000.000/e08g-12')).toBe('00000000E08G12');
    expect(formatCnpj('00000000e08g12')).toBe('00.000.000/E08G-12');
    expect(formatCnpj('27865757000102')).toBe('27.865.757/0001-02');
  });

  it('validates the legacy numeric format and the official alphanumeric example', () => {
    expect(isValidCnpj('27.865.757/0001-02')).toBe(true);
    expect(isValidCnpj('00.000.000/E08G-12')).toBe(true);
  });

  it('rejects invalid verification digits and letters in the verification digits', () => {
    expect(isValidCnpj('00.000.000/E08G-13')).toBe(false);
    expect(isValidCnpj('00.000.000/E08G-1A')).toBe(false);
    expect(isValidCnpj('00.000.000/0000-00')).toBe(false);
    expect(isValidCnpj('00.000.000/E08G-12-EXTRA')).toBe(false);
  });

  it('finds numeric and alphanumeric CNPJs with or without punctuation', () => {
    expect(matchesCnpjSearch('00.000.000/E08G-12', 'e08g')).toBe(true);
    expect(matchesCnpjSearch('00.000.000/E08G-12', '00000000E08')).toBe(true);
    expect(matchesCnpjSearch('27.865.757/0001-02', '5757/0001')).toBe(true);
    expect(matchesCnpjSearch('00.000.000/E08G-12', '')).toBe(false);
  });

  it('formats a CPF or either CNPJ representation without discarding letters', () => {
    expect(formatCpfOrCnpj('12345678901')).toBe('123.456.789-01');
    expect(formatCpfOrCnpj('00000000E08G12')).toBe('00.000.000/E08G-12');
    expect(formatCpfOrCnpj('27865757000102')).toBe('27.865.757/0001-02');
  });
});
