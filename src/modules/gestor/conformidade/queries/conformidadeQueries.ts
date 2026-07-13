import { conformidadeService } from '../services/conformidadeService';

export const conformidadeKeys = {
  all: ['conformidade'] as const,
  obrigacoes: (companyId?: string) => [...conformidadeKeys.all, 'obrigacoes', companyId || 'todas'] as const,
  referenceSteps: () => [...conformidadeKeys.all, 'reference-steps'] as const,
};

export const conformidadeQueries = {
  obrigacoes: (companyId?: string) => ({
    queryKey: conformidadeKeys.obrigacoes(companyId),
    queryFn: () => conformidadeService.getObrigacoes(companyId),
    staleTime: 30_000,
  }),
  referenceSteps: () => ({
    queryKey: conformidadeKeys.referenceSteps(),
    queryFn: () => conformidadeService.getReferenceSteps(),
    staleTime: 60_000,
  }),
  toggleEtapa: conformidadeService.toggleEtapa,
};
