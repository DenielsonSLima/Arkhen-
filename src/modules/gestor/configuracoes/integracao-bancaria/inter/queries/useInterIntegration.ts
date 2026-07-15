import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configuracoesKeys } from '../../../queries/configuracoesKeys';
import type { BankEnvironment } from '../../gateway/bankGateway';
import { interService } from '../services/interService';
import type { InterEnvironmentConfig, InterIntegrationConfig } from '../types/interTypes';

export const useInterIntegration = () => {
  const queryClient = useQueryClient();
  const configQuery = useQuery({
    queryKey: configuracoesKeys.inter(),
    queryFn: interService.getConfig,
    staleTime: 30_000,
    retry: 1,
  });
  const saveMutation = useMutation({
    mutationFn: interService.updateConfig,
    onSuccess: (data) => {
      queryClient.setQueryData(configuracoesKeys.inter(), data);
      queryClient.invalidateQueries({ queryKey: configuracoesKeys.inter() });
      queryClient.invalidateQueries({ queryKey: configuracoesKeys.integracaoBancaria() });
    },
  });
  const testMutation = useMutation({
    mutationFn: interService.testConnection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: configuracoesKeys.integracaoBancaria() }),
  });
  const webhookMutation = useMutation({
    mutationFn: interService.configureWebhook,
  });

  const config = configQuery.data || null;
  const activeEnvironment = config?.activeEnvironment || 'homologacao';

  const updateConfig = (updater: (current: InterIntegrationConfig) => InterIntegrationConfig) => {
    queryClient.setQueryData<InterIntegrationConfig | null>(configuracoesKeys.inter(), (current) => (
      current ? updater(current) : current
    ));
  };
  const setActiveEnvironment = (environment: BankEnvironment) => updateConfig((current) => ({
    ...current,
    activeEnvironment: environment,
  }));
  const patchEnvironment = (changes: Partial<InterEnvironmentConfig>) => updateConfig((current) => {
    const moduleChanges = {
      ...(changes.boletoAtivo === undefined ? {} : { boletoAtivo: changes.boletoAtivo }),
      ...(changes.pixAtivo === undefined ? {} : { pixAtivo: changes.pixAtivo }),
      ...(changes.webhookAtivo === undefined ? {} : { webhookAtivo: changes.webhookAtivo }),
    };
    return {
      ...current,
      environments: {
        producao: {
          ...current.environments.producao,
          ...moduleChanges,
          ...(current.activeEnvironment === 'producao' ? changes : {}),
        },
        homologacao: {
          ...current.environments.homologacao,
          ...moduleChanges,
          ...(current.activeEnvironment === 'homologacao' ? changes : {}),
        },
      },
    };
  });

  return {
    config,
    activeEnvironment,
    activeConfig: config?.environments[activeEnvironment] || null,
    isLoading: configQuery.isLoading,
    loadError: configQuery.error,
    isSaving: saveMutation.isPending,
    isSaved: saveMutation.isSuccess,
    saveError: saveMutation.error,
    connectionResult: testMutation.data || null,
    connectionError: testMutation.error,
    isTesting: testMutation.isPending,
    webhookResult: webhookMutation.data || null,
    webhookError: webhookMutation.error,
    isConfiguringWebhook: webhookMutation.isPending,
    setActiveEnvironment,
    patchEnvironment,
    save: () => config && saveMutation.mutateAsync(config),
    testConnection: () => testMutation.mutateAsync(activeEnvironment),
    configureWebhook: () => webhookMutation.mutateAsync(activeEnvironment),
  };
};
