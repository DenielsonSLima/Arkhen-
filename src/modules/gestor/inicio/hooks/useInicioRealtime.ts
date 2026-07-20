import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { subscribeRealtimeChannel } from '../../../../lib/realtimeChannel';
import { inicioKeys } from '../queries/inicioKeys';
import { atividadesKeys } from '../../atividades/hooks/useAtividadesWorkspace';
import { agendaKeys } from '../../agenda/hooks/useAgenda';
import { configuracoesKeys } from '../../configuracoes/queries/configuracoesKeys';

export const useInicioRealtime = (enabled = true) => {
  const queryClient = useQueryClient();
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;

    const invalidate = () => {
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        void queryClient.invalidateQueries({ queryKey: inicioKeys.all });
        void queryClient.invalidateQueries({ queryKey: atividadesKeys.all });
        void queryClient.invalidateQueries({ queryKey: agendaKeys.all });
        void queryClient.invalidateQueries({ queryKey: configuracoesKeys.all });
      }, 200);
    };

    const channel = subscribeRealtimeChannel('inicio-realtime', (ch) =>
      ch
        .on('postgres_changes', { event: '*', schema: 'public', table: 'atividades_rotinas' }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'atividades_tarefas' }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_eventos' }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes_empresa' }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes_marca_dagua' }, invalidate)
    );

    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [enabled, queryClient]);
};
