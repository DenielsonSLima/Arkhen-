import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configuracoesKeys } from '../../queries/configuracoesKeys';
import { contadoresService, type Contador } from '../services/contadoresService';

export const useContadoresQuery = () => (
  useQuery({
    queryKey: configuracoesKeys.contadores(),
    queryFn: contadoresService.getContadores,
  })
);

export const useAddContadorMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contador: Omit<Contador, 'id' | 'isResponsavel'>) => contadoresService.addContador(contador),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: configuracoesKeys.contadores() }),
  });
};

export const useSetContadorResponsavelMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => contadoresService.setResponsavel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: configuracoesKeys.contadores() }),
  });
};
