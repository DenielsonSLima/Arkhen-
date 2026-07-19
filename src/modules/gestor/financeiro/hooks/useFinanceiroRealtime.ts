import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { createRealtimeChannelName } from '../../../../lib/realtimeChannel';
import { configuracoesKeys } from '../../configuracoes/queries/configuracoesKeys';
import { faturamentoKeys } from '../../faturamento/queries/faturamentoKeys';
import { financeiroKeys } from '../queries/financeiroKeys';

export const useFinanceiroRealtime = (enabled = true) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    type InvalidationScope = 'contratos' | 'cobrancas' | 'lancamentos' | 'dashboard' | 'contas' | 'faturamento';
    const pendingScopes = new Set<InvalidationScope>();
    let invalidationTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const flushInvalidations = () => {
      invalidationTimer = null;
      if (disposed) return;

      if (pendingScopes.has('contratos')) {
        void queryClient.invalidateQueries({ queryKey: financeiroKeys.contratos() });
      }
      if (pendingScopes.has('cobrancas')) {
        void queryClient.invalidateQueries({ queryKey: financeiroKeys.cobrancas() });
      }
      if (pendingScopes.has('lancamentos')) {
        void queryClient.invalidateQueries({ queryKey: financeiroKeys.lancamentos() });
      }
      if (pendingScopes.has('dashboard')) {
        void queryClient.invalidateQueries({ queryKey: [...financeiroKeys.all, 'dashboard'] });
      }
      if (pendingScopes.has('contas')) {
        void queryClient.invalidateQueries({ queryKey: configuracoesKeys.contasBancarias() });
        void queryClient.invalidateQueries({ queryKey: configuracoesKeys.contasBancariasResumo() });
      }
      if (pendingScopes.has('faturamento')) {
        void queryClient.invalidateQueries({ queryKey: faturamentoKeys.all });
      }
      pendingScopes.clear();
    };

    // Uma baixa/transferência pode emitir vários eventos na mesma transação.
    // Agrupar o burst evita uma cascata de refetches entre Financeiro e Faturamento.
    const scheduleInvalidation = (...scopes: InvalidationScope[]) => {
      if (disposed) return;
      scopes.forEach((scope) => pendingScopes.add(scope));
      if (invalidationTimer) return;
      invalidationTimer = setTimeout(flushInvalidations, 100);
    };

    // O cliente Realtime reutiliza canais com o mesmo tópico. Como Financeiro e
    // Faturamento podem permanecer montados ao mesmo tempo (e o StrictMode
    // remonta effects em desenvolvimento), cada assinatura precisa de um tópico
    // próprio para não tentar adicionar callbacks em um canal já inscrito.
    const channel = supabase
      .channel(createRealtimeChannelName('financeiro-realtime'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro_configuracoes' }, () => {
        scheduleInvalidation('contratos', 'faturamento');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro_cobrancas' }, () => {
        scheduleInvalidation('cobrancas', 'dashboard', 'faturamento');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro_cobrancas_integracoes' }, () => {
        scheduleInvalidation('cobrancas', 'faturamento');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro_lancamentos' }, () => {
        scheduleInvalidation('lancamentos', 'dashboard', 'contas', 'faturamento');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes_contas_bancarias' }, () => {
        scheduleInvalidation('dashboard', 'contas');
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`[Financeiro Realtime] Assinatura indisponível: ${status}`);
        }
      });

    return () => {
      disposed = true;
      if (invalidationTimer) clearTimeout(invalidationTimer);
      pendingScopes.clear();
      void supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
};
