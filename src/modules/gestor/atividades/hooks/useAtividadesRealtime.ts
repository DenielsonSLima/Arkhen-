import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { atividadesKeys } from './useAtividadesWorkspace';

export const useAtividadesRealtime = (enabled = true, onChange?: () => void) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: atividadesKeys.all });
      onChange?.();
    };

    const channel = supabase
      .channel('atividades-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atividades_modelos' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atividades_rotinas' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atividades_tarefas' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atividades_instancias' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atividades_fechamentos' }, invalidate)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, onChange, queryClient]);
};
