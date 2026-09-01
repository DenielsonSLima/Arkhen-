import { describe, expect, it } from 'vitest';
import {
  EMPLOYEE_PASSWORD_REQUIREMENTS,
  validateEmployeePassword,
} from './employeePasswordPolicy';

describe('validateEmployeePassword', () => {
  it.each([
    'Senha12345',
    'SenhaForte123',
    'AcessoOperacional2026',
    `A${'a'.repeat(126)}1`,
  ])('aceita a senha forte %s', (password) => {
    expect(validateEmployeePassword(password, '529.982.247-25')).toBeNull();
  });

  it.each([
    ['Curta123', 'menos de 10 caracteres'],
    [`A${'a'.repeat(127)}1`, 'mais de 128 caracteres'],
    ['1234567890', 'sem letra'],
    ['SenhaSemNumero', 'sem número'],
    ['Senha\nForte123', 'caractere de controle'],
  ])('rejeita senha com %s (%s)', (password) => {
    expect(validateEmployeePassword(password, '529.982.247-25')).toBe(EMPLOYEE_PASSWORD_REQUIREMENTS);
  });

  it.each([
    'A52998224725x',
    'A529.982.247-25x',
  ])('rejeita senha que contenha o CPF: %s', (password) => {
    expect(validateEmployeePassword(password, '529.982.247-25')).toBe(EMPLOYEE_PASSWORD_REQUIREMENTS);
  });
});
