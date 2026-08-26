import { conformidadeService } from '../services/conformidadeOperationalService';

export const conformidadeKeys = {
  all: ['conformidade'] as const,
  obrigacoes: (companyId?: string) => [...conformidadeKeys.all, 'obrigacoes', companyId || 'todas'] as const,
};

export const conformidadeQueries = {
  obrigacoes: (companyId?: string) => ({
    queryKey: conformidadeKeys.obrigacoes(companyId),
    queryFn: () => conformidadeService.getObrigacoes(companyId),
    staleTime: 30_000,
  }),
  toggleEtapa: conformidadeService.toggleEtapa,
};
