import { normalizeCpf } from './cpf';

export const EMPLOYEE_PASSWORD_MIN_LENGTH = 10;
export const EMPLOYEE_PASSWORD_MAX_LENGTH = 128;
export const EMPLOYEE_PASSWORD_REQUIREMENTS =
  `Use de ${EMPLOYEE_PASSWORD_MIN_LENGTH} a ${EMPLOYEE_PASSWORD_MAX_LENGTH} caracteres, com pelo menos uma letra e um número, sem incluir o CPF.`;

export const validateEmployeePassword = (password: string, cpf?: string): string | null => {
  const hasControlCharacter = [...password].some((character) => {
    const codePoint = character.codePointAt(0) || 0;
    return codePoint <= 31 || codePoint === 127;
  });

  if (
    password.length < EMPLOYEE_PASSWORD_MIN_LENGTH
    || password.length > EMPLOYEE_PASSWORD_MAX_LENGTH
    || !/\p{L}/u.test(password)
    || !/[0-9]/.test(password)
    || hasControlCharacter
  ) {
    return EMPLOYEE_PASSWORD_REQUIREMENTS;
  }

  const normalizedCpf = normalizeCpf(cpf || '');
  const passwordDigits = password.replace(/\D/g, '');
  if (normalizedCpf.length === 11 && passwordDigits.includes(normalizedCpf)) {
    return EMPLOYEE_PASSWORD_REQUIREMENTS;
  }

  return null;
};
