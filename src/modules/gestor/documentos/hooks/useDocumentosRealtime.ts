import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { invalidateDocumentosQueries } from '../queries/useDocumentosQueries';

export const useDocumentosRealtime = (enabled = true) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return undefined;

    const channel = supabase
      .channel('documentos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documentos' }, () => {
        invalidateDocumentosQueries(queryClient);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
};
