import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { getShareIdFromPath } from '../publicSharedDocumentHelpers';
import { publicSharedDocumentKeys } from '../queries/usePublicSharedDocumentQuery';

export const usePublicSharedRealtime = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const shareId = getShareIdFromPath();
    if (!shareId) return undefined;

    const invalidateShare = () => {
      void queryClient.invalidateQueries({ queryKey: publicSharedDocumentKeys.all });
    };

    const channel = supabase
      .channel(`public-share-${shareId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documentos_compartilhamentos',
          filter: `share_group_id=eq.${shareId}`,
        },
        invalidateShare,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documentos_compartilhamentos',
          filter: `id=eq.${shareId}`,
        },
        invalidateShare,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
};
