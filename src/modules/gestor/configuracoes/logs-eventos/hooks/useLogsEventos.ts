import { useLogsEventosQuery } from '../queries/useLogsEventosQueries';

export const useLogsEventos = () => {
  const logsQuery = useLogsEventosQuery();

  return {
    logs: logsQuery.data || [],
    isLoading: logsQuery.isLoading,
  };
};
