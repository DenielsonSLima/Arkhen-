import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { faturamentoFiscalService as service } from '../services/faturamentoFiscalService';
import type { FiscalAmbiente, FiscalDraft, FiscalDraftInput, FiscalHistoryFilters, FiscalPartnerScope, FiscalPreviousNote } from '../services/faturamentoFiscalTypes';
import { financeiroKeys } from '../../financeiro/queries/financeiroKeys';
import { inicioKeys } from '../../inicio/queries/inicioKeys';

export const fiscalBillingKeys = {
  all: ['faturamento', 'webiss'] as const,
  history: (tenant: string, filters: FiscalHistoryFilters) => [...fiscalBillingKeys.all, tenant, 'history', filters],
  previous: (tenant: string, scope: FiscalPartnerScope) => [...fiscalBillingKeys.all, tenant, 'previous', scope],
};
export function useFiscalBillingTenant() {
  return useQuery({ queryKey: [...fiscalBillingKeys.all, 'tenant'], queryFn: service.tenant, staleTime: 30_000 });
}
export function useFiscalEmitters(tenant: string) {
  return useQuery({ queryKey: [...fiscalBillingKeys.all, tenant, 'emitters'], queryFn: service.emitters, enabled: !!tenant, staleTime: 30_000 });
}
export function useFiscalBillingHistory(tenant: string, filters: FiscalHistoryFilters) {
  return useQuery({ queryKey: fiscalBillingKeys.history(tenant, filters), queryFn: () => service.list(filters), enabled: !!tenant, staleTime: 15_000 });
}
export function usePreviousFiscalNotes(tenant: string, scope: FiscalPartnerScope) {
  return useQuery({ queryKey: fiscalBillingKeys.previous(tenant, scope), queryFn: () => service.previous(scope),
    enabled: !!tenant && !!scope.fiscalConfigId && !!scope.clienteId && !!scope.dataInicial && !!scope.dataFinal, staleTime: 15_000 });
}
export function useFiscalChargeDraftLookup() {
  return useMutation({ mutationFn: ({ cobrancaId, ambiente }: { cobrancaId: string; ambiente?: FiscalAmbiente }) =>
    service.chargeDraft(cobrancaId, ambiente), retry: false });
}
export function useFiscalDraftMutations() {
  const queryClient = useQueryClient();
  const invalidate = async () => { await queryClient.invalidateQueries({ queryKey: ['faturamento'] }); };
  const invalidateFiscalResult = async () => { await Promise.all([
    invalidate(), queryClient.invalidateQueries({ queryKey: financeiroKeys.all }),
    queryClient.invalidateQueries({ queryKey: inicioKeys.all }),
  ]); };
  return {
    save: useMutation({ mutationFn: (draft: FiscalDraftInput) => service.save(draft), onSettled: invalidate }),
    review: useMutation({ mutationFn: service.review }),
    emit: useMutation({ mutationFn: (draft: FiscalDraft) => service.emit(draft), retry: false, onSettled: invalidateFiscalResult }),
    consult: useMutation({ mutationFn: (note: Pick<FiscalDraft, 'id' | 'origem'>) => service.consult(note), retry: false, onSettled: invalidateFiscalResult }),
    copy: useMutation({ mutationFn: ({ scope, note, competencia }: { scope: FiscalPartnerScope; note: FiscalPreviousNote; competencia: string }) =>
      service.copy(scope, note, competencia), onSettled: invalidate }),
    sync: useMutation({ mutationFn: ({ scope, inicio, fim }: { scope: FiscalPartnerScope; inicio: string; fim: string }) =>
      service.sync(scope, inicio, fim), onSettled: invalidate }),
  };
}
