export const EMPLOYEE_PASSWORD_REQUIREMENTS =
  'Use de 10 a 128 caracteres, com pelo menos uma letra e um número, sem incluir o CPF.';

const DEFAULT_ACCESS_MESSAGE =
  'Seu acesso não está permitido neste dia ou horário. Entre em contato com o gestor.';
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const hasControlCharacter = (value: string): boolean => [...value].some((character) => {
  const codePoint = character.codePointAt(0) || 0;
  return codePoint <= 31 || codePoint === 127;
});

const hasMarkupDelimiter = (value: string): boolean =>
  value.includes('<') || value.includes('>');

export interface EmployeeAccessInterval {
  start: string;
  end: string;
}

export interface EmployeeAccessConfig {
  enabled: boolean;
  days: number[];
  intervals: EmployeeAccessInterval[];
  message: string;
}

export interface CpfLoginCredentials {
  cpf: string;
  password: string;
}

export type EmployeeStatus = 'Ativo' | 'Inativo' | 'Pendente';

export class InputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputValidationError';
  }
}

export const normalizeCpf = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/\D/g, '') : '';

const calculateCpfCheckDigit = (digits: string, initialWeight: number): number => {
  const sum = [...digits].reduce(
    (total, digit, index) => total + Number(digit) * (initialWeight - index),
    0,
  );
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
};

export const isValidCpf = (value: unknown): boolean => {
  if (typeof value !== 'string' || !/^[\d.\-\s]+$/.test(value.trim())) return false;

  const cpf = normalizeCpf(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const firstDigit = calculateCpfCheckDigit(cpf.slice(0, 9), 10);
  const secondDigit = calculateCpfCheckDigit(`${cpf.slice(0, 9)}${firstDigit}`, 11);
  return cpf.endsWith(`${firstDigit}${secondDigit}`);
};

export const normalizeEmployeeName = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

export const validateEmployeeName = (value: unknown): string | null => {
  const name = normalizeEmployeeName(value);
  if (
    name.length < 2
    || name.length > 150
    || !/\p{L}/u.test(name)
    || hasControlCharacter(name)
    || hasMarkupDelimiter(name)
  ) {
    return 'Informe um nome válido com até 150 caracteres.';
  }
  return null;
};

const invalidContactEmail = (): InputValidationError =>
  new InputValidationError('Informe um e-mail de contato válido com até 150 caracteres.');

const normalizeEmailDomain = (value: string): string => {
  const domain = value.trim().toLowerCase();
  const labels = domain.split('.');
  const validLabels = labels.length >= 2 && labels.every((label) => (
    label.length >= 1
    && label.length <= 63
    && /^[a-z0-9-]+$/.test(label)
    && !label.startsWith('-')
    && !label.endsWith('-')
  ));
  const topLevelDomain = labels.at(-1) || '';

  if (!validLabels || !/^[a-z]{2,63}$/.test(topLevelDomain)) {
    throw invalidContactEmail();
  }
  return domain;
};

export const normalizeContactEmail = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > 300) throw invalidContactEmail();

  const email = value.trim().toLowerCase();
  if (!email) return null;
  if (email.length > 150 || hasControlCharacter(email) || hasMarkupDelimiter(email)) {
    throw invalidContactEmail();
  }

  const parts = email.split('@');
  if (parts.length !== 2) throw invalidContactEmail();

  const [localPart, rawDomain] = parts;
  if (
    !localPart
    || localPart.length > 64
    || localPart.startsWith('.')
    || localPart.endsWith('.')
    || localPart.includes('..')
    || !/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/i.test(localPart)
  ) {
    throw invalidContactEmail();
  }

  try {
    const domain = normalizeEmailDomain(rawDomain);
    return `${localPart}@${domain}`;
  } catch {
    throw invalidContactEmail();
  }
};

export const normalizePhone = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > 40) {
    throw new InputValidationError('Informe um telefone válido com 10 ou 11 dígitos.');
  }

  const phone = value.trim();
  if (!phone) return null;
  if (!/^[\d\s()+.-]+$/.test(phone)) {
    throw new InputValidationError('Informe um telefone válido com 10 ou 11 dígitos.');
  }

  const digits = phone.replace(/\D/g, '');
  if (digits.length !== 10 && digits.length !== 11) {
    throw new InputValidationError('Informe um telefone válido com 10 ou 11 dígitos.');
  }
  return digits;
};

export const parseEmployeeStatus = (value: unknown): EmployeeStatus => {
  if (value === undefined || value === null) return 'Ativo';
  if (value === 'Ativo' || value === 'Inativo' || value === 'Pendente') return value;
  throw new InputValidationError('O status do funcionário é inválido.');
};

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value);

export const validatePassword = (password: unknown, cpfValue?: unknown): string | null => {
  if (
    typeof password !== 'string'
    || password.length < 10
    || password.length > 128
    || !/\p{L}/u.test(password)
    || !/[0-9]/.test(password)
    || hasControlCharacter(password)
  ) {
    return EMPLOYEE_PASSWORD_REQUIREMENTS;
  }

  const cpf = normalizeCpf(cpfValue);
  const passwordDigits = password.replace(/\D/g, '');
  if (cpf.length === 11 && passwordDigits.includes(cpf)) {
    return EMPLOYEE_PASSWORD_REQUIREMENTS;
  }

  return null;
};

export const parseCpfLoginCredentials = (
  cpfValue: unknown,
  passwordValue: unknown,
): CpfLoginCredentials => {
  if (
    !isValidCpf(cpfValue)
    || typeof passwordValue !== 'string'
    || passwordValue.length === 0
    || passwordValue.length > 128
    || hasControlCharacter(passwordValue)
  ) {
    throw new InputValidationError('CPF ou senha inválidos.');
  }
  return { cpf: normalizeCpf(cpfValue), password: passwordValue };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseDefaultSupabaseSecretKey = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new InputValidationError('Chave secreta de login indisponível.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new InputValidationError('Chave secreta de login indisponível.');
  }

  if (!isRecord(parsed)) {
    throw new InputValidationError('Chave secreta de login indisponível.');
  }
  const key = parsed.default;
  if (
    typeof key !== 'string'
    || !/^sb_secret_[A-Za-z0-9_-]{8,}$/.test(key)
    || key.length > 512
  ) {
    throw new InputValidationError('Chave secreta de login indisponível.');
  }
  return key;
};

export const parseForwardedFor = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new InputValidationError('IP de origem indisponível.');
  }
  const forwardedFor = value.trim();
  if (
    !forwardedFor
    || forwardedFor.length > 512
    || !/^[0-9a-f:.,\s]+$/i.test(forwardedFor)
    || hasControlCharacter(forwardedFor)
  ) {
    throw new InputValidationError('IP de origem indisponível.');
  }
  return forwardedFor;
};

const defaultAccessConfig = (): EmployeeAccessConfig => ({
  enabled: false,
  days: [1, 2, 3, 4, 5],
  intervals: [{ start: '08:00', end: '18:00' }],
  message: DEFAULT_ACCESS_MESSAGE,
});

export const parseAccessConfig = (value: unknown): EmployeeAccessConfig => {
  if (value === undefined || value === null) return defaultAccessConfig();
  if (!isRecord(value)) {
    throw new InputValidationError('A configuração de acesso é inválida.');
  }

  const defaults = defaultAccessConfig();
  const enabled = value.enabled === undefined ? defaults.enabled : value.enabled;
  const days = value.days === undefined ? defaults.days : value.days;
  const intervals = value.intervals === undefined ? defaults.intervals : value.intervals;
  const rawMessage = value.message === undefined ? defaults.message : value.message;

  if (typeof enabled !== 'boolean') {
    throw new InputValidationError('A configuração de acesso é inválida.');
  }
  if (
    !Array.isArray(days)
    || days.length > 7
    || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
    || new Set(days).size !== days.length
    || (enabled && days.length === 0)
  ) {
    throw new InputValidationError('Os dias permitidos são inválidos.');
  }
  if (!Array.isArray(intervals) || intervals.length > 8 || (enabled && intervals.length === 0)) {
    throw new InputValidationError('Os intervalos permitidos são inválidos.');
  }

  const parsedIntervals = intervals.map((interval) => {
    if (
      !isRecord(interval)
      || typeof interval.start !== 'string'
      || typeof interval.end !== 'string'
      || !TIME_PATTERN.test(interval.start)
      || !TIME_PATTERN.test(interval.end)
      || interval.start >= interval.end
    ) {
      throw new InputValidationError('Os intervalos permitidos são inválidos.');
    }
    return { start: interval.start, end: interval.end };
  });

  if (
    typeof rawMessage !== 'string'
    || rawMessage.length > 300
    || hasControlCharacter(rawMessage)
    || hasMarkupDelimiter(rawMessage)
  ) {
    throw new InputValidationError('A mensagem de bloqueio é inválida.');
  }

  return {
    enabled,
    days: [...days].sort((left, right) => left - right),
    intervals: parsedIntervals,
    message: rawMessage.trim() || defaults.message,
  };
};
