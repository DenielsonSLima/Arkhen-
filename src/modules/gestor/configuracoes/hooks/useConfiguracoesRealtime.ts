import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { configuracoesKeys } from '../queries/configuracoesKeys';

export const useConfiguracoesRealtime = (enabled: boolean) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const channelId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(`configuracoes-realtime-${channelId}`)
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'configuracoes_contas_bancarias' },
        () => {
          queryClient.invalidateQueries({ queryKey: configuracoesKeys.contasBancarias() });
          queryClient.invalidateQueries({ queryKey: configuracoesKeys.contasBancariasResumo() });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'configuracoes_contadores' },
        () => {
          queryClient.invalidateQueries({ queryKey: configuracoesKeys.contadores() });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'configuracoes_eventos_logs' },
        () => {
          queryClient.invalidateQueries({ queryKey: configuracoesKeys.logsEventos() });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'configuracoes_modulos_sistema' },
        () => {
          queryClient.invalidateQueries({ queryKey: configuracoesKeys.modulosSistema() });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'configuracoes_integracao_bancaria' },
        () => {
          queryClient.invalidateQueries({ queryKey: configuracoesKeys.integracaoBancaria() });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
};
