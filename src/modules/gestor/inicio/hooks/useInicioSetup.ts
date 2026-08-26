import { useQuery } from '@tanstack/react-query';
import { inicioKeys } from '../queries/inicioKeys';
import { inicioSetupService } from '../services/inicioSetupService';

export const useInicioSetup = () => useQuery({
  queryKey: inicioKeys.setup(),
  queryFn: () => inicioSetupService.getStatus(),
  staleTime: 30_000,
  gcTime: 10 * 60_000,
  refetchOnMount: 'always',
});
