import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  planosContratacaoService,
  type PlanoContratacaoId,
} from '../services/planosContratacaoService';

export const planosContratacaoKeys = {
  resumo: ['configuracoes', 'planos-contratacao', 'resumo'] as const,
};

export const usePlanoContratacaoResumoQuery = () => (
  useQuery({
    queryKey: planosContratacaoKeys.resumo,
    queryFn: planosContratacaoService.getResumo.bind(planosContratacaoService),
    staleTime: 30_000,
  })
);

export const useSelecionarPlanoContratacaoMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ empresaId, planoId }: { empresaId: string; planoId: PlanoContratacaoId }) => (
      planosContratacaoService.setPlanoEmpresa(empresaId, planoId)
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planosContratacaoKeys.resumo });
    },
  });
};
