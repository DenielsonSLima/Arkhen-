import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { subscribeRealtimeChannel } from '../../../../lib/realtimeChannel';
import { faturamentoKeys } from '../queries/faturamentoKeys';

const financeiroCobrancasKey = ['financeiro', 'cobrancas'] as const;

export const useFaturamentoRealtime = (enabled = true) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const invalidateFaturamento = () => {
      void queryClient.invalidateQueries({ queryKey: faturamentoKeys.all });
    };
    const invalidateCobrancas = () => {
      void queryClient.invalidateQueries({ queryKey: faturamentoKeys.all });
      void queryClient.invalidateQueries({ queryKey: financeiroCobrancasKey });
    };

    const channel = subscribeRealtimeChannel(
      'faturamento-realtime',
      (ch) =>
        ch
          .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro_configuracoes' }, invalidateFaturamento)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro_cobrancas' }, invalidateCobrancas)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro_cobrancas_integracoes' }, invalidateCobrancas)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro_lancamentos' }, invalidateFaturamento),
      (status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`[Faturamento Realtime] Assinatura indisponível: ${status}`);
        }
      }
    );

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [enabled, queryClient]);
};
