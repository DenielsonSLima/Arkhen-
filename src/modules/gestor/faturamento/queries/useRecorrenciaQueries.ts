import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { recorrenciaService } from '../services/recorrenciaService';
import { faturamentoKeys } from './faturamentoKeys';
import { financeiroKeys } from '../../financeiro/queries/financeiroKeys';

export const useRecorrenciaExecucoes = (id?: string) => useQuery({
  queryKey: [...faturamentoKeys.recorrencias(), 'execucoes', id],
  queryFn: () => recorrenciaService.list(id), staleTime: 15_000, refetchInterval: 30_000,
});
export const useRecorrenciaConfig = (id?: string) => useQuery({
  queryKey: [...faturamentoKeys.recorrencias(), 'config', id],
  queryFn: () => recorrenciaService.config(id!), enabled: !!id,
});
export function useRecorrenciaMutations() {
  const client = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: faturamentoKeys.all }),
      client.invalidateQueries({ queryKey: financeiroKeys.all }),
    ]);
  };
  const save = useMutation({ mutationFn: recorrenciaService.save, onSuccess: refresh });
  const run = useMutation({ mutationFn: recorrenciaService.run, onSettled: refresh });
  return { save, run };
}
