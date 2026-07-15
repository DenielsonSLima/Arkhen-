import { configuracoesKeys } from '../../queries/configuracoesKeys';
import { modulosSistemaService } from '../services/modulosSistemaService';

export const modulosSistemaQueries = {
  list: () => ({
    queryKey: configuracoesKeys.modulosSistema(),
    queryFn: modulosSistemaService.list,
    staleTime: 60_000,
    retry: false,
  }),
};
