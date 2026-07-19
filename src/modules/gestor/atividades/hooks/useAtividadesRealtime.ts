import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { createRealtimeChannelName } from '../../../../lib/realtimeChannel';
import { atividadesKeys } from './useAtividadesWorkspace';

export const useAtividadesRealtime = (enabled = true, onChange?: () => void) => {
  const queryClient = useQueryClient();
  const onChangeRef = useRef(onChange);
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled) return;

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: atividadesKeys.all });
      if (!onChangeRef.current) return;
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        onChangeRef.current?.();
      }, 180);
    };

    const channel = supabase
      .channel(createRealtimeChannelName('atividades-realtime'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atividades_modelos' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atividades_rotinas' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atividades_tarefas' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atividades_instancias' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atividades_fechamentos' }, invalidate)
      .subscribe();

    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
};
