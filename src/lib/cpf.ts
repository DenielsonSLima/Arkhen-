export const normalizeCpf = (value: string) => value.replace(/\D/g, '');

export const formatCpf = (value: string) => {
  const digits = normalizeCpf(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
};

const calculateCheckDigit = (digits: string, initialWeight: number) => {
  const sum = digits
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * (initialWeight - index), 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
};

export const isValidCpf = (value: string) => {
  const digits = normalizeCpf(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const firstDigit = calculateCheckDigit(digits.slice(0, 9), 10);
  const secondDigit = calculateCheckDigit(`${digits.slice(0, 9)}${firstDigit}`, 11);
  return digits.endsWith(`${firstDigit}${secondDigit}`);
};
