import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configuracoesKeys } from '../../queries/configuracoesKeys';
import { empresaService, type EmpresaDados } from '../services/empresaService';

export const useEmpresaQuery = () => {
  return useQuery({
    queryKey: configuracoesKeys.empresa(),
    queryFn: empresaService.getDadosEmpresa,
  });
};

export const useUpdateEmpresaMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dados: EmpresaDados) => empresaService.updateDadosEmpresa(dados),
    onSuccess: (dados) => {
      queryClient.setQueryData(configuracoesKeys.empresa(), dados);
      queryClient.invalidateQueries({ queryKey: configuracoesKeys.empresa() });
    },
  });
};
