import { useQuery } from '@tanstack/react-query';
import { atividadesService } from '../services/atividadesService';
import { atividadesKeys } from './useAtividadesWorkspace';

export const useAtividadesModelos = () => {
  const query = useQuery({
    queryKey: atividadesKeys.modelos(),
    queryFn: () => atividadesService.getModelos(),
    staleTime: 60_000,
    refetchOnMount: 'always',
  });

  return {
    modelos: query.data || [],
    isLoadingModelos: query.isLoading,
    isModelosError: query.isError,
    reloadModelos: query.refetch,
  };
};
