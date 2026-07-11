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

    const channel = supabase
      .channel('financeiro-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro_configuracoes' }, invalidateFinanceiro)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro_cobrancas' }, invalidateFinanceiro)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro_lancamentos' }, invalidateFinanceiro)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes_contas_bancarias' }, invalidateFinanceiro)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
};
