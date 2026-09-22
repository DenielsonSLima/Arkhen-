import React, { useEffect, useMemo, useState } from 'react';
import { checkPassword, createDocumentAccessUrl, formatCountdownLabel } from '../publicSharedDocumentHelpers';
import type { PublicSharedDocumentPayload } from '../types';
import { usePublicSharedDownloads } from './usePublicSharedDownloads';
import { usePublicSharedRealtime } from './usePublicSharedRealtime';
import { usePublicSharedDocumentQuery } from '../queries/usePublicSharedDocumentQuery';
const buildPageTitle = (shareData: PublicSharedDocumentPayload | null) => (
  shareData ? `${shareData.documents[0]?.documento ?? 'Arquivo'} | Arquivo compartilhado` : 'Link indisponível | Arkhen'
);

const formatBytes = (bytes?: number | null) => {
  if (bytes === undefined || bytes === null || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const usePublicSharedPage = () => {
  const [shareData, setShareData] = useState<PublicSharedDocumentPayload | null>(null);
  const [passwordError, setPasswordError] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordHash, setPasswordHash] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string | null>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const expiredRefetchDoneRef = React.useRef(false);
  const publicShareQuery = usePublicSharedDocumentQuery(passwordHash);
  const refetchShare = publicShareQuery.refetch;
  usePublicSharedRealtime();

  const documents = useMemo(() => {
    const normalized = shareData?.documents || [];
    const seen = new Set<string>();
    return normalized.filter((doc) => {
      if (seen.has(doc.id)) return false;
      seen.add(doc.id);
      return true;
    });
  }, [shareData?.documents]);

  const canDownloadDocument = (documentId: string) => (
    !isExpired && (shareData?.isLegacy ? Boolean(shareData?.legacyUrl) : Boolean(documentUrls[documentId]))
  );

  const isExpired = remaining !== null && remaining <= 0;

  const {
    isBatchDownloading,
    handleDownloadOne,
    handleDownloadSelected,
    handleDownloadAll,
  } = usePublicSharedDownloads({
    shareData,
    documents,
    documentUrls,
    selectedIds,
    isExpired,
    canDownloadDocument,
  });

  const sanitizeShare = (share: PublicSharedDocumentPayload | null): PublicSharedDocumentPayload | null => {
    if (!share) return null;
    return {
      ...share,
      empresa: share.empresa === 'Biblioteca pessoal' ? 'Empresa Fictícia Contábil' : share.empresa,
      empresaCnpj: share.empresa === 'Biblioteca pessoal' ? '12.345.678/0001-90' : share.empresaCnpj,
    };
  };

  useEffect(() => {
    if (publicShareQuery.isLoading) return;
    const cleanShare = sanitizeShare(publicShareQuery.data || null);
    setShareData(cleanShare);
    setIsUnlocked(Boolean(cleanShare && (!cleanShare.senhaObrigatoria || passwordHash)));

    if (!cleanShare) {
      setDocumentUrls({});
      setSelectedIds([]);
      setActiveId(null);
      return;
    }

    const validIds = new Set(cleanShare.documents.map((doc) => doc.id));
    const firstDocumentId = cleanShare.documents[0]?.id || null;
    setSelectedIds((current) => {
      const next = current.filter((id) => validIds.has(id));
      return next.length > 0 ? next : (firstDocumentId ? [firstDocumentId] : []);
    });
    setActiveId((current) => (current && validIds.has(current) ? current : firstDocumentId));
  }, [passwordHash, publicShareQuery.data, publicShareQuery.isLoading]);

  const isLoading = publicShareQuery.isLoading && !shareData;

  useEffect(() => {
    if (!shareData) return;
    if (shareData.senhaObrigatoria && !isUnlocked) {
      document.title = 'Arquivo Protegido | Arkhen';
    } else {
      document.title = buildPageTitle(shareData);
    }
  }, [shareData, isUnlocked]);

  // Resetar erro ao mudar de arquivo
  useEffect(() => {
    setPreviewError(false);
  }, [activeId]);

  // Contador regressivo do tempo restante
  useEffect(() => {
    if (!shareData?.dataExpiracaoIso) {
      setRemaining(null);
      return;
    }
    const expiry = new Date(shareData.dataExpiracaoIso).getTime();
    if (Number.isNaN(expiry)) {
      setRemaining(0);
      return;
    }
    const tick = () => setRemaining(Math.max(0, expiry - Date.now()));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [shareData?.dataExpiracaoIso]);

  useEffect(() => {
    if (!isExpired) {
      expiredRefetchDoneRef.current = false;
      return;
    }
    if (expiredRefetchDoneRef.current) return;
    expiredRefetchDoneRef.current = true;
    setDocumentUrls({});
    setPreviewError(false);
    void refetchShare();
  }, [isExpired, refetchShare]);

  // Carrega links assinados para download temporário seguro
  useEffect(() => {
    if (!shareData || !isUnlocked || shareData.isLegacy || isExpired) {
      setDocumentUrls({});
      return;
    }
    let mounted = true;
    const expiry = new Date(shareData.dataExpiracaoIso).getTime();
    const durationSeconds = Math.floor((expiry - Date.now()) / 1000);

    if (Number.isNaN(expiry) || durationSeconds <= 0) {
      setDocumentUrls({});
      return;
    }

    const load = async () => {
      const entries = await Promise.all(
        documents.map(async (doc) => [doc.id, await createDocumentAccessUrl(doc, shareData.shareGroupId, passwordHash).catch(() => null)] as const),
      );
      if (mounted) setDocumentUrls(Object.fromEntries(entries));
    };
    setDocumentUrls({});
    void load();
    const refresh = window.setInterval(() => { void load(); }, 240_000);
    return () => {
      mounted = false;
      window.clearInterval(refresh);
    };
  }, [shareData, isUnlocked, isExpired, documents, passwordHash]);

  const remainingLabel = useMemo(() => formatCountdownLabel(remaining), [remaining]);
  const activeDocument = documents.find((doc) => doc.id === activeId) || documents[0] || null;
  const isSingleFile = documents.length === 1;

  const totalSizeFormatted = useMemo(() => {
    const totalBytes = documents.reduce((acc, doc) => acc + (doc.tamanho_bytes || 0), 0);
    return formatBytes(totalBytes);
  }, [documents]);

  const canDownloadAll = shareData ? documents.every((doc) => canDownloadDocument(doc.id)) : false;

  const toggleSelection = (documentId: string) => {
    setSelectedIds((current) => (
      current.includes(documentId) ? current.filter((id) => id !== documentId) : [...current, documentId]
    ));
  };

  const handleUnlock = async (password: string) => {
    if (!shareData) return;
    const result = await checkPassword(password, shareData);
    if (!result.ok || !result.share) {
      setPasswordError('Senha inválida ou compartilhamento indisponível.');
      return;
    }
    const cleanShare = sanitizeShare(result.share);
    setPasswordError('');
    setPasswordHash(result.passwordHash || null);
    setShareData(cleanShare);
    setIsUnlocked(true);
    const firstDocument = cleanShare?.documents?.[0];
    if (firstDocument) {
      setSelectedIds([firstDocument.id]);
      setActiveId(firstDocument.id);
    }
  };

  return { isLoading, shareData, isExpired, isUnlocked, handleUnlock, passwordError, isSingleFile, activeDocument, documents, totalSizeFormatted, selectedIds, toggleSelection, activeId, setActiveId, setSelectedIds, documentUrls, setPreviewError, previewError, remainingLabel, isBatchDownloading, handleDownloadOne, handleDownloadSelected, handleDownloadAll, canDownloadDocument, canDownloadAll };
};
