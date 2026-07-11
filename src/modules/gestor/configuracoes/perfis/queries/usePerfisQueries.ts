import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configuracoesKeys } from '../../queries/configuracoesKeys';
import { perfisService, type SavePerfilAcessoInput } from '../services/perfisService';

export const usePerfisAcessoQuery = () => {
  return useQuery({
    queryKey: configuracoesKeys.perfisAcesso(),
    queryFn: perfisService.listPerfis,
  });
};

export const useSavePerfilAcessoMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SavePerfilAcessoInput) => perfisService.savePerfil(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: configuracoesKeys.perfisAcesso() });
    },
  });
};

export const useDeletePerfilAcessoMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => perfisService.deletePerfil(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: configuracoesKeys.perfisAcesso() });
    },
  });
};
