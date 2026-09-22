import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { configuracoesKeys } from '../../queries/configuracoesKeys';
import { logsEventosService, type LogCursor, type LogFilters } from '../services/logsEventosService';

export const useLogsEventosQuery = (filters: LogFilters) => useInfiniteQuery({
  queryKey: [...configuracoesKeys.logsEventos(), filters],
  placeholderData: keepPreviousData,
  initialPageParam: null as LogCursor | null,
  queryFn: ({ pageParam }) => logsEventosService.getLogsPage(filters, pageParam),
  getNextPageParam: (page) => page.next,
});
