import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { configuracoesKeys } from '../../configuracoes/queries/configuracoesKeys';
import { faturamentoKeys } from '../../faturamento/queries/faturamentoKeys';
import { financeiroKeys } from '../queries/financeiroKeys';

export const useFinanceiroRealtime = (enabled = true) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const invalidateFinanceiro = () => {
      queryClient.invalidateQueries({ queryKey: financeiroKeys.all });
      queryClient.invalidateQueries({ queryKey: configuracoesKeys.contasBancarias() });
      queryClient.invalidateQueries({ queryKey: configuracoesKeys.contasBancariasResumo() });
      queryClient.invalidateQueries({ queryKey: faturamentoKeys.all });
    };

    // O cliente Realtime reutiliza canais com o mesmo tópico. Como Financeiro e
    // Faturamento podem permanecer montados ao mesmo tempo (e o StrictMode
    // remonta effects em desenvolvimento), cada assinatura precisa de um tópico
    // próprio para não tentar adicionar callbacks em um canal já inscrito.
    const channel = supabase
      .channel(`financeiro-realtime-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro_configuracoes' }, invalidateFinanceiro)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro_cobrancas' }, invalidateFinanceiro)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro_cobrancas_integracoes' }, invalidateFinanceiro)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro_lancamentos' }, invalidateFinanceiro)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes_contas_bancarias' }, invalidateFinanceiro)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
};
