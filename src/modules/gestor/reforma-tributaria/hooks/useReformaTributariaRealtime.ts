import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { subscribeRealtimeChannel } from '../../../../lib/realtimeChannel';
import { reformaTributariaKeys } from '../queries/reformaTributariaQueries';

const TABLES = [
  'reforma_tributaria_adequacoes',
  'reforma_tributaria_validacoes_xml',
  'reforma_tributaria_simulacoes',
  'reforma_tributaria_decisoes',
] as const;

export const useReformaTributariaRealtime = () => {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = subscribeRealtimeChannel('reforma-tributaria-realtime', (ch) => {
      let builder = ch;
      TABLES.forEach((table) => {
        builder = builder.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          queryClient.invalidateQueries({ queryKey: reformaTributariaKeys.all });
        });
      });
      return builder;
    });

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [queryClient]);
};
