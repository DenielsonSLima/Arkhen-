import { describe, expect, it } from 'vitest';
import { formatCpf, isValidCpf, normalizeCpf } from './cpf';

describe('cpf helpers', () => {
  it('normaliza e formata um CPF sem perder os dígitos', () => {
    expect(normalizeCpf('529.982.247-25')).toBe('52998224725');
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
  });

  it('formata progressivamente e limita a onze dígitos', () => {
    expect(formatCpf('52998')).toBe('529.98');
    expect(formatCpf('52998224725123')).toBe('529.982.247-25');
  });

  it.each(['529.982.247-25', '168.995.350-09'])('aceita o CPF válido %s', (cpf) => {
    expect(isValidCpf(cpf)).toBe(true);
  });

  it.each(['', '123', '111.111.111-11', '529.982.247-24'])('rejeita o CPF inválido %s', (cpf) => {
    expect(isValidCpf(cpf)).toBe(false);
  });
});
