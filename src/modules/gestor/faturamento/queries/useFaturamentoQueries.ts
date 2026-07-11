import { useQuery } from '@tanstack/react-query';
import { faturamentoService, type FaturamentoDashboardFilters } from '../services/faturamentoService';
import { faturamentoKeys } from './faturamentoKeys';

export const useFaturamentoDashboardQuery = (filters: FaturamentoDashboardFilters) => (
  useQuery({
    queryKey: faturamentoKeys.dashboard(filters),
    queryFn: () => faturamentoService.getDashboard(filters),
  })
);

export const useFaturamentoRecorrenciasQuery = () => (
  useQuery({
    queryKey: faturamentoKeys.recorrencias(),
    queryFn: faturamentoService.getRecorrencias,
  })
);

export const useFaturamentoNfseQuery = (filters: { status?: string; search?: string }) => (
  useQuery({
    queryKey: faturamentoKeys.nfse(filters),
    queryFn: () => faturamentoService.getNfse(filters),
  })
);

export const useFaturamentoInadimplenciaQuery = (filters: { minDias?: number; search?: string }) => (
  useQuery({
    queryKey: faturamentoKeys.inadimplencia(filters),
    queryFn: () => faturamentoService.getInadimplencia(filters),
  })
);
