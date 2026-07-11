import React, { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Timer, Calendar, Building2, FileText, X, Shield } from 'lucide-react';
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
  const activeHasPdfSource = activeMode === 'pdf' && Boolean(activePreviewUrl);
  
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
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

      {/* Modal Centralizado Glassmorphism conforme Imagem 2 */}
      <div className="public-shared-glass-modal animate-slide-up">
        {/* Header Superior do Modal (Área Preta) */}
        <div className="public-shared-modal-header">
          {/* Lado Esquerdo: Logo Arkhen */}
          <div className="public-shared-header-left">
            <img src={loginLogoImg} alt="Logo Arkhen" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, textAlign: 'left' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff', letterSpacing: '0.5px' }}>Arkhen</span>
              <span style={{ fontSize: '0.6rem', color: 'var(--color-gold-primary)', fontWeight: 600 }}>Gestão Contábil</span>
            </div>
          </div>

          {/* Centro: Nome do Arquivo e tipo */}
          <div className="public-shared-header-center">
            <FileText size={16} style={{ color: 'var(--color-gold-primary)', minWidth: '16px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, textAlign: 'left', overflow: 'hidden' }}>
              <span style={{ fontSize: '0.78rem', color: '#ffffff', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '340px' }} title={activeDocument?.documento}>
                {activeDocument?.documento || 'Documento'}
              </span>
              <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>
                {activeMode.toUpperCase()} • {documents.length > 1 ? `${documents.length} páginas/arquivos` : '1 arquivo'}
              </span>
            </div>
          </div>

          {/* Lado Direito: Botão Fechar */}
          <div className="public-shared-header-right">
            <button 
              type="button" 
              className="public-shared-close-btn" 
              onClick={() => { window.location.href = '/login'; }}
              title="Voltar ao login"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Corpo do Modal (Visualizador + Sidebar de Info) */}
        <div className="public-shared-modal-body">
          {/* Lado Esquerdo: PDF */}
          <div className="public-shared-body-left">
            {/* Barra de Ferramentas de PDF */}
            <div className="pdf-tools-bar">
              <div className="pdf-tools-group">
                <span style={{ fontWeight: 600 }}>1 / 1</span>
              </div>
              <div className="pdf-tools-group">
                <button type="button" className="pdf-tool-btn" style={{ fontSize: '1rem', padding: '0 8px' }}>—</button>
                <span style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.74rem', color: '#ffffff' }}>100%</span>
                <button type="button" className="pdf-tool-btn" style={{ fontSize: '1rem', padding: '0 8px' }}>+</button>
              </div>
              <div className="pdf-tools-group">
                <button type="button" className="pdf-tool-btn" onClick={handleDownloadSelected} title="Baixar arquivo"><Download size={15} /></button>
              </div>
            </div>

            {/* Visualizador do PDF */}
            <div className="pdf-viewer-content">
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

          {/* Lado Direito: Card Branco de Informações */}
          <div className="public-shared-body-right">
            <div className="sidebar-info-card">
              <div className="sidebar-scroll-content">
                {/* 1. Dados da Empresa */}
                <div className="info-row">
                  <div className="info-icon-wrapper">
                    {shareData.empresaLogo ? (
                      <img src={shareData.empresaLogo} alt={shareData.empresa} style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                    ) : (
                      <Building2 size={20} />
                    )}
                  </div>
                  <div className="info-text-group">
                    <span className="info-title">Empresa Emissora</span>
                    <strong className="info-value">{shareData.empresa}</strong>
                    {shareData.empresaCnpj && <span style={{ fontSize: '0.7rem', color: '#c59235', fontWeight: 600 }}>CNPJ {shareData.empresaCnpj}</span>}
                  </div>
                </div>

                {/* 2. Compartilhado em */}
                <div className="info-row">
                  <div className="info-icon-wrapper">
                    <Calendar size={18} />
                  </div>
                  <div className="info-text-group">
                    <span className="info-title">Compartilhado em</span>
                    <strong className="info-value" style={{ color: '#334155' }}>{shareData.dataGeracao}</strong>
                  </div>
                </div>

                {/* 3. Prazo de acesso */}
                <div className="info-row">
                  <div className="info-icon-wrapper">
                    <Timer size={18} />
                  </div>
                  <div className="info-text-group">
                    <span className="info-title">Prazo de acesso</span>
                    <strong className="info-value" style={{ color: '#334155' }}>{shareData.tempoLimite}</strong>
                  </div>
                </div>

                {/* 4. Tempo restante */}
                <div className="info-row">
                  <div className="info-icon-wrapper">
                    <Timer size={18} />
                  </div>
                  <div className="info-text-group">
                    <span className="info-title">Tempo restante</span>
                    <strong className="info-value" style={{ color: isExpired ? '#ef4444' : '#c59235', background: '#fef8ec', border: '1px solid rgba(197, 146, 53, 0.2)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontFamily: 'monospace', width: 'fit-content', marginTop: '2px' }}>
                      {remainingLabel || '...'}
                    </strong>
                  </div>
                </div>

                {/* 5. Expira em (Vermelho) */}
                <div className="info-row">
                  <div className="info-icon-wrapper danger">
                    <Calendar size={18} />
                  </div>
                  <div className="info-text-group">
                    <span className="info-title">Expira em</span>
                    <strong className="info-value" style={{ color: '#ef4444' }}>{shareData.dataExpiracao}</strong>
                  </div>
                </div>

                {/* Listagem de outros arquivos no lote (se aplicável) */}
                {documents.length > 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                    <span className="info-title" style={{ fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Outros Arquivos</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '110px', overflowY: 'auto' }} className="scrollbar-premium">
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

              {/* Botões e Aviso no Rodapé do Card */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto' }}>
                <button
                  type="button"
                  style={{ width: '100%', border: 'none', borderRadius: '8px', padding: '12px', background: isExpired ? '#e2e8f0' : 'var(--color-gold-gradient)', color: isExpired ? '#94a3b8' : '#ffffff', fontWeight: 700, fontSize: '0.8rem', cursor: isExpired ? 'not-allowed' : 'pointer', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}
                  onClick={handleDownloadSelected}
                  disabled={isExpired || isBatchDownloading}
                >
                  {isBatchDownloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                  Baixar arquivo
                </button>

                {documents.length > 1 && (
                  <button
                    type="button"
                    style={{ width: '100%', border: '1px solid rgba(197, 146, 53, 0.5)', borderRadius: '8px', padding: '11px', background: '#ffffff', color: '#c59235', fontWeight: 700, fontSize: '0.8rem', cursor: isExpired ? 'not-allowed' : 'pointer', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}
                    onClick={handleDownloadAll}
                    disabled={isExpired || !canDownloadAll || isBatchDownloading}
                  >
                    {isBatchDownloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                    Baixar todos como ZIP
                  </button>
                )}

                {/* Caixa de aviso de segurança no rodapé do card */}
                <div className="sidebar-warning-box">
                  <Shield size={16} style={{ color: '#c59235', minWidth: '16px', marginTop: '2px' }} />
                  <span className="sidebar-warning-text">
                    O link e os arquivos estarão disponíveis até a <strong style={{ color: '#c59235' }}>data de expiração</strong>.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assinatura Dailabs no canto inferior direito da tela (cor branca/clara legível) */}
      <div className="developer-signature" style={{ color: '#ffffff', opacity: 0.75, right: '30px', bottom: '24px' }}>
        <img src={signatureLogoImg} alt="Dailabs Logo" className="developer-signature-icon" />
        <div className="developer-signature-copy">
          <span className="developer-signature-brand">DAILABS</span>
          <span className="developer-signature-subtitle" style={{ fontSize: '0.6rem', letterSpacing: '0.8px' }}>CREATIVE AI & SOFTWARES</span>
        </div>
      </div>
    </main>
  );
};
