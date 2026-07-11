import { useQuery } from '@tanstack/react-query';
import { configuracoesKeys } from '../../queries/configuracoesKeys';
import { logsEventosService } from '../services/logsEventosService';

export const useLogsEventosQuery = () => (
  useQuery({
    queryKey: configuracoesKeys.logsEventos(),
    queryFn: logsEventosService.getLogs,
  })
);
