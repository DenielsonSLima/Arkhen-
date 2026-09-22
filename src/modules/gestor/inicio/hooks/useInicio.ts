import { useQuery } from '@tanstack/react-query';
import { inicioService } from '../services/inicioService';
import { inicioKeys } from '../queries/inicioKeys';

export const useInicio = () => {
  const dashboardQuery = useQuery({
    queryKey: inicioKeys.dashboard(),
    queryFn: () => inicioService.getDashboardData(),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  const vencimentosQuery = useInicioValidades();

  return {
    stats: dashboardQuery.data?.stats ?? null,
    error: dashboardQuery.error || vencimentosQuery.error,
    vencimentosProximos: vencimentosQuery.data ?? [],
    isLoading: dashboardQuery.isLoading || vencimentosQuery.isLoading,
  };
};

export const useInicioValidades = () => useQuery({
    queryKey: inicioKeys.vencimentos(),
    queryFn: () => inicioService.getVencimentosProximos(),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
});
