import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configuracoesKeys } from '../../queries/configuracoesKeys';
import { modulosSistemaQueries } from '../queries/modulosSistemaQueries';
import {
  modulosSistemaService,
  type SaveSystemModuleInput,
} from '../services/modulosSistemaService';

export const useModulosSistemaQuery = () => useQuery(modulosSistemaQueries.list());

export const useSaveModulosSistemaMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveSystemModuleInput[]) => modulosSistemaService.save(input),
    onSuccess: (data) => {
      queryClient.setQueryData(configuracoesKeys.modulosSistema(), data);
      queryClient.invalidateQueries({ queryKey: configuracoesKeys.modulosSistema() });
    },
  });
};
