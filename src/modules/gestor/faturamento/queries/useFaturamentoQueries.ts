import { useQuery } from '@tanstack/react-query';
import { faturamentoService, type FaturamentoDashboardFilters } from '../services/faturamentoService';
import { faturamentoKeys } from './faturamentoKeys';

const faturamentoQueryOptions = {
  staleTime: 30_000,
  gcTime: 5 * 60_000,
  retry: 1,
} as const;

export const useFaturamentoDashboardQuery = (filters: FaturamentoDashboardFilters) => (
  useQuery({
    queryKey: faturamentoKeys.dashboard(filters),
    queryFn: ({ signal }) => faturamentoService.getDashboard(filters, signal),
    ...faturamentoQueryOptions,
  })
);

export const useFaturamentoRecorrenciasQuery = () => (
  useQuery({
    queryKey: faturamentoKeys.recorrencias(),
    queryFn: ({ signal }) => faturamentoService.getRecorrencias(signal),
    ...faturamentoQueryOptions,
  })
);

export const useFaturamentoNfseQuery = (filters: { status?: string; search?: string }) => (
  useQuery({
    queryKey: faturamentoKeys.nfse(filters),
    queryFn: ({ signal }) => faturamentoService.getNfse(filters, signal),
    ...faturamentoQueryOptions,
  })
);

export const useFaturamentoInadimplenciaQuery = (filters: { minDias?: number; search?: string }) => (
  useQuery({
    queryKey: faturamentoKeys.inadimplencia(filters),
    queryFn: ({ signal }) => faturamentoService.getInadimplencia(filters, signal),
    ...faturamentoQueryOptions,
  })
);
