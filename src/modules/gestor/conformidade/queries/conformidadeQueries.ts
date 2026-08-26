import { conformidadeService } from '../services/conformidadeOperationalService';

export const conformidadeKeys = {
  all: ['conformidade'] as const,
  obrigacoes: (companyId?: string, competencia?: string) => [
    ...conformidadeKeys.all, 'obrigacoes', companyId || 'todas', competencia || 'atual',
  ] as const,
};

export const conformidadeQueries = {
  obrigacoes: (companyId?: string, competencia?: string) => ({
    queryKey: conformidadeKeys.obrigacoes(companyId, competencia),
    queryFn: () => conformidadeService.getObrigacoes(companyId, competencia),
    staleTime: 30_000,
  }),
  toggleEtapa: conformidadeService.toggleEtapa,
};
