import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  pastasPadraoKeys,
  pastasPadraoService,
  type SavePastaPadraoInput,
} from './pastasPadraoService';

export const usePastasPadraoQuery = () => (
  useQuery({
    queryKey: pastasPadraoKeys.all,
    queryFn: pastasPadraoService.list,
  })
);

export const useActivePastasPadraoQuery = () => (
  useQuery({
    queryKey: [...pastasPadraoKeys.all, 'ativas'] as const,
    queryFn: pastasPadraoService.listActivePaths,
    staleTime: 5 * 60 * 1000,
  })
);

export const useSavePastaPadraoMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SavePastaPadraoInput) => pastasPadraoService.save(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pastasPadraoKeys.all });
    },
  });
};

export const useTogglePastaPadraoMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) => pastasPadraoService.setAtivo(id, ativo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pastasPadraoKeys.all });
    },
  });
};

export const useApplyPastasPadraoMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: pastasPadraoService.applyActiveToAllCompanies,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['documentos', 'companies'] });
    },
  });
};
