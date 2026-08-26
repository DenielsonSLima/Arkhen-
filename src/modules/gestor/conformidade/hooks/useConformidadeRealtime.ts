import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { subscribeRealtimeChannel } from '../../../../lib/realtimeChannel';
import { conformidadeKeys } from '../queries/conformidadeQueries';

export const useConformidadeRealtime = (enabled = true) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: conformidadeKeys.all });
    };

    const channel = subscribeRealtimeChannel('conformidade-realtime', (ch) =>
      ch
        .on('postgres_changes', { event: '*', schema: 'public', table: 'atividades_tarefas' }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'atividades_fechamentos' }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'documentos_solicitacoes' }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, invalidate)
    );

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [enabled, queryClient]);
};
