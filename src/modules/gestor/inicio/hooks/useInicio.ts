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

  const vencimentosQuery = useQuery({
    queryKey: inicioKeys.vencimentos(),
    queryFn: () => inicioService.getVencimentosProximos(),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  return {
    stats: dashboardQuery.data?.stats ?? null,
    atividades: dashboardQuery.data?.atividades ?? [],
    agenda: dashboardQuery.data?.agenda ?? [],
    vencimentosProximos: vencimentosQuery.data ?? [],
    isLoading: dashboardQuery.isLoading || vencimentosQuery.isLoading,
  };
};
