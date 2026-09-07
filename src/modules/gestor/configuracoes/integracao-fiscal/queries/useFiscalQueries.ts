import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fiscalIntegrationService } from '../services/fiscalIntegrationService';
import { getFiscalCompanies } from '../services/fiscalCompanyService';
import type { FiscalConfigData, FiscalContextInput } from '../services/fiscalIntegrationTypes';

export const fiscalKeys = {
  all: ['integracao-fiscal'] as const,
  contexts: ['integracao-fiscal', 'contexts'] as const,
  companies: ['integracao-fiscal', 'companies'] as const,
  readiness: (context: FiscalContextInput | null, ambiente: string) =>
    ['integracao-fiscal', 'readiness', context?.companyId, context?.uf, context?.municipio, ambiente] as const,
};

export function useFiscalQueries() {
  const queryClient = useQueryClient();
  const contexts = useQuery({ queryKey: fiscalKeys.contexts, queryFn: () => fiscalIntegrationService.listContextsData(), staleTime: 30_000 });
  const companies = useQuery({ queryKey: fiscalKeys.companies, queryFn: getFiscalCompanies, staleTime: 60_000 });
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: fiscalKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['faturamento'] }),
    ]);
  };
  const save = useMutation({
    mutationFn: ({ context, config, active }: { context: FiscalContextInput; config: FiscalConfigData; active: boolean }) =>
      fiscalIntegrationService.saveConfig(context, config, active),
    onSettled: invalidate,
  });
  const certificate = useMutation({
    mutationFn: ({ context, config, file }: { context: FiscalContextInput; config: FiscalConfigData; file: File }) =>
      fiscalIntegrationService.uploadCertificate(context, config, file),
    onSettled: invalidate,
  });
  const diagnostic = useMutation({
    mutationFn: ({ context, config, kind }: { context: FiscalContextInput; config: FiscalConfigData; kind: 'connection' | 'certificate' }) =>
      kind === 'connection' ? fiscalIntegrationService.testConnection(context, config) : fiscalIntegrationService.testCertificate(context, config),
    onSettled: invalidate,
  });
  return { contexts, companies, save, certificate, diagnostic };
}

export function useFiscalReadiness(context: FiscalContextInput | null, config: FiscalConfigData) {
  return useQuery({
    queryKey: fiscalKeys.readiness(context, config.ambiente),
    queryFn: () => fiscalIntegrationService.getReadiness(context!, config),
    enabled: Boolean(context),
    staleTime: 30_000,
    retry: false,
  });
}
