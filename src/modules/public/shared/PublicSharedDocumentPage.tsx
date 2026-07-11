import React, { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, Download, FileText, KeyRound, Lock, Loader2, ShieldCheck, Timer, UserRound } from 'lucide-react';
import sharedBackground from '../../../assets/office-scene-meeting.png';
import systemLogoImg from '../../../assets/camada-o.png';
import { PublicSharedDocumentCard } from './PublicSharedDocumentCard';
import {
  fetchPublicShare,
  checkPassword,
  createDocumentAccessUrl,
  formatCountdownLabel,
  getDocumentMode,
  loadPdfFirstPagePreview,
} from './publicSharedDocumentHelpers';
import type { PublicSharedDocumentPayload, SharedDocumentForPublicView } from './types';
import { parseShareDurationMs } from '../../gestor/documentos/services/documentShareService';

const buildPageTitle = (shareData: PublicSharedDocumentPayload | null) => (
  shareData ? `${shareData.documents[0]?.documento ?? 'Arquivo'} | Arquivo compartilhado` : 'Link indisponível | Arkhen'
);

const formatCompanyCnpj = (cnpj: string | null) => {
  if (!cnpj) return '';
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;

  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

const getLoadingMessage = (mode: ReturnType<typeof getDocumentMode>, status?: 'loading' | 'ready' | 'error') => {
  if (mode === 'pdf' && status === 'loading') {
    return 'Gerando prévia da primeira página...';
  }
  return 'Prévia indisponível';
};

export const PublicSharedDocumentPage: React.FC = () => {
  const [shareData, setShareData] = useState<PublicSharedDocumentPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string | null>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
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

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    fetchPublicShare()
      .then((share) => {
        if (!mounted) return;
        setShareData(share);
        setDocumentPdfPreviews({});
        setDocumentPdfPreviewStatus({});
        setIsUnlocked(Boolean(share && !share.senhaObrigatoria));
        const firstDocument = share?.documents?.[0];
        if (firstDocument) {
          setSelectedIds([firstDocument.id]);
          setActiveId(firstDocument.id);
        } else {
          setSelectedIds([]);
          setActiveId(null);
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
  const isExpired = remaining !== null && remaining <= 0;
  const activeDocument = documents.find((doc) => doc.id === activeId) || documents[0] || null;
  const activePreviewUrl = shareData?.isLegacy ? shareData.legacyUrl : (activeDocument ? documentUrls[activeDocument.id] : null);
  const activeMode = getDocumentMode(activeDocument?.documento || '');
  const activePdfPreviewUrl = activeDocument ? documentPdfPreviews[activeDocument.id] : null;
  const activePdfPreviewStatus = activeDocument ? documentPdfPreviewStatus[activeDocument.id] : undefined;
  const hasMultipleDocuments = Boolean(shareData && documents.length > 1);
  const activeHasPdfSource = activeMode === 'pdf' && Boolean(activePreviewUrl);
  const canDownloadDocument = (documentId: string) => (
    !isExpired && (shareData?.isLegacy ? Boolean(shareData?.legacyUrl) : Boolean(documentUrls[documentId]))
  );
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

  const downloadByUrl = async (item: SharedDocumentForPublicView, url: string | null | undefined) => {
    if (!url) return;
    try {
      const response = await fetch(url, { method: 'GET', mode: 'cors' });
      if (!response.ok) throw new Error('Falha no fetch');
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
      return;
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
  };

  const handleDownloadDocumentIds = async (documentIds: string[]) => {
    if (!shareData || isBatchDownloading) return;
    const enabled = documentIds.every(canDownloadDocument);
    if (!enabled || isExpired) return;

    setIsBatchDownloading(true);
    try {
      for (const id of documentIds) {
        const item = documents.find((document) => document.id === id);
        if (!item) continue;
        const url = shareData.isLegacy ? shareData.legacyUrl : documentUrls[item.id];
        // eslint-disable-next-line no-await-in-loop
        await downloadByUrl(item, url);
      }
    } finally {
      setIsBatchDownloading(false);
    }
  };

  const handleDownloadOne = async (documentId: string) => {
    await handleDownloadDocumentIds([documentId]);
  };

  const handleDownloadSelected = async () => {
    await handleDownloadDocumentIds(selectedIds);
  };

  const handleDownloadAll = async () => {
    if (!shareData) return;
    await handleDownloadDocumentIds(documents.map((doc) => doc.id));
  };

  const handleUnlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!shareData) return;
    const result = await checkPassword(password, shareData);
    if (!result.ok || !result.share) {
      setPasswordError('Senha inválida ou compartilhamento indisponível.');
      return;
    }
    if (!result.share.documents.some((doc) => doc.storage_bucket && doc.storage_path)) {
      setPasswordError('Senha correta, mas não foi possível localizar os arquivos para download.');
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
    setPassword('');
  };

  if (isLoading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#090b0f', color: '#94a3b8' }}>
        <div style={{ padding: '18px 20px', border: '1px solid #1e293b', borderRadius: '12px', background: '#0f172a', color: '#e2e8f0' }}>
          Carregando compartilhamento...
        </div>
      </main>
    );
  }

  if (!shareData) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#090b0f', color: '#fda4af', padding: '20px' }}>
        <div style={{ maxWidth: '600px', background: '#7f1d1d', color: '#fff', borderRadius: '12px', border: '1px solid #fecdd3', padding: '20px' }}>
          Link não encontrado. Solicite um novo compartilhamento ao responsável.
        </div>
      </main>
    );
  }

  const formattedCnpj = formatCompanyCnpj(shareData.empresaCnpj);
  const companyLine = `${shareData.empresa}${formattedCnpj ? ` · CNPJ ${formattedCnpj}` : ''}`;

  return (
    <main style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${sharedBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transform: 'scale(1.06)',
          filter: 'blur(1.9px) grayscale(0.95) brightness(0.30) contrast(1.2) saturate(0.15)',
        }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 15% 10%, rgba(15, 23, 42, 0.28), rgba(2, 6, 23, 0.65) 46%, rgba(2, 6, 23, 0.9) 100%)' }} />

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', padding: '16px' }}>
        <header
          style={{
            maxWidth: '1320px',
            margin: '0 auto 12px',
            color: '#e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src={systemLogoImg}
              alt="Arkhen"
              style={{
                width: 'clamp(120px, 16vw, 220px)',
                height: 'clamp(120px, 16vw, 220px)',
                objectFit: 'contain',
                filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.5))',
              }}
            />
            <div>
              <p style={{ margin: 0, fontSize: '0.9rem', letterSpacing: '0.85px', textTransform: 'uppercase', color: '#cbd5e1' }}>Arkhen</p>
              <p style={{ margin: '2px 0 0', fontSize: 'clamp(2rem, 4.7vw, 3.3rem)', fontWeight: 900, color: '#fff', lineHeight: 1 }}>Gestão Contábil</p>
            </div>
          </div>
          <div style={{ fontSize: '0.76rem', color: '#cbd5e1', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', padding: '7px 10px', borderRadius: '999px' }}>
            Módulo de compartilhamento
          </div>
        </header>

        <section
          style={{
            maxWidth: '1320px',
            margin: '0 auto',
            background: 'linear-gradient(165deg, rgba(15, 23, 42, 0.86), rgba(2, 6, 23, 0.95))',
            borderRadius: '14px',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 30px 74px rgba(2, 6, 23, 0.58)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', background: 'rgba(15, 23, 42, 0.75)', color: '#fff', borderBottom: '1px solid rgba(148,163,184,0.24)' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(197, 146, 53, 0.2)', border: '1px solid rgba(197, 146, 53, 0.45)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={20} color="#dfb35e" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.76rem', color: '#cbd5e1' }}>Acesso temporário seguro</p>
              <h1 style={{ margin: '3px 0 0', fontSize: '1.06rem', color: '#fff', fontWeight: 850 }}>
                Arquivo compartilhado com acesso temporário
              </h1>
            </div>
            {isExpired && (
              <span style={{
                marginLeft: 'auto',
                background: '#7f1d1d',
                color: '#fff',
                borderRadius: '999px',
                padding: '5px 10px',
                fontSize: '0.72rem',
                fontWeight: 800,
              }}>
                Expirado
              </span>
            )}
          </div>

          <div style={{ padding: '18px', display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: '14px' }}>
            <div style={{
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '12px',
              background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.6), rgba(2, 6, 23, 0.9))',
              minHeight: hasMultipleDocuments ? '470px' : '420px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {activeMode === 'pdf' && activePdfPreviewUrl && !activePreviewError ? (
                <img
                  src={activePdfPreviewUrl}
                  alt={activeDocument?.documento || 'Prévia'}
                  onError={() => setActivePreviewError(true)}
                  style={{ width: '100%', height: '100%', minHeight: '450px', objectFit: 'contain', background: '#ffffff' }}
                />
              ) : null}
              {activeLoadingPreview ? (
                <div style={{ height: '100%', minHeight: '450px', background: '#0f172a', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexDirection: 'column' }}>
                  <Loader2 size={26} />
                  <span style={{ fontSize: '0.78rem' }}>Gerando prévia da primeira página...</span>
                </div>
              ) : null}
              {activeMode === 'image' && activePreviewUrl ? (
                <img
                  src={activePreviewUrl}
                  alt={activeDocument?.documento || 'Prévia'}
                  onError={() => setActivePreviewError(true)}
                  style={{ width: '100%', height: '100%', minHeight: '450px', objectFit: 'contain', background: '#0f172a' }}
                />
              ) : null}
              {activePdfFailedToPreview || activePreviewUnavailable ? (
                <div style={{ height: '100%', minHeight: '470px', padding: '24px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', textAlign: 'center', color: '#64748b' }}>
                  <FileText size={38} />
                  <strong style={{ color: '#0f172a' }}>{getLoadingMessage(activeMode, activePdfPreviewStatus)}</strong>
                  <p style={{ margin: 0, fontSize: '0.78rem' }}>
                    {activePdfFailedToPreview
                      ? 'Arquivo protegido por senha? Baixe direto para abrir.'
                      : 'Use a opção de download para abrir o arquivo.'}
                  </p>
                </div>
              ) : null}
            </div>

            <aside style={{ display: 'grid', gap: '10px' }}>
              <div style={{ border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', padding: '14px', background: 'linear-gradient(155deg, rgba(30, 41, 59, 0.84), rgba(15, 23, 42, 0.94))' }}>
                <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Arquivo principal</p>
                <strong style={{ marginTop: '4px', color: '#f8fafc', fontSize: '0.96rem', display: 'block', lineHeight: 1.3 }}>
                  {activeDocument?.documento || 'Arquivo compartilhado'}
                </strong>
                <div style={{ marginTop: '8px', display: 'grid', gap: '8px', color: '#cbd5e1', fontSize: '0.74rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <Building2 size={13} /> <span>{companyLine}</span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <UserRound size={13} />
                    <span>Compartilhado por <strong style={{ color: '#f8fafc' }}>{shareData.geradoPor}</strong></span>
                  </span>
                  <span>Referência: <strong style={{ color: '#f8fafc' }}>{shareData.shareGroupId}</strong></span>
                </div>
              </div>

              <div style={{ border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', padding: '12px', background: 'linear-gradient(155deg, rgba(30, 41, 59, 0.84), rgba(15, 23, 42, 0.94))' }}>
                <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Disponível por: <strong style={{ color: '#f8fafc' }}>{shareData.tempoLimite}</strong></span>
                <p style={{ margin: '6px 0 0', fontSize: '0.76rem', color: '#94a3b8' }}>Expira em: <strong style={{ color: '#f8fafc' }}>{shareData.dataExpiracao}</strong></p>
                <p style={{ margin: '6px 0 0', fontSize: '0.76rem', color: remainingLabel === 'Expirado' ? '#fecaca' : '#93c5fd' }}>
                  Restante: <strong style={{ color: isExpired ? '#f87171' : '#f8fafc' }}>{remainingLabel || '...'}</strong>
                </p>
              </div>

              <div style={{ border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', padding: '12px', background: 'linear-gradient(155deg, rgba(30, 41, 59, 0.84), rgba(15, 23, 42, 0.94))' }}>
                <p style={{ margin: 0, fontSize: '0.74rem', color: '#94a3b8', fontWeight: 800 }}>Gerado em</p>
                <strong style={{ color: '#f8fafc' }}>{shareData.dataGeracao}</strong>
                <p style={{ margin: '8px 0 0', fontSize: '0.74rem', color: '#94a3b8' }}>Expiração exibida em fuso de Maceió (America/Maceio).</p>
              </div>
            </aside>
          </div>

          {!isExpired && shareData.senhaObrigatoria && !isUnlocked ? (
            <form onSubmit={handleUnlock} style={{ padding: '0 18px 16px', display: 'grid', gap: '8px' }}>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#92400e', fontWeight: 800 }}>Digite a senha para desbloquear os arquivos.</p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Senha de acesso"
                  style={{ flex: 1, border: '1px solid #f59e0b', borderRadius: '8px', padding: '10px', color: '#0f172a', outline: 'none' }}
                />
                <button
                  type="submit"
                  style={{
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    background: 'var(--color-gold-gradient)',
                    color: '#fff',
                    fontWeight: 850,
                    display: 'inline-flex',
                    gap: '7px',
                    alignItems: 'center',
                  }}
                >
                  <KeyRound size={15} /> Desbloquear
                </button>
              </div>
              {passwordError ? <span style={{ color: '#b91c1c', fontSize: '0.76rem', fontWeight: 750 }}>{passwordError}</span> : null}
            </form>
          ) : null}

          <div style={{ padding: '0 18px 18px', display: 'grid', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '0.98rem', color: '#f8fafc', fontWeight: 850 }}>Arquivos do compartilhamento</h2>
                <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '0.76rem' }}>
                  {documents.length} documento(s) · {hasSelected ? `${selectedIds.length} selecionado(s)` : 'nenhum selecionado'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={selectAll}
                  disabled={!hasMultipleDocuments}
                  style={{
                    border: '1px solid rgba(148,163,184,0.35)',
                    background: hasMultipleDocuments ? '#0f172a' : '#1f2937',
                    color: hasMultipleDocuments ? '#f8fafc' : '#94a3b8',
                    borderRadius: '8px',
                    padding: '7px 10px',
                    fontSize: '0.73rem',
                    fontWeight: 850,
                    cursor: hasMultipleDocuments ? 'pointer' : 'not-allowed',
                    opacity: hasMultipleDocuments ? 1 : 0.7,
                  }}
                >
                  {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSelected}
                  disabled={isExpired || !hasSelected || !canDownloadSelection || isBatchDownloading}
                  style={{ border: 'none', borderRadius: '8px', padding: '7px 12px', background: (isExpired || !hasSelected || !canDownloadSelection || isBatchDownloading) ? '#94a3b8' : '#0f172a', color: '#fff', fontWeight: 850, cursor: (isExpired || !hasSelected || !canDownloadSelection || isBatchDownloading) ? 'not-allowed' : 'pointer', display: 'inline-flex', gap: '7px', alignItems: 'center' }}
                >
                  <Download size={15} />
                  {isBatchDownloading ? 'Baixando...' : `Baixar ${selectedIds.length > 1 ? 'selecionados' : 'selecionado'}`}
                </button>
                {hasMultipleDocuments ? (
                  <button
                    type="button"
                    onClick={handleDownloadAll}
                    disabled={isExpired || !canDownloadAll || isBatchDownloading}
                    style={{ border: '1px solid #0f172a', borderRadius: '8px', padding: '7px 12px', background: isExpired || !canDownloadAll || isBatchDownloading ? '#e2e8f0' : '#ffffff', color: isExpired || !canDownloadAll || isBatchDownloading ? '#64748b' : '#0f172a', cursor: (isExpired || !canDownloadAll || isBatchDownloading) ? 'not-allowed' : 'pointer', display: 'inline-flex', gap: '7px', alignItems: 'center', fontSize: '0.74rem', fontWeight: 850 }}
                  >
                  <Download size={15} />
                  {isBatchDownloading ? 'Baixando...' : 'Baixar todos'}
                </button>
                ) : null}
              </div>
            </div>

            {hasMultipleDocuments ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${fileGridColumns}, minmax(220px, 1fr))`,
                gap: '10px',
              }}>
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
              <p style={{ margin: '2px 0 0', color: '#94a3b8', fontSize: '0.74rem' }}>
                Visualização do único arquivo disponível no painel principal.
              </p>
            )}

            <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.73rem', color: '#cbd5e1', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <Timer size={14} />
                {isExpired ? 'Tempo encerrado. Gere novo compartilhamento.' : `Tempo restante: ${remainingLabel || '---'}`}
              </div>
              <button
                type="button"
                onClick={() => activeDocument && handleDownloadOne(activeDocument.id)}
                disabled={!activeDocument || !canDownloadDocument(activeDocument.id) || isExpired}
                style={{ border: '1px solid #0f172a', borderRadius: '8px', padding: '7px 11px', background: isExpired ? '#94a3b8' : '#0f172a', color: '#fff', cursor: isExpired ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '0.74rem', fontWeight: 850 }}
              >
                <Download size={15} /> Baixar arquivo selecionado
              </button>
            </div>
          </div>
        </section>

        <div style={{ maxWidth: '1320px', margin: '10px auto 0', color: '#e2e8f0', fontSize: '0.73rem', display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
          <CheckCircle2 size={13} color="#22c55e" />
          {isExpired ? 'Compartilhamento vencido' : 'Para segurança, arquivos são liberados somente para o grupo e janela de tempo corretos.'}
          {!isExpired ? <Lock size={13} color="#f59e0b" /> : null}
          {!isExpired ? <span style={{ color: '#f59e0b' }}>Expiração baseada no fuso de Maceió.</span> : null}
        </div>
      </div>
    </main>
  );
};
