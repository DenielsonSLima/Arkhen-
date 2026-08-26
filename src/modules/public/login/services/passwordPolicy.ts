export const PASSWORD_REQUIREMENTS_MESSAGE = 'Use pelo menos 8 caracteres, incluindo uma letra e um número.';

export const validatePassword = (password: string): string | null => {
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return PASSWORD_REQUIREMENTS_MESSAGE;
  }

  return null;
};
