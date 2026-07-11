import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configuracoesKeys } from '../../../queries/configuracoesKeys';
import type { BankEnvironment } from '../../gateway/bankGateway';
import { asaasService, type AsaasEnvironmentConfig, type AsaasIntegrationConfig } from '../services/asaasService';

export const useAsaasIntegration = () => {
  const queryClient = useQueryClient();

  const asaasQuery = useQuery({
    queryKey: configuracoesKeys.asaas(),
    queryFn: asaasService.getConfig,
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: asaasService.updateConfig,
    onSuccess: (data) => {
      queryClient.setQueryData(configuracoesKeys.asaas(), data);
      queryClient.invalidateQueries({ queryKey: configuracoesKeys.all });
    },
  });

  const config = asaasQuery.data || null;
  const activeEnvironment = config?.activeEnvironment || 'homologacao';
  const activeConfig = config?.environments[activeEnvironment] || null;

  const updateConfig = (updater: (current: AsaasIntegrationConfig) => AsaasIntegrationConfig) => {
    const current = config;
    if (!current) return;
    queryClient.setQueryData(
      configuracoesKeys.asaas(),
      updater(current),
    );
  };

  const setActiveEnvironment = (environment: BankEnvironment) => {
    updateConfig((current) => ({ ...current, activeEnvironment: environment }));
  };

  const updateEnvironmentConfig = (
    environment: BankEnvironment,
    field: keyof AsaasEnvironmentConfig,
    value: string | boolean | number,
  ) => {
    updateConfig((current) => ({
      ...current,
      environments: {
        ...current.environments,
        [environment]: {
          ...current.environments[environment],
          [field]: value,
        },
      },
    }));
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!config) return;
    await saveMutation.mutateAsync(config);
  };

  return {
    config,
    activeEnvironment,
    activeConfig,
    isLoading: asaasQuery.isLoading,
    isSaving: saveMutation.isPending,
    isSaved: saveMutation.isSuccess,
    saveError: saveMutation.error,
    setActiveEnvironment,
    updateEnvironmentConfig,
    handleSave,
  };
};
