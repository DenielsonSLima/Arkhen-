export const PASSWORD_REQUIREMENTS_MESSAGE = 'Use pelo menos 6 caracteres, incluindo uma letra e um número.';

export const validatePassword = (password: string): string | null => {
  if (password.length < 6 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return PASSWORD_REQUIREMENTS_MESSAGE;
  }

  return null;
};
