import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configuracoesKeys } from '../../queries/configuracoesKeys';
import { contasBancariasService, type ContaBancaria } from '../services/contasBancariasService';

const invalidateContasBancarias = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: configuracoesKeys.contasBancarias() });
  queryClient.invalidateQueries({ queryKey: configuracoesKeys.contasBancariasResumo() });
};

export const useContasBancariasQuery = () => (
  useQuery({
    queryKey: configuracoesKeys.contasBancarias(),
    queryFn: contasBancariasService.getContas,
  })
);

export const useContasBancariasResumoQuery = () => (
  useQuery({
    queryKey: configuracoesKeys.contasBancariasResumo(),
    queryFn: contasBancariasService.getResumo,
  })
);

export const useSaveContaBancariaMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conta: Omit<ContaBancaria, 'saldoAtual'>) => contasBancariasService.saveConta(conta),
    onSuccess: () => invalidateContasBancarias(queryClient),
  });
};

export const useDeleteContaBancariaMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => contasBancariasService.deleteConta(id),
    onSuccess: () => invalidateContasBancarias(queryClient),
  });
};
