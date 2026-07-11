import { useQuery } from '@tanstack/react-query';
import { fetchPublicShare, getShareIdFromPath } from '../publicSharedDocumentHelpers';

export const publicSharedDocumentKeys = {
  all: ['public-shared-document'] as const,
  detail: (shareId: string | null, passwordHash?: string | null) => (
    [...publicSharedDocumentKeys.all, shareId || 'legacy', passwordHash || 'locked'] as const
  ),
};

const millisecondsUntilExpiry = (isoDate?: string | null) => {
  if (!isoDate) return null;
  const expiry = new Date(isoDate).getTime();
  if (Number.isNaN(expiry)) return 0;
  return expiry - Date.now();
};

export const usePublicSharedDocumentQuery = (passwordHash?: string | null) => {
  const shareId = getShareIdFromPath();

  return useQuery({
    queryKey: publicSharedDocumentKeys.detail(shareId, passwordHash),
    queryFn: () => fetchPublicShare(passwordHash || undefined),
    refetchInterval: (query) => {
      const remaining = millisecondsUntilExpiry(query.state.data?.dataExpiracaoIso);
      if (remaining === null) return 30_000;
      if (remaining <= 0) return false;
      return Math.max(1_000, Math.min(remaining + 250, 30_000));
    },
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
    gcTime: 60_000,
  });
};
