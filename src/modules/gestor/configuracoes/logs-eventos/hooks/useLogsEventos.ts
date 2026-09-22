import { useCallback, useEffect, useRef } from 'react';
import { useLogsEventosQuery } from '../queries/useLogsEventosQueries';
import type { LogFilters } from '../services/logsEventosService';

export const useLogsEventos = (filters: LogFilters) => {
  const query = useLogsEventosQuery(filters);
  const { hasNextPage, isFetching, isFetchNextPageError, fetchNextPage } = query;
  const observer = useRef<IntersectionObserver | null>(null);
  useEffect(() => () => observer.current?.disconnect(), []);
  const observeLastRow = useCallback((element: HTMLTableRowElement | null) => {
    observer.current?.disconnect();
    if (!element || !hasNextPage || isFetching || isFetchNextPageError || typeof IntersectionObserver === 'undefined') return;
    observer.current = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { observer.current?.disconnect(); void fetchNextPage(); }
    });
    observer.current.observe(element);
  }, [hasNextPage, isFetching, isFetchNextPageError, fetchNextPage]);
  const logs = [...new Map(query.data?.pages.flatMap((page) => page.logs).map((log) => [log.id, log]) || []).values()];
  return { logs, isLoading: query.isLoading, error: query.error, observeLastRow,
    total: query.data?.pages[0]?.total || 0, modulos: query.data?.pages[0]?.modulos || [] };
};
