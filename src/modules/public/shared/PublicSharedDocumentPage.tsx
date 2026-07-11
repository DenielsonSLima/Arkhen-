import React, { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Building2 } from 'lucide-react';
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
      {/* Lado Esquerdo: Visualizador de Documentos */}
      <div className="public-shared-viewer-pane" style={{ backgroundImage: `url(${sharedBackground})` }}>
        <div className="public-shared-viewer-overlay" />
        
        {/* Brand Header da Arkhen no topo esquerdo */}
        <div className="brand-header animate-fade-in" style={{ position: 'absolute', top: '24px', left: '30px', zIndex: 10, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src={loginLogoImg} alt="Logo Arkhen" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
          <div className="brand-title-group" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span className="brand-name" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', letterSpacing: '1px' }}>Arkhen</span>
            <span className="brand-subtitle" style={{ fontSize: '0.76rem', color: 'var(--color-gold-primary)', fontWeight: 600, letterSpacing: '0.5px' }}>Gestão Contábil</span>
          </div>
        </div>

        {/* Visualizador de Arquivo */}
        <div className="public-shared-viewer-content">
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

      {/* Lado Direito: Informações e Ações */}
      <div className="public-shared-info-pane">
        <div className="login-card animate-fade-in-right" style={{ maxHeight: '90%', display: 'flex', flexDirection: 'column' }}>
          {/* Topo do Card: Logotipo da Empresa e Nome + CNPJ ao lado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px', borderBottom: '1px solid #eeeeee', paddingBottom: '16px' }}>
            {shareData.empresaLogo ? (
              <img
                src={shareData.empresaLogo}
                alt={shareData.empresa}
                style={{
                  width: '48px',
                  height: '48px',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  background: '#ffffff',
                  border: '1px solid rgba(0,0,0,0.06)',
                  padding: '2px'
                }}
              />
            ) : (
              <div 
                style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: '8px', 
                  background: 'rgba(197, 146, 53, 0.1)', 
                  border: '1px solid rgba(197, 146, 53, 0.3)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: 'var(--color-gold-primary)' 
                }}
              >
                <Building2 size={22} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, textAlign: 'left' }}>
              <span style={{ fontSize: '0.62rem', color: '#888888', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Empresa Emissora
              </span>
              <strong style={{ color: 'var(--color-text-dark)', fontSize: '1.05rem', fontWeight: 800 }}>
                {shareData.empresa}
              </strong>
              {shareData.empresaCnpj && (
                <span style={{ fontSize: '0.72rem', color: 'var(--color-gold-primary)', fontFamily: 'monospace', fontWeight: 700 }}>
                  CNPJ: {shareData.empresaCnpj}
                </span>
              )}
            </div>
          </div>

          {/* Conteúdo rolável se necessário */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '4px' }}>
            {/* Nome do Arquivo Principal */}
            <div>
              <span style={{ fontSize: '0.62rem', color: '#888888', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Arquivo Ativo
              </span>
              <strong style={{ color: 'var(--color-text-dark)', fontSize: '0.92rem', display: 'block', marginTop: '3px', lineHeight: 1.3 }}>
                {activeDocument?.documento || 'Documento Compartilhado'}
              </strong>
            </div>

            {/* Metadados de Tempo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#fafafa', border: '1px solid #eeeeee', borderRadius: '10px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: '#666666', fontWeight: 500 }}>Gerado em:</span>
                <strong style={{ color: 'var(--color-text-dark)' }}>{shareData.dataGeracao}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: '#666666', fontWeight: 500 }}>Disponível por:</span>
                <strong style={{ color: 'var(--color-text-dark)' }}>{shareData.tempoLimite}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: '#666666', fontWeight: 500 }}>Expira em:</span>
                <strong style={{ color: '#dc2626', fontWeight: 700 }}>{shareData.dataExpiracao}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #eaeaea', paddingTop: '8px', marginTop: '2px', fontSize: '0.78rem' }}>
                <span style={{ color: '#666666', fontWeight: 500 }}>Restante:</span>
                <strong 
                  style={{ 
                    color: isExpired ? '#ef4444' : 'var(--color-gold-primary)', 
                    fontFamily: 'monospace', 
                    fontSize: '0.9rem',
                    background: isExpired ? 'rgba(239, 68, 68, 0.06)' : 'rgba(197, 146, 53, 0.06)',
                    border: isExpired ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(197, 146, 53, 0.2)',
                    padding: '2px 8px',
                    borderRadius: '4px'
                  }}
                >
                  {remainingLabel || '...'}
                </strong>
              </div>
            </div>

            {/* Layout para Múltiplos Arquivos */}
            {!isSingleFile && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-dark)', fontWeight: 800 }}>
                    Lote de Documentos
                  </h4>
                  <span style={{ fontSize: '0.68rem', color: '#888888' }}>
                    {selectedIds.length} de {documents.length} selecionado(s)
                  </span>
                </div>

                {/* Grid de Cards no rodapé do card */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px', border: '1px solid #eeeeee', borderRadius: '8px', padding: '6px', background: '#fafafa' }}>
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
            )}
          </div>

          {/* Botões de Ação na base do card */}
          <div style={{ borderTop: '1px solid #eeeeee', paddingTop: '16px', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {isSingleFile ? (
              <button
                type="button"
                className="btn-primary"
                onClick={handleDownloadSelected}
                disabled={isExpired || isBatchDownloading}
              >
                {isBatchDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Baixar Arquivo
              </button>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    style={{ 
                      flex: 1, 
                      border: '1px solid #dcdcdc', 
                      borderRadius: '8px', 
                      padding: '10px', 
                      background: '#ffffff', 
                      color: 'var(--color-text-dark)', 
                      fontSize: '0.78rem',
                      fontWeight: 700, 
                      cursor: 'pointer' 
                    }}
                    onClick={selectAll}
                  >
                    {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ flex: 2, margin: 0 }}
                    onClick={handleDownloadSelected}
                    disabled={isExpired || !hasSelected || !canDownloadSelection || isBatchDownloading}
                  >
                    {isBatchDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    {isBatchDownloading ? 'Processando...' : `Baixar selecionado(s) ZIP`}
                  </button>
                </div>
                <button
                  type="button"
                  style={{ 
                    width: '100%', 
                    border: '1px solid rgba(197, 146, 53, 0.4)', 
                    borderRadius: '8px', 
                    padding: '10px', 
                    background: 'rgba(197, 146, 53, 0.08)', 
                    color: 'var(--color-gold-primary)', 
                    fontSize: '0.78rem',
                    fontWeight: 700, 
                    cursor: (isExpired || !canDownloadAll || isBatchDownloading) ? 'not-allowed' : 'pointer' 
                  }}
                  onClick={handleDownloadAll}
                  disabled={isExpired || !canDownloadAll || isBatchDownloading}
                >
                  Baixar Todos (ZIP)
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Assinatura Dailabs no canto inferior direito da tela */}
      <div className="developer-signature" style={{ color: '#cbd5e1', opacity: 0.55 }}>
        <img src={signatureLogoImg} alt="Dailabs Logo" className="developer-signature-icon" />
        <div className="developer-signature-copy">
          <span className="developer-signature-brand">DAILABS</span>
          <span className="developer-signature-subtitle">CREATIVE AI & SOFTWARES</span>
        </div>
      </div>
    </main>
  );
};
