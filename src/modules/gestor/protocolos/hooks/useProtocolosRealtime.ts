import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { protocolosKeys } from '../queries/protocolosQueries';

export const useProtocolosRealtime = (enabled = true) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: protocolosKeys.all });
    };

    const channel = supabase
      .channel('protocolos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'protocolos_entregas' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, invalidate)
      .subscribe();

    const onLocalProtocolosChange = () => invalidate();
    window.addEventListener('protocolos:changed', onLocalProtocolosChange);
    window.addEventListener('storage', onLocalProtocolosChange);

    return () => {
      window.removeEventListener('protocolos:changed', onLocalProtocolosChange);
      window.removeEventListener('storage', onLocalProtocolosChange);
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
};
