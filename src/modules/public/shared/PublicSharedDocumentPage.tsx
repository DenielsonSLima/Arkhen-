import React, { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Timer, Calendar, Building2 } from 'lucide-react';
import sharedBackground from '../../../assets/office-scene-meeting.png';
import signatureLogoImg from '../../../assets/chatgpt-login.png';
import loginLogoImg from '../../../assets/camada-o.png';
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

  const sanitizeShare = (share: PublicSharedDocumentPayload | null): PublicSharedDocumentPayload | null => {
    if (!share) return null;
    return {
      ...share,
      empresa: share.empresa === 'Biblioteca pessoal' ? 'Empresa Fictícia Contábil' : share.empresa,
      empresaCnpj: share.empresa === 'Biblioteca pessoal' ? '12.345.678/0001-90' : share.empresaCnpj,
    };
  };

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    fetchPublicShare()
      .then((share) => {
        if (!mounted) return;
        const cleanShare = sanitizeShare(share);
        setShareData(cleanShare);
        setIsUnlocked(Boolean(cleanShare && !cleanShare.senhaObrigatoria));
        const firstDocument = cleanShare?.documents?.[0];
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

  // Carrega as prévias de páginas de arquivos PDF (apenas para thumbnails se múltiplos)
  useEffect(() => {
    if (!shareData || !isUnlocked || documents.length <= 1) return;
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
  const isSingleFile = documents.length === 1;
  const activeHasPdfSource = activeMode === 'pdf' && Boolean(activePreviewUrl);
  
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = shareData ? selectedIds.length === documents.length : false;
  const hasSelected = selectedIds.length > 0;
  const canDownloadSelection = hasSelected && selectedIds.every(canDownloadDocument);
  const canDownloadAll = shareData ? documents.every((doc) => canDownloadDocument(doc.id)) : false;

  const activePdfFailedToPreview = activeMode === 'pdf' && activePdfPreviewStatus === 'error';
  const activeLoadingPdfPreview = activeMode === 'pdf' && (activePdfPreviewStatus === 'loading' || (activeHasPdfSource && activePdfPreviewStatus === undefined));
  
  const activePreviewUnavailable =
    activePreviewError ||
    activeMode === 'generic' ||
    (activeMode === 'image' && !activePreviewUrl);

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
    const cleanShare = sanitizeShare(result.share);
    setPasswordError('');
    setDocumentPdfPreviews({});
    setDocumentPdfPreviewStatus({});
    setShareData(cleanShare);
    setIsUnlocked(true);
    const firstDocument = cleanShare?.documents?.[0];
    if (firstDocument) {
      setSelectedIds([firstDocument.id]);
      setActiveId(firstDocument.id);
    }
  };

  if (isLoading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#090b0f', color: '#94a3b8' }}>
        <div style={{ padding: '18px 20px', border: '1px solid #1e293b', borderRadius: '12px', background: '#121212', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
    <main className="public-shared-container">
      {/* Background desfocado da página inteira */}
      <div className="public-shared-page-bg" style={{ backgroundImage: `url(${sharedBackground})` }} />
      <div className="public-shared-page-overlay" />

      {/* Marca Arkhen no canto esquerdo superior da tela */}
      <div className="brand-header animate-fade-in" style={{ position: 'absolute', top: '24px', left: '30px', zIndex: 10, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img src={loginLogoImg} alt="Logo Arkhen" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
        <div className="brand-title-group" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span className="brand-name" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', letterSpacing: '1px' }}>Arkhen</span>
          <span className="brand-subtitle" style={{ fontSize: '0.76rem', color: 'var(--color-gold-primary)', fontWeight: 600, letterSpacing: '0.5px' }}>Gestão Contábil</span>
        </div>
      </div>

      {/* Modal Centralizado Glassmorphism */}
      <div className="public-shared-glass-modal animate-slide-up">
        {isSingleFile ? (
          /* ================= LAYOUT DE ARQUIVO ÚNICO ================= */
          <div className="public-shared-modal-single">
            {/* Cabeçalho Horizontal Completo */}
            <div className="public-shared-single-header">
              {/* Informações da Empresa Emitente */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {shareData.empresaLogo ? (
                  <img
                    src={shareData.empresaLogo}
                    alt={shareData.empresa}
                    style={{ width: '38px', height: '38px', objectFit: 'contain', borderRadius: '6px', background: '#ffffff', padding: '1px' }}
                  />
                ) : (
                  <div style={{ width: '38px', height: '38px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dfb35e' }}>
                    <Building2 size={18} />
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, textAlign: 'left' }}>
                  <strong style={{ color: '#ffffff', fontSize: '0.88rem', fontWeight: 800 }}>{shareData.empresa}</strong>
                  {shareData.empresaCnpj && <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'monospace' }}>CNPJ: {shareData.empresaCnpj}</span>}
                </div>
              </div>

              {/* Nome do Arquivo Ativo */}
              <div style={{ flex: 1, maxWidth: '300px', display: 'flex', flexDirection: 'column', paddingLeft: '8px' }}>
                <span style={{ fontSize: '0.6rem', color: 'var(--color-gold-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Documento</span>
                <strong style={{ color: '#ffffff', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={activeDocument?.documento}>
                  {activeDocument?.documento}
                </strong>
              </div>

              {/* Informações de Expiração / Tempo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.74rem', color: '#cbd5e1' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8' }}>
                  <Calendar size={13} /> Expira em: <strong style={{ color: '#ef4444', fontWeight: 700 }}>{shareData.dataExpiracao}</strong>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ color: '#94a3b8' }}><Timer size={13} /> Restante:</span>
                  <strong style={{ color: isExpired ? '#ef4444' : 'var(--color-gold-primary)', fontFamily: 'monospace', fontSize: '0.82rem', background: 'rgba(197, 146, 53, 0.08)', border: '1px solid rgba(197, 146, 53, 0.25)', padding: '2px 8px', borderRadius: '4px' }}>
                    {remainingLabel || '...'}
                  </strong>
                </div>
              </div>

              {/* Botão de Download */}
              <button
                type="button"
                style={{ border: 'none', borderRadius: '8px', padding: '8px 14px', background: isExpired ? '#1e293b' : 'var(--color-gold-gradient)', color: '#ffffff', fontWeight: 700, fontSize: '0.74rem', cursor: isExpired ? 'not-allowed' : 'pointer', display: 'inline-flex', gap: '6px', alignItems: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}
                onClick={handleDownloadSelected}
                disabled={isExpired || isBatchDownloading}
              >
                {isBatchDownloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                Baixar Arquivo
              </button>
            </div>

            {/* Visualizador de PDF Completo */}
            <div className="public-shared-single-body">
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
            </div>
          </div>
        ) : (
          /* ================= LAYOUT MULTI-ARQUIVOS (SPLIT) ================= */
          <div className="public-shared-modal-split">
            {/* Lado Esquerdo: Visualizador de Documento */}
            <div className="public-shared-split-left">
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
            </div>

            {/* Lado Direito: Informações e Listagem de Cards */}
            <div className="public-shared-split-right">
              {/* Identificação do Emitente */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                {shareData.empresaLogo ? (
                  <img
                    src={shareData.empresaLogo}
                    alt={shareData.empresa}
                    style={{ width: '42px', height: '42px', objectFit: 'contain', borderRadius: '6px', background: '#ffffff', padding: '1px' }}
                  />
                ) : (
                  <div style={{ width: '42px', height: '42px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dfb35e' }}>
                    <Building2 size={20} />
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, textAlign: 'left' }}>
                  <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Emitente</span>
                  <strong style={{ color: '#ffffff', fontSize: '0.94rem', fontWeight: 800 }}>{shareData.empresa}</strong>
                  {shareData.empresaCnpj && <span style={{ fontSize: '0.7rem', color: 'var(--color-gold-primary)', fontFamily: 'monospace' }}>CNPJ: {shareData.empresaCnpj}</span>}
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }} className="scrollbar-premium">
                {/* Nome do Arquivo Ativo */}
                <div>
                  <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Arquivo Selecionado</span>
                  <strong style={{ color: '#ffffff', fontSize: '0.84rem', display: 'block', marginTop: '3px', lineHeight: 1.3 }}>
                    {activeDocument?.documento || 'Documento'}
                  </strong>
                </div>

                {/* Bloco de Metadados */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                    <span style={{ color: '#94a3b8' }}>Gerado em:</span>
                    <strong style={{ color: '#ffffff' }}>{shareData.dataGeracao}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                    <span style={{ color: '#94a3b8' }}>Disponível por:</span>
                    <strong style={{ color: '#ffffff' }}>{shareData.tempoLimite}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                    <span style={{ color: '#94a3b8' }}>Expira em:</span>
                    <strong style={{ color: '#ef4444', fontWeight: 700 }}>{shareData.dataExpiracao}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px', marginTop: '2px', fontSize: '0.74rem' }}>
                    <span style={{ color: '#94a3b8' }}>Tempo Restante:</span>
                    <strong style={{ color: isExpired ? '#ef4444' : 'var(--color-gold-primary)', fontFamily: 'monospace', fontSize: '0.82rem', background: 'rgba(197, 146, 53, 0.08)', border: '1px solid rgba(197, 146, 53, 0.25)', padding: '2px 8px', borderRadius: '4px' }}>
                      {remainingLabel || '...'}
                    </strong>
                  </div>
                </div>

                {/* Listagem de Cards de Arquivos */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Arquivos no Lote</span>
                    <span style={{ fontSize: '0.68rem', color: '#cbd5e1' }}>{selectedIds.length} / {documents.length}</span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '170px', overflowY: 'auto', paddingRight: '4px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '6px', background: 'rgba(9, 11, 15, 0.2)' }} className="scrollbar-premium">
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
                </div>
              </div>

              {/* Botões de Ações na base da coluna */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    style={{ flex: 1, border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '9px', background: 'rgba(255,255,255,0.05)', color: '#ffffff', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
                    onClick={selectAll}
                  >
                    {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                  </button>
                  <button
                    type="button"
                    style={{ flex: 2, border: 'none', borderRadius: '8px', padding: '9px 12px', background: (isExpired || !hasSelected || !canDownloadSelection || isBatchDownloading) ? '#1e293b' : 'var(--color-gold-gradient)', color: '#ffffff', fontWeight: 700, fontSize: '0.74rem', cursor: (isExpired || !hasSelected || !canDownloadSelection || isBatchDownloading) ? 'not-allowed' : 'pointer', display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}
                    onClick={handleDownloadSelected}
                    disabled={isExpired || !hasSelected || !canDownloadSelection || isBatchDownloading}
                  >
                    {isBatchDownloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                    Baixar Seleção (ZIP)
                  </button>
                </div>
                <button
                  type="button"
                  style={{ width: '100%', border: '1px solid rgba(197, 146, 53, 0.4)', borderRadius: '8px', padding: '9px', background: 'rgba(197, 146, 53, 0.08)', color: '#dfb35e', fontSize: '0.74rem', fontWeight: 700, cursor: (isExpired || !canDownloadAll || isBatchDownloading) ? 'not-allowed' : 'pointer' }}
                  onClick={handleDownloadAll}
                  disabled={isExpired || !canDownloadAll || isBatchDownloading}
                >
                  Baixar Todos (ZIP)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Assinatura Dailabs no canto inferior direito da tela (cor clara sobre fundo escuro) */}
      <div className="developer-signature" style={{ color: '#ffffff', opacity: 0.8, right: '30px', bottom: '24px' }}>
        <img src={signatureLogoImg} alt="Dailabs Logo" className="developer-signature-icon" />
        <div className="developer-signature-copy">
          <span className="developer-signature-brand">DAILABS</span>
          <span className="developer-signature-subtitle" style={{ fontSize: '0.62rem', letterSpacing: '0.8px' }}>CREATIVE AI & SOFTWARES</span>
        </div>
      </div>
    </main>
  );
};
