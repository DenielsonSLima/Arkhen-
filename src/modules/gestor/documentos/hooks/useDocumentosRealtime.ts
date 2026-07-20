import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { subscribeRealtimeChannel } from '../../../../lib/realtimeChannel';
import { invalidateDocumentosQueries } from '../queries/useDocumentosQueries';
import type { DocumentScope } from '../services/documentosService';

type RealtimeStatus = 'idle' | 'subscribing' | 'subscribed' | 'error' | 'closed';
type DocumentosRealtimeRow = {
  scope?: DocumentScope | null;
  cliente_id?: string | null;
};
type DocumentoPreferencesRow = {
  modulo?: string | null;
};

const getDocumentosRealtimeRow = (payload: { new?: unknown; old?: unknown }): DocumentosRealtimeRow => {
  const row = (payload.new || payload.old || {}) as DocumentosRealtimeRow;
  return row;
};

const getDocumentosPreferencesRow = (payload: { new?: unknown; old?: unknown }): DocumentoPreferencesRow => {
  return (payload.new || payload.old || {}) as DocumentoPreferencesRow;
};

export const useDocumentosRealtime = (enabled = true) => {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>(enabled ? 'subscribing' : 'idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      setError(null);
      return undefined;
    }

    setStatus('subscribing');
    setError(null);

    const channel = subscribeRealtimeChannel(
      'documentos-realtime',
      (ch) =>
        ch
          .on('postgres_changes', { event: '*', schema: 'public', table: 'documentos' }, (payload) => {
            const row = getDocumentosRealtimeRow(payload);
            invalidateDocumentosQueries(queryClient, {
              scope: row.scope || undefined,
              companyId: row.cliente_id || undefined,
            });
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => {
            invalidateDocumentosQueries(queryClient, { includeCompanies: true });
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'preferencias_usuario_modulos' }, (payload) => {
            const row = getDocumentosPreferencesRow(payload);
            if (row?.modulo === 'documentos') {
              invalidateDocumentosQueries(queryClient, { includeSettings: true });
            }
          }),
      (nextStatus, nextError) => {
        if (nextStatus === 'SUBSCRIBED') {
          setStatus('subscribed');
          setError(null);
          return;
        }

        if (nextStatus === 'CHANNEL_ERROR' || nextStatus === 'TIMED_OUT') {
          setStatus('error');
          setError(nextError?.message || 'Falha ao assinar atualizações em tempo real de documentos.');
          return;
        }

        if (nextStatus === 'CLOSED') {
          setStatus('closed');
        }
      }
    );

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [enabled, queryClient]);

  return {
    status,
    error,
    isConnected: status === 'subscribed',
  };
};
