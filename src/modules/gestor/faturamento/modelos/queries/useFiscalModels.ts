import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { modelosFiscalService as service, type FiscalModel, type ModelInput } from '../services/modelosFiscalService';
export const fiscalModelKeys = { tenant: (tenant: string) => ['faturamento', 'modelos', tenant] as const };
export function useFiscalModels(tenant: string) {
  const client = useQueryClient();
  const key = fiscalModelKeys.tenant(tenant);
  return {
    list: useQuery({ queryKey: key, queryFn: () => service.list(tenant), enabled: !!tenant, staleTime: 0,
      refetchInterval: 30_000, refetchOnWindowFocus: true }),
    save: useMutation({ mutationFn: (input: ModelInput) => service.save(tenant, input), retry: false,
      onSettled: () => client.invalidateQueries({ queryKey: key }) }),
    activate: useMutation({ mutationFn: ({ model, active }: { model: FiscalModel; active: boolean }) => service.activate(tenant, model, active), retry: false,
      onSettled: () => client.invalidateQueries({ queryKey: key }) }),
  };
}
