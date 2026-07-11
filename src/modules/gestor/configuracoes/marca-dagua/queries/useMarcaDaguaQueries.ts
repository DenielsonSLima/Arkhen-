import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configuracoesKeys } from '../../queries/configuracoesKeys';
import { marcaDaguaService, type MarcaDaguaDados } from '../services/marcaDaguaService';

export const useMarcaDaguaQuery = () => {
  return useQuery({
    queryKey: configuracoesKeys.marcaDagua(),
    queryFn: marcaDaguaService.getMarcaDaguaConfig,
  });
};

export const useUpdateMarcaDaguaMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dados: MarcaDaguaDados) => marcaDaguaService.updateConfig(dados),
    onSuccess: (dados) => {
      queryClient.setQueryData(configuracoesKeys.marcaDagua(), dados);
      queryClient.invalidateQueries({ queryKey: configuracoesKeys.marcaDagua() });
    },
  });
};
