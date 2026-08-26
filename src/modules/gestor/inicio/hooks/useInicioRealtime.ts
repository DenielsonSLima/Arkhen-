import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { subscribeRealtimeChannel } from '../../../../lib/realtimeChannel';
import { inicioKeys } from '../queries/inicioKeys';
import { atividadesKeys } from '../../atividades/hooks/useAtividadesWorkspace';
import { agendaKeys } from '../../agenda/hooks/useAgenda';
import { configuracoesKeys } from '../../configuracoes/queries/configuracoesKeys';

type InvalidationTarget =
  | 'dashboard'
  | 'deadlines'
  | 'workspace'
  | 'models'
  | 'agenda-events'
  | 'agenda-patterns'
  | 'clients'
  | 'setup'
  | 'company'
  | 'watermark'
  | 'users';

export const useInicioRealtime = (enabled = true) => {
  const queryClient = useQueryClient();
  const refreshTimerRef = useRef<number | null>(null);
  const pendingInvalidationsRef = useRef(new Set<InvalidationTarget>());

  useEffect(() => {
    if (!enabled) return undefined;

    const scheduleInvalidation = (...targets: InvalidationTarget[]) => {
      targets.forEach((target) => pendingInvalidationsRef.current.add(target));
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        const pending = pendingInvalidationsRef.current;
        pendingInvalidationsRef.current = new Set();

        if (pending.has('dashboard')) {
          void queryClient.invalidateQueries({ queryKey: inicioKeys.dashboard() });
        }
        if (pending.has('deadlines')) {
          void queryClient.invalidateQueries({ queryKey: inicioKeys.vencimentos() });
        }
        if (pending.has('workspace') || pending.has('users')) {
          void queryClient.invalidateQueries({ queryKey: atividadesKeys.workspace() });
        }
        if (pending.has('models')) {
          void queryClient.invalidateQueries({ queryKey: atividadesKeys.modelos() });
        }
        if (pending.has('users')) {
          void queryClient.invalidateQueries({ queryKey: atividadesKeys.permissoes() });
          void queryClient.invalidateQueries({ queryKey: configuracoesKeys.usuarios() });
          void queryClient.invalidateQueries({ queryKey: agendaKeys.responsaveis() });
          void queryClient.invalidateQueries({ queryKey: agendaKeys.usuarioAtual() });
        }
        if (pending.has('agenda-events')) {
          void queryClient.invalidateQueries({ queryKey: [...agendaKeys.all, 'eventos'] });
        }
        if (pending.has('agenda-patterns')) {
          void queryClient.invalidateQueries({ queryKey: agendaKeys.padroes() });
        }
        if (pending.has('clients')) {
          void queryClient.invalidateQueries({ queryKey: agendaKeys.empresas() });
        }
        if (pending.has('setup')) {
          void queryClient.invalidateQueries({ queryKey: inicioKeys.setup() });
        }
        if (pending.has('company')) {
          void queryClient.invalidateQueries({ queryKey: configuracoesKeys.empresa() });
        }
        if (pending.has('watermark')) {
          void queryClient.invalidateQueries({ queryKey: configuracoesKeys.marcaDagua() });
        }
      }, 200);
    };

    const channel = subscribeRealtimeChannel('inicio-realtime', (ch) =>
      ch
        .on('postgres_changes', { event: '*', schema: 'public', table: 'atividades_rotinas' }, () => scheduleInvalidation('dashboard', 'deadlines', 'workspace'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'atividades_tarefas' }, () => scheduleInvalidation('dashboard', 'deadlines', 'workspace'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'atividades_modelos' }, () => scheduleInvalidation('models'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_eventos' }, () => scheduleInvalidation('agenda-events'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_padroes_eventos' }, () => scheduleInvalidation('agenda-patterns'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => scheduleInvalidation('dashboard', 'clients', 'setup'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'documentos' }, () => scheduleInvalidation('dashboard'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes_empresa' }, () => scheduleInvalidation('setup', 'company'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes_marca_dagua' }, () => scheduleInvalidation('setup', 'watermark'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes_usuarios' }, () => scheduleInvalidation('dashboard', 'users'))
    );

    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      pendingInvalidationsRef.current.clear();
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [enabled, queryClient]);
};
