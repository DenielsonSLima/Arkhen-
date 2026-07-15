import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configuracoesKeys } from '../../queries/configuracoesKeys';
import type { BankGatewayId } from '../gateway/bankGateway';
import { bankIntegrationService } from '../services/bankIntegrationService';

export const useBankIntegrations = () => {
  const queryClient = useQueryClient();
  const integrationsQuery = useQuery({
    queryKey: configuracoesKeys.integracaoBancaria(),
    queryFn: bankIntegrationService.list,
    staleTime: 30_000,
    retry: 1,
  });
  const selectProviderMutation = useMutation({
    mutationFn: (provider: BankGatewayId) => bankIntegrationService.selectProvider(provider),
    onSuccess: (data) => {
      queryClient.setQueryData(configuracoesKeys.integracaoBancaria(), data);
      queryClient.invalidateQueries({ queryKey: configuracoesKeys.integracaoBancaria() });
    },
  });

  const integrations = integrationsQuery.data || [];

  return {
    integrations,
    activeIntegration: integrations.find((item) => item.selected) || integrations[0] || null,
    isLoading: integrationsQuery.isLoading,
    error: integrationsQuery.error || selectProviderMutation.error,
    isSelecting: selectProviderMutation.isPending,
    selectProvider: selectProviderMutation.mutate,
  };
};
