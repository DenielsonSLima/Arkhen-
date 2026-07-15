import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
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
    const channelId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let channel = supabase.channel(`reforma-tributaria-realtime-${channelId}`);
    TABLES.forEach((table) => {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        queryClient.invalidateQueries({ queryKey: reformaTributariaKeys.all });
      });
    });
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [queryClient]);
};
