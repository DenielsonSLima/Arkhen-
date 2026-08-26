import { useQuery } from '@tanstack/react-query';
import { inicioService } from '../services/inicioService';
import { inicioKeys } from '../queries/inicioKeys';
import { EMPTY_INICIO_DASHBOARD_SUMMARY } from '../services/inicioDashboardSummary';

export const useInicio = () => {
  const dashboardQuery = useQuery({
    queryKey: inicioKeys.dashboard(),
    queryFn: () => inicioService.getDashboardData(),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  return {
    stats: dashboardQuery.data?.stats ?? null,
    summary: dashboardQuery.data?.summary ?? EMPTY_INICIO_DASHBOARD_SUMMARY,
    isLoading: dashboardQuery.isLoading,
    dashboardError: dashboardQuery.isError,
    retryDashboard: dashboardQuery.refetch,
  };
};
