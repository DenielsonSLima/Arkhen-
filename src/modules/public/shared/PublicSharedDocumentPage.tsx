import React, { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, ShieldCheck } from 'lucide-react';
import sharedBackground from '../../../assets/office-scene-meeting.png';
import { PublicSharedDocumentCard } from './PublicSharedDocumentCard';
import './PublicSharedDocument.css';
import {
  fetchPublicShare,
  checkPassword,
  createDocumentAccessUrl,
  formatCountdownLabel,
  getDocumentMode,
  loadPdfFirstPagePreview,
} from './publicSharedDocumentHelpers';
import type { PublicSharedDocumentPayload } from './types';
import { parseShareDurationMs } from '../../gestor/documentos/services/documentShareService';
import { usePublicSharedDownloads } from './hooks/usePublicSharedDownloads';

// Subcomponentes modulares
import { SharedDocumentHeader } from './components/SharedDocumentHeader';
import { SharedDocumentSidebar } from './components/SharedDocumentSidebar';
import { SharedDocumentUnlockForm } from './components/SharedDocumentUnlockForm';
import { SharedDocumentViewer } from './components/SharedDocumentViewer';

const buildPageTitle = (shareData: PublicSharedDocumentPayload | null) => (
  shareData ? `${shareData.documents[0]?.documento ?? 'Arquivo'} | Arquivo compartilhado` : 'Link indisponível | Arkhen'
);

export const PublicSharedDocumentPage: React.FC = () => {
  const [shareData, setShareData] = useState<PublicSharedDocumentPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [passwordError, setPasswordError] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string | null>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activePreviewError, setActivePreviewError] = useState(false);
  const [documentPdfPreviews, setDocumentPdfPreviews] = useState<Record<string, string | null>>({});
  const [documentPdfPreviewStatus, setDocumentPdfPreviewStatus] = useState<Record<string, 'loading' | 'ready' | 'error'>>({});

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

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    fetchPublicShare()
      .then((share) => {
        if (!mounted) return;
        setShareData(share);
        setIsUnlocked(Boolean(share && !share.senhaObrigatoria));
        const firstDocument = share?.documents?.[0];
        if (firstDocument) {
          setSelectedIds([firstDocument.id]);
          setActiveId(firstDocument.id);
        }
      })
      .finally(() => mounted && setIsLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!shareData) return;
    document.title = buildPageTitle(shareData);
  }, [shareData]);

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

  // Carrega links assinados para download temporário seguro
  useEffect(() => {
    if (!shareData || !isUnlocked || shareData.isLegacy) return;
    let mounted = true;
    const durationSeconds = Math.max(Math.floor(parseShareDurationMs(shareData.tempoLimite) / 1000), 60);
    const load = async () => {
      const entries = await Promise.all(
        documents.map(async (doc) => [doc.id, await createDocumentAccessUrl(doc, durationSeconds)] as const),
      );
      if (mounted) setDocumentUrls(Object.fromEntries(entries));
    };
    setDocumentUrls({});
    load();
    return () => {
      mounted = false;
    };
  }, [shareData, isUnlocked, documents]);

  // Carrega as prévias de páginas de arquivos PDF
  useEffect(() => {
    if (!shareData || !isUnlocked) return;
    let mounted = true;
    const pdfDocuments = documents.filter((doc) => getDocumentMode(doc.documento) === 'pdf');
    if (pdfDocuments.length === 0) return;

    void (async () => {
      await Promise.all(pdfDocuments.map(async (doc) => {
        if (documentPdfPreviews[doc.id] !== undefined) return;
        if (documentPdfPreviewStatus[doc.id] === 'loading' || documentPdfPreviewStatus[doc.id] === 'ready' || documentPdfPreviewStatus[doc.id] === 'error') return;

        const previewSource = shareData.isLegacy ? shareData.legacyUrl : documentUrls[doc.id];
        if (!previewSource) return;

        setDocumentPdfPreviewStatus((current) => ({
          ...current,
          [doc.id]: 'loading',
        }));

        const generated = await loadPdfFirstPagePreview(previewSource);
        if (!mounted) return;

        setDocumentPdfPreviews((current) => ({
          ...current,
          [doc.id]: generated,
        }));
        setDocumentPdfPreviewStatus((current) => ({
          ...current,
          [doc.id]: generated ? 'ready' : 'error',
        }));
      }));
    })();

    return () => {
      mounted = false;
    };
  }, [documentUrls, isUnlocked, shareData, documents, documentPdfPreviews, documentPdfPreviewStatus]);

  const remainingLabel = useMemo(() => formatCountdownLabel(remaining), [remaining]);
  const activeDocument = documents.find((doc) => doc.id === activeId) || documents[0] || null;
  const activePreviewUrl = shareData?.isLegacy ? shareData.legacyUrl : (activeDocument ? documentUrls[activeDocument.id] : null);
  const activeMode = getDocumentMode(activeDocument?.documento || '');
  const activePdfPreviewUrl = activeDocument ? documentPdfPreviews[activeDocument.id] : null;
  const activePdfPreviewStatus = activeDocument ? documentPdfPreviewStatus[activeDocument.id] : undefined;
  const hasMultipleDocuments = Boolean(shareData && documents.length > 1);
  const activeHasPdfSource = activeMode === 'pdf' && Boolean(activePreviewUrl);
  
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = shareData ? selectedIds.length === documents.length : false;
  const hasSelected = selectedIds.length > 0;
  const canDownloadSelection = hasSelected && selectedIds.every(canDownloadDocument);
  const canDownloadAll = shareData ? documents.every((doc) => canDownloadDocument(doc.id)) : false;
  const fileGridColumns = shareData ? Math.min(Math.max(documents.length, 1), 4) : 1;
  const activePdfFailedToPreview = activeMode === 'pdf' && activePdfPreviewStatus === 'error';
  const activeLoadingPdfPreview = activeMode === 'pdf' && (activePdfPreviewStatus === 'loading' || (activeHasPdfSource && activePdfPreviewStatus === undefined));
  
  const activePreviewUnavailable =
    activePreviewError ||
    activeMode === 'generic' ||
    (activeMode === 'image' && !activePreviewUrl) ||
    (activeMode === 'pdf' && !activePdfPreviewUrl && !activeLoadingPdfPreview);
    
  const activeLoadingPreview = activeLoadingPdfPreview;

  useEffect(() => {
    setActivePreviewError(false);
  }, [activeId, activePreviewUrl]);

  const openPreview = (documentId: string) => {
    setActiveId(documentId);
    setSelectedIds((current) => (current.includes(documentId) ? current : [...current, documentId]));
  };

  const toggleSelection = (documentId: string) => {
    setSelectedIds((current) => (
      current.includes(documentId) ? current.filter((id) => id !== documentId) : [...current, documentId]
    ));
  };

  const selectAll = () => {
    if (!shareData) return;
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(documents.map((doc) => doc.id));
  };

  const handleUnlock = async (password: string) => {
    if (!shareData) return;
    const result = await checkPassword(password, shareData);
    if (!result.ok || !result.share) {
      setPasswordError('Senha inválida ou compartilhamento indisponível.');
      return;
    }
    if (!result.share.documents.some((doc) => doc.storage_bucket && doc.storage_path)) {
      setPasswordError('Senha correta, mas não foi possível localizar os arquivos.');
      return;
    }
    setPasswordError('');
    setDocumentPdfPreviews({});
    setDocumentPdfPreviewStatus({});
    setShareData(result.share);
    setIsUnlocked(true);
    const firstDocument = result.share.documents?.[0];
    if (firstDocument) {
      setSelectedIds([firstDocument.id]);
      setActiveId(firstDocument.id);
    }
  };

  if (isLoading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#090b0f', color: '#94a3b8' }}>
        <div style={{ padding: '18px 20px', border: '1px solid #1e293b', borderRadius: '12px', background: '#0f172a', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Loader2 size={18} className="animate-spin" /> Carregando compartilhamento...
        </div>
      </main>
    );
  }

  if (!shareData) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#090b0f', padding: '20px' }}>
        <div style={{ maxWidth: '480px', width: '100%', background: '#ffffff', border: '1.5px solid #ef4444', borderRadius: '12px', padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 10px', color: '#dc2626', fontSize: '1.25rem', fontWeight: 850 }}>Acesso Indisponível</h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5 }}>
            Link não encontrado ou expirado. Solicite um novo compartilhamento ao responsável da empresa.
          </p>
        </div>
      </main>
    );
  }

  if (!isExpired && shareData.senhaObrigatoria && !isUnlocked) {
    return (
      <SharedDocumentUnlockForm
        onUnlock={handleUnlock}
        error={passwordError}
        empresaNome={shareData.empresa}
        empresaLogo={shareData.empresaLogo}
      />
    );
  }

  return (
    <main style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', boxSizing: 'border-box' }}>
      {/* Background premium */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${sharedBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transform: 'scale(1.04)',
          filter: 'blur(2.2px) grayscale(0.95) brightness(0.26) contrast(1.15) saturate(0.1)',
        }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 15% 10%, rgba(15, 23, 42, 0.35), rgba(2, 6, 23, 0.72) 48%, rgba(2, 6, 23, 0.94) 100%)' }} />

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', padding: '24px 16px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <SharedDocumentHeader
          empresaLogo={shareData.empresaLogo}
          empresaNome={shareData.empresa}
        />

        <section
          style={{
            maxWidth: '1440px',
            width: '100%',
            margin: '0 auto',
            background: 'linear-gradient(165deg, rgba(15, 23, 42, 0.88), rgba(2, 6, 23, 0.96))',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 30px 80px rgba(2, 6, 23, 0.65)',
            display: 'flex',
            flexDirection: 'column',
            flex: 1
          }}
        >
          {/* Card Header Informativo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', background: 'rgba(15, 23, 42, 0.6)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(197, 146, 53, 0.16)', border: '1px solid rgba(197, 146, 53, 0.4)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-gold-primary)' }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.04rem', color: '#ffffff', fontWeight: 800 }}>
                {activeDocument?.documento || 'Documento compartilhado'}
              </h1>
            </div>
            {isExpired && (
              <span style={{ marginLeft: 'auto', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#f87171', borderRadius: '999px', padding: '4px 12px', fontSize: '0.7rem', fontWeight: 800 }}>
                Expirado
              </span>
            )}
          </div>

          {/* Grid Principal */}
          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '20px', flex: 1, boxSizing: 'border-box' }} className="public-shared-grid">
            {/* Visualizador de Arquivo */}
            <SharedDocumentViewer
              activeDocument={activeDocument}
              activePreviewUrl={activePreviewUrl || null}
              activeMode={activeMode}
              activePdfPreviewUrl={activePdfPreviewUrl}
              activePdfPreviewStatus={activePdfPreviewStatus}
              activeLoadingPreview={activeLoadingPreview}
              activePdfFailedToPreview={activePdfFailedToPreview}
              activePreviewUnavailable={activePreviewUnavailable}
              activePreviewError={activePreviewError}
              onPreviewError={() => setActivePreviewError(true)}
            />

            {/* Painel Lateral */}
            <SharedDocumentSidebar
              shareData={shareData}
              remainingLabel={remainingLabel}
              isExpired={isExpired}
            />
          </div>

          {/* Área de Documentos e Downloads */}
          <div style={{ padding: '0 20px 20px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(2, 6, 23, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', padding: '16px 0', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.94rem', color: '#ffffff', fontWeight: 800 }}>Documentos no Link</h3>
                <p style={{ margin: '3px 0 0', color: '#94a3b8', fontSize: '0.74rem' }}>
                  {documents.length} arquivo(s) disponível(is) · {selectedIds.length} selecionado(s)
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {hasMultipleDocuments && (
                  <button
                    type="button"
                    onClick={selectAll}
                    style={{ border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#ffffff', borderRadius: '8px', padding: '8px 14px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                  </button>
                )}
                
                <button
                  type="button"
                  onClick={handleDownloadSelected}
                  disabled={isExpired || !hasSelected || !canDownloadSelection || isBatchDownloading}
                  style={{ border: 'none', borderRadius: '8px', padding: '8px 16px', background: (isExpired || !hasSelected || !canDownloadSelection || isBatchDownloading) ? '#1e293b' : 'var(--color-gold-gradient)', color: (isExpired || !hasSelected || !canDownloadSelection || isBatchDownloading) ? '#64748b' : '#ffffff', fontWeight: 700, fontSize: '0.74rem', cursor: (isExpired || !hasSelected || !canDownloadSelection || isBatchDownloading) ? 'not-allowed' : 'pointer', display: 'inline-flex', gap: '6px', alignItems: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}
                >
                  {isBatchDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {isBatchDownloading ? 'Baixando...' : `Baixar selecionado(s) ${selectedIds.length > 1 ? '(ZIP)' : ''}`}
                </button>
                
                {hasMultipleDocuments && (
                  <button
                    type="button"
                    onClick={handleDownloadAll}
                    disabled={isExpired || !canDownloadAll || isBatchDownloading}
                    style={{ border: '1px solid rgba(197, 146, 53, 0.4)', borderRadius: '8px', padding: '8px 16px', background: 'rgba(197, 146, 53, 0.1)', color: '#dfb35e', fontWeight: 700, fontSize: '0.74rem', cursor: (isExpired || !canDownloadAll || isBatchDownloading) ? 'not-allowed' : 'pointer', display: 'inline-flex', gap: '6px', alignItems: 'center' }}
                  >
                    {isBatchDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    {isBatchDownloading ? 'Baixando...' : 'Baixar todos (ZIP)'}
                  </button>
                )}
              </div>
            </div>

            {/* Listagem de Cards (caso seja lote) */}
            {hasMultipleDocuments ? (
              <div 
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${fileGridColumns}, minmax(220px, 1fr))`,
                  gap: '12px',
                  marginTop: '10px'
                }}
              >
                {documents.map((doc) => (
                  <PublicSharedDocumentCard
                    key={doc.id}
                    document={doc}
                    isSelected={doc.id === activeDocument?.id}
                    isChecked={selectedSet.has(doc.id)}
                    previewUrl={documentUrls[doc.id] || (shareData.isLegacy ? shareData.legacyUrl : undefined)}
                    previewImageUrl={getDocumentMode(doc.documento) === 'pdf' ? documentPdfPreviews[doc.id] : undefined}
                    previewStatus={getDocumentMode(doc.documento) === 'pdf' ? documentPdfPreviewStatus[doc.id] : undefined}
                    canDownload={canDownloadDocument(doc.id)}
                    onSelect={toggleSelection}
                    onPreview={openPreview}
                    onDownload={handleDownloadOne}
                  />
                ))}
              </div>
            ) : (
              <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: '0.74rem', fontStyle: 'italic' }}>
                Este link contém apenas um arquivo para download e prévia.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
};
