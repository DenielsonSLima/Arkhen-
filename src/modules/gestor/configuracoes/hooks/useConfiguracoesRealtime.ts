import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { configuracoesKeys } from '../queries/configuracoesKeys';

export const useConfiguracoesRealtime = (enabled: boolean) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('configuracoes-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'configuracoes_empresa' },
        () => {
          queryClient.invalidateQueries({ queryKey: configuracoesKeys.empresa() });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'configuracoes_marca_dagua' },
        () => {
          queryClient.invalidateQueries({ queryKey: configuracoesKeys.marcaDagua() });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'configuracoes_perfis_acesso' },
        () => {
          queryClient.invalidateQueries({ queryKey: configuracoesKeys.perfisAcesso() });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'configuracoes_usuarios' },
        () => {
          queryClient.invalidateQueries({ queryKey: configuracoesKeys.usuarios() });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'configuracoes_xml_modelos' },
        () => {
          queryClient.invalidateQueries({ queryKey: configuracoesKeys.xmlModelos() });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
};
