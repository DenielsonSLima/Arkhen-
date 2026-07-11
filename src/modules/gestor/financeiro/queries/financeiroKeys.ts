export const financeiroKeys = {
  all: ['financeiro'] as const,
  contratos: () => [...financeiroKeys.all, 'contratos'] as const,
  cobrancas: () => [...financeiroKeys.all, 'cobrancas'] as const,
  lancamentos: () => [...financeiroKeys.all, 'lancamentos'] as const,
  dashboard: (meses = 6) => [...financeiroKeys.all, 'dashboard', meses] as const,
};
