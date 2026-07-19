import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { createRealtimeChannelName } from '../../../../lib/realtimeChannel';
import { agendaKeys } from './useAgenda';

export const useAgendaRealtime = (enabled = true) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(createRealtimeChannelName('agenda-realtime'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_eventos' }, () => {
        queryClient.invalidateQueries({ queryKey: agendaKeys.all });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_tipos_evento' }, () => {
        queryClient.invalidateQueries({ queryKey: agendaKeys.all });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_categorias_evento' }, () => {
        queryClient.invalidateQueries({ queryKey: agendaKeys.all });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_responsaveis' }, () => {
        queryClient.invalidateQueries({ queryKey: agendaKeys.all });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_padroes_eventos' }, () => {
        queryClient.invalidateQueries({ queryKey: agendaKeys.all });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atividades_tarefas' }, () => {
        queryClient.invalidateQueries({ queryKey: agendaKeys.all });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
};
