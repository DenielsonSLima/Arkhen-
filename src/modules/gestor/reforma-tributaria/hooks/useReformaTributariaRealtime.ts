import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { createRealtimeChannelName } from '../../../../lib/realtimeChannel';
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
    let channel = supabase.channel(createRealtimeChannelName('reforma-tributaria-realtime'));
    TABLES.forEach((table) => {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        queryClient.invalidateQueries({ queryKey: reformaTributariaKeys.all });
      });
    });
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [queryClient]);
};
