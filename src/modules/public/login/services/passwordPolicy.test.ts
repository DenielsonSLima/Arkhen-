/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';
import {
  PASSWORD_REQUIREMENTS_MESSAGE,
  validatePassword,
} from './passwordPolicy';

describe('validatePassword', () => {
  it.each([
    ['a1', 'menos de seis caracteres'],
    ['abcdef', 'nenhum número'],
    ['123456', 'nenhuma letra'],
  ])('rejeita uma senha com %s (%s)', (password) => {
    expect(validatePassword(password)).toBe(PASSWORD_REQUIREMENTS_MESSAGE);
  });

  it.each([
    'abcde1',
    'Senha123',
  ])('aceita a senha válida %s', (password) => {
    expect(validatePassword(password)).toBeNull();
  });
});
