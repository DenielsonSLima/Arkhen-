import type { FaturamentoDashboardFilters } from '../services/faturamentoService';

export const faturamentoKeys = {
  all: ['faturamento'] as const,
  parametros: () => [...faturamentoKeys.all, 'parametros'] as const,
  dashboard: (filters: FaturamentoDashboardFilters) => [...faturamentoKeys.all, 'dashboard', filters] as const,
  recorrencias: () => [...faturamentoKeys.all, 'recorrencias'] as const,
  nfse: (filters: { status?: string; search?: string }) => [...faturamentoKeys.all, 'nfse', filters] as const,
  inadimplencia: (filters: { minDias?: number; search?: string }) => [...faturamentoKeys.all, 'inadimplencia', filters] as const,
};
