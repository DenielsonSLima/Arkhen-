import { useState } from 'react';
import type { PublicSharedDocumentPayload, SharedDocumentForPublicView } from '../types';
import { downloadAndZipFiles } from '../publicSharedZipHelper';

interface UsePublicSharedDownloadsProps {
  shareData: PublicSharedDocumentPayload | null;
  documents: SharedDocumentForPublicView[];
  documentUrls: Record<string, string | null>;
  selectedIds: string[];
  isExpired: boolean;
  canDownloadDocument: (id: string) => boolean;
}

export const usePublicSharedDownloads = ({
  shareData,
  documents,
  documentUrls,
  selectedIds,
  isExpired,
  canDownloadDocument,
}: UsePublicSharedDownloadsProps) => {
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);

  const handleDownloadDocumentIds = async (documentIds: string[]) => {
    if (!shareData || isBatchDownloading) return;
    const enabled = documentIds.every(canDownloadDocument);
    if (!enabled || isExpired) return;

    setIsBatchDownloading(true);
    try {
      for (const id of documentIds) {
        const item = documents.find((doc) => doc.id === id);
        if (!item) continue;
        const url = shareData.isLegacy ? shareData.legacyUrl : documentUrls[item.id];
        if (!url) continue;

        try {
          const response = await fetch(url, { method: 'GET', mode: 'cors' });
          if (!response.ok) throw new Error();
          const blob = await response.blob();
          const urlSafe = window.URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = urlSafe;
          anchor.download = item.documento;
          anchor.rel = 'noopener noreferrer';
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          window.URL.revokeObjectURL(urlSafe);
        } catch {
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = item.documento;
          anchor.rel = 'noopener noreferrer';
          anchor.target = '_self';
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
        }
      }
    } finally {
      setIsBatchDownloading(false);
    }
  };

  const handleDownloadZip = async (documentIds: string[]) => {
    if (!shareData || isBatchDownloading) return;
    const enabled = documentIds.every(canDownloadDocument);
    if (!enabled || isExpired) return;

    setIsBatchDownloading(true);
    try {
      const itemsToZip = documentIds.map((id) => {
        const item = documents.find((doc) => doc.id === id);
        const url = shareData.isLegacy ? shareData.legacyUrl : documentUrls[id];
        return {
          name: item?.documento || 'documento',
          url: url || '',
        };
      }).filter((item) => item.url);

      const zipName = `${shareData.empresa.replace(/\s+/g, '_')}_documentos.zip`;
      await downloadAndZipFiles(itemsToZip, zipName);
    } catch (error) {
      console.error('Erro ao gerar compactação em ZIP, caindo no download sequencial:', error);
      await handleDownloadDocumentIds(documentIds);
    } finally {
      setIsBatchDownloading(false);
    }
  };

  const handleDownloadOne = async (documentId: string) => {
    await handleDownloadDocumentIds([documentId]);
  };

  const handleDownloadSelected = async () => {
    if (selectedIds.length === 1) {
      await handleDownloadDocumentIds(selectedIds);
    } else if (selectedIds.length > 1) {
      await handleDownloadZip(selectedIds);
    }
  };

  const handleDownloadAll = async () => {
    const ids = documents.map((doc) => doc.id);
    if (ids.length === 1) {
      await handleDownloadDocumentIds(ids);
    } else if (ids.length > 1) {
      await handleDownloadZip(ids);
    }
  };

  return {
    isBatchDownloading,
    handleDownloadOne,
    handleDownloadSelected,
    handleDownloadAll,
  };
};
