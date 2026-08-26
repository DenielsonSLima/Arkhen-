import { useCallback, useEffect, useState } from 'react';
import {
  documentShareService,
  type SharedDocumentLink,
} from '../services/documentShareService';

interface UseSharedDocumentLinksOptions {
  refreshKey: number;
  onNotify?: (message: string) => void;
}

export interface RenewSharedDocumentInput {
  tempoLimite: string;
  exigirSenha: boolean;
  senha?: string;
}

const getErrorMessage = (error: unknown, fallback: string) => (
  error instanceof Error && error.message ? error.message : fallback
);

const removePendingId = (current: Set<string>, id: string) => {
  const next = new Set(current);
  next.delete(id);
  return next;
};

export const useSharedDocumentLinks = ({
  refreshKey,
  onNotify,
}: UseSharedDocumentLinksOptions) => {
  const [links, setLinks] = useState<SharedDocumentLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [revokingGroupIds, setRevokingGroupIds] = useState<Set<string>>(new Set());
  const [renewingGroupIds, setRenewingGroupIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setErrorMessage('');
    documentShareService.list()
      .then((nextLinks) => {
        if (mounted) setLinks(nextLinks);
      })
      .catch((error) => {
        if (mounted) {
          setErrorMessage(getErrorMessage(
            error,
            'Não foi possível carregar os compartilhamentos. Tente novamente.',
          ));
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [refreshKey, reloadKey]);

  const retry = useCallback(() => setReloadKey((current) => current + 1), []);

  const revoke = useCallback(async (groupId: string) => {
    setRevokingGroupIds((current) => new Set(current).add(groupId));
    setErrorMessage('');
    try {
      await documentShareService.revoke(groupId);
      setLinks((current) => current.map((link) => (
        link.id === groupId || link.shareGroupId === groupId
          ? { ...link, status: 'Expirado' }
          : link
      )));
      onNotify?.('Link revogado. Downloads já autorizados podem permanecer válidos por até 5 minutos.');

      try {
        setLinks(await documentShareService.list());
      } catch (error) {
        setErrorMessage(getErrorMessage(
          error,
          'O link foi revogado, mas não foi possível atualizar a lista. Tente novamente.',
        ));
      }
      return true;
    } catch (error) {
      const message = getErrorMessage(
        error,
        'Não foi possível revogar o compartilhamento. O link continua ativo.',
      );
      setErrorMessage(message);
      onNotify?.(message);
      return false;
    } finally {
      setRevokingGroupIds((current) => removePendingId(current, groupId));
    }
  }, [onNotify]);

  const renew = useCallback(async (
    groupId: string,
    input: RenewSharedDocumentInput,
  ) => {
    setRenewingGroupIds((current) => new Set(current).add(groupId));
    setErrorMessage('');
    try {
      await documentShareService.renew(groupId, input);
      onNotify?.('Link de compartilhamento renovado.');

      try {
        setLinks(await documentShareService.list());
      } catch (error) {
        setErrorMessage(getErrorMessage(
          error,
          'O link foi renovado, mas não foi possível atualizar a lista. Tente novamente.',
        ));
      }
      return true;
    } catch (error) {
      const message = getErrorMessage(
        error,
        'Não foi possível renovar o compartilhamento. O link não foi alterado.',
      );
      setErrorMessage(message);
      onNotify?.(message);
      return false;
    } finally {
      setRenewingGroupIds((current) => removePendingId(current, groupId));
    }
  }, [onNotify]);

  return {
    links,
    isLoading,
    errorMessage,
    revokingGroupIds,
    renewingGroupIds,
    retry,
    revoke,
    renew,
  };
};
