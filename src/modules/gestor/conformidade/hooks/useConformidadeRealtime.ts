import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { conformidadeKeys } from '../queries/conformidadeQueries';

export const useConformidadeRealtime = (enabled = true) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: conformidadeKeys.all });
    };

    const channel = supabase
      .channel('conformidade-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atividades_instancias' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atividades_tarefas' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atividades_fechamentos' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conformidade_obrigacoes' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'protocolos_entregas' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, invalidate)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
};
