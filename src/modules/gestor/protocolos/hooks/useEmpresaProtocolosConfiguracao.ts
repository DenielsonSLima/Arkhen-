import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { subscribeRealtimeChannel } from '../../../../lib/realtimeChannel';
import type { Company } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { invalidateAfterMutation } from '../../shared/mutationInvalidation';
import { empresaProtocolosKeys, empresaProtocolosQueries } from '../queries/empresaProtocolosQueries';

export const useEmpresaProtocolosConfiguracao = (company: Company) => {
  const queryClient = useQueryClient();
  const configuracaoQuery = useQuery(empresaProtocolosQueries.detail(company));

  useEffect(() => {
    const channel = subscribeRealtimeChannel(`protocolos-empresa-${company.id}`, (ch) => (
      ch.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'configuracoes_protocolos_empresas',
          filter: `cliente_id=eq.${company.id}`,
        },
        () => void queryClient.invalidateQueries({ queryKey: empresaProtocolosKeys.detail(company.id) }),
      )
    ));

    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [company.id, queryClient]);

  const saveMutation = useMutation({
    mutationFn: empresaProtocolosQueries.save,
    onSuccess: async (configuracao) => {
      queryClient.setQueryData(empresaProtocolosKeys.detail(company.id), configuracao);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: empresaProtocolosKeys.detail(company.id) }),
        invalidateAfterMutation(queryClient, 'protocolos'),
      ]);
    },
  });

  return {
    ...configuracaoQuery,
    saveConfiguracao: (configs: Parameters<typeof empresaProtocolosQueries.save>[0]['configs']) => (
      saveMutation.mutateAsync({ company, configs })
    ),
    isSaving: saveMutation.isPending,
    saveError: saveMutation.error,
    resetSaveError: saveMutation.reset,
  };
};
