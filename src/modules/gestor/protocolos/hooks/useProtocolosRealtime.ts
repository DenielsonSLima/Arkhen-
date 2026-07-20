import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { subscribeRealtimeChannel } from '../../../../lib/realtimeChannel';
import { protocolosKeys } from '../queries/protocolosQueries';

export const useProtocolosRealtime = (enabled = true) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: protocolosKeys.all });
    };

    const channel = subscribeRealtimeChannel('protocolos-realtime', (ch) =>
      ch
        .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes_protocolos_empresas' }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'protocolos_entregas' }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, invalidate)
    );

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [enabled, queryClient]);
};
