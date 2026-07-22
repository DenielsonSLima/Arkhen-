import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  faturamentoService,
  type FaturamentoDashboardFilters,
  type FaturamentoParametros,
} from '../services/faturamentoService';
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

export const useFaturamentoParametrosQuery = () => (
  useQuery({
    queryKey: faturamentoKeys.parametros(),
    queryFn: ({ signal }) => faturamentoService.getParametros(signal),
    ...faturamentoQueryOptions,
  })
);

export const useSaveFaturamentoParametrosMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (parametros: FaturamentoParametros) => faturamentoService.saveParametros(parametros),
    onSuccess: (parametros) => {
      queryClient.setQueryData(faturamentoKeys.parametros(), parametros);
      void queryClient.invalidateQueries({ queryKey: faturamentoKeys.all });
    },
  });
};

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
