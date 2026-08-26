import { QueryClient } from '@tanstack/react-query';
import { shouldRetryQuery } from './queryErrorPolicy';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      retry: shouldRetryQuery,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
