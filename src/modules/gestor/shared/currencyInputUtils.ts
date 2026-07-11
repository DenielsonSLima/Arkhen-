const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function parseCurrencyInputValue(value: string | number): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const sanitized = value.trim().replace(/[^\d,.-]/g, '');
  if (!sanitized) return 0;

  const normalized = sanitized.includes(',')
    ? sanitized.replace(/\./g, '').replace(',', '.')
    : sanitized.replace(/\.(?=\d{3}(\D|$))/g, '');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCurrencyInputValue(value: string | number): string {
  return BRL_FORMATTER.format(parseCurrencyInputValue(value));
}
