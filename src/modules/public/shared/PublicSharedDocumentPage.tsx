import React, { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Timer, Calendar, Building2, Shield, Info, FileText } from 'lucide-react';
import signatureLogoImg from '../../../assets/chatgpt-login.png';
import loginLogoImg from '../../../assets/camada-o.png';
import {
  fetchPublicShare,
  checkPassword,
  createDocumentAccessUrl,
  formatCountdownLabel,
  getDocumentMode,
} from './publicSharedDocumentHelpers';
import type { PublicSharedDocumentPayload } from './types';
import { parseShareDurationMs } from '../../gestor/documentos/services/documentShareService';
import { usePublicSharedDownloads } from './hooks/usePublicSharedDownloads';
import { SharedDocumentViewer } from './components/SharedDocumentViewer';
import './PublicSharedDocument.css';

// Subcomponentes modulares
import { SharedDocumentUnlockForm } from './components/SharedDocumentUnlockForm';

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

const getFileExtension = (filename: string) => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
};

export const PublicSharedDocumentPage: React.FC = () => {
  const [shareData, setShareData] = useState<PublicSharedDocumentPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [passwordError, setPasswordError] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string | null>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);

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
    if (!result.share.documents.some((doc) => doc.storage_bucket && doc.storage_path)) {
      setPasswordError('Senha correta, mas não foi possível localizar os arquivos.');
      return;
    }
    const cleanShare = sanitizeShare(result.share);
    setPasswordError('');
    setShareData(cleanShare);
    setIsUnlocked(true);
    const firstDocument = cleanShare?.documents?.[0];
    if (firstDocument) {
      setSelectedIds([firstDocument.id]);
      setActiveId(firstDocument.id);
    }
  };

  const renderFileIcon = (filename: string, size = 18) => {
    const ext = getFileExtension(filename);
    let color = '#64748b';
    let bg = '#f1f5f9';

    if (ext === 'pdf') {
      color = '#ef4444';
      bg = '#fef2f2';
    } else if (['xlsx', 'xls', 'ods'].includes(ext)) {
      color = '#22c55e';
      bg = '#f0fdf4';
    } else if (['docx', 'doc', 'odt'].includes(ext)) {
      color = '#3b82f6';
      bg = '#eff6ff';
    } else if (['pptx', 'ppt', 'odp'].includes(ext)) {
      color = '#f97316';
      bg = '#fff7ed';
    } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      color = '#64748b';
      bg = '#f8fafc';
    }

    return (
      <div className="file-icon-bg" style={{ backgroundColor: bg, color }}>
        <FileText size={size} />
      </div>
    );
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
      {/* 1. Cabeçalho Superior Preto do Site (VAI DE PONTA A PONTA) */}
      <div className="public-shared-site-header">
        {/* Esquerda: Logo Arkhen */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src={loginLogoImg} alt="Logo Arkhen" style={{ width: '38px', height: '38px', objectFit: 'contain' }} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, textAlign: 'left' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', letterSpacing: '1px' }}>Arkhen</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--color-gold-primary)', fontWeight: 600, letterSpacing: '0.5px' }}>Gestão Contábil</span>
          </div>
        </div>

        {/* Direita: Compartilhamento Seguro */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff', fontSize: '0.8rem', opacity: 0.9 }}>
          <Shield size={16} style={{ color: '#22c55e' }} />
          <span>Compartilhamento seguro</span>
        </div>
      </div>

      {/* 2. Área de Conteúdo Central (onde o card branco flutua) */}
      <div className="public-shared-content-area">
        {/* Card Centralizado Branco */}
        <div className="public-shared-glass-modal animate-slide-up">
          {/* ================= COLUNA ESQUERDA ================= */}
          <div className="public-shared-body-left">
            {isSingleFile && activeDocument ? (
              /* Layout Arquivo Único com Visualização Real (Preview) */
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', textAlign: 'left' }}>
                {/* Cabeçalho do arquivo único */}
                <div style={{ marginBottom: '14px' }}>
                  <h2 style={{ margin: '0 0 2px', fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={activeDocument.documento}>
                    {activeDocument.documento}
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                    {getFileExtension(activeDocument.documento).toUpperCase()} • {formatBytes(activeDocument.tamanho_bytes)}
                  </span>
                </div>

                {/* Área de Visualização Real (Preview) */}
                <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                  <SharedDocumentViewer
                    activeDocument={activeDocument}
                    activePreviewUrl={shareData.isLegacy ? shareData.legacyUrl || null : (activeDocument ? documentUrls[activeDocument.id] : null)}
                    activeMode={activeDocument ? getDocumentMode(activeDocument.documento) : 'generic'}
                    activePreviewUnavailable={previewError}
                    onPreviewError={() => setPreviewError(true)}
                  />
                </div>

                {/* Rodapé do arquivo único com escudo alinhado */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#64748b', fontSize: '0.76rem', marginTop: '16px', opacity: 0.9 }}>
                  <Shield size={15} style={{ color: '#2563eb', minWidth: '15px', marginTop: '2px' }} />
                  <span style={{ lineHeight: 1.4 }}>Este arquivo foi compartilhado de forma segura. Não é necessário fazer login para acessar.</span>
                </div>
              </div>
            ) : (
              /* Layout Lote de Múltiplos Arquivos (Imagem 2) */
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Ícone de Pasta Azul no topo */}
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', margin: '0 auto 12px auto' }}>
                  <FileText size={22} />
                </div>

                {/* Título de Arquivos Compartilhados */}
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Arquivos compartilhados</h2>
                <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Alguém compartilhou os seguintes arquivos com você.
                </p>

                {/* Pílula de Detalhe de Tamanho */}
                <div className="batch-size-pill">
                  <span>{documents.length} arquivos</span>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <span>{totalSizeFormatted}</span>
                </div>

                {/* Tabela de listagem dos arquivos com scroll */}
                <div className="files-table-container scrollbar-premium">
                  <table className="files-table">
                    <thead>
                      <tr>
                        <th align="left">Nome do arquivo</th>
                        <th align="right" style={{ paddingRight: '20px' }}>Tamanho</th>
                        <th align="center"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc) => (
                        <tr key={doc.id}>
                          <td align="left">
                            <div className="file-row-name-cell">
                              {renderFileIcon(doc.documento)}
                              <span 
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                  setActiveId(doc.id);
                                  toggleSelection(doc.id);
                                }}
                                title="Visualizar este arquivo"
                              >
                                {doc.documento}
                              </span>
                            </div>
                          </td>
                          <td align="right" style={{ fontWeight: 600, paddingRight: '20px', color: '#64748b' }}>
                            {formatBytes(doc.tamanho_bytes)}
                          </td>
                          <td align="center" style={{ width: '40px' }}>
                            <button
                              type="button"
                              className="file-download-btn"
                              onClick={() => handleDownloadOne(doc.id)}
                              title="Baixar este arquivo"
                              disabled={isExpired}
                            >
                              <Download size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ================= COLUNA DIREITA ================= */}
          <div className="public-shared-body-right">
            <div className="sidebar-scroll-content">
              {/* 1. Empresa Emissora Destacada */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '16px', textAlign: 'left' }}>
                {shareData.empresaLogo ? (
                  <img 
                    src={shareData.empresaLogo} 
                    alt={shareData.empresa} 
                    style={{ 
                      width: '82px', 
                      height: '82px', 
                      objectFit: 'contain', 
                      borderRadius: '50%', 
                      background: '#ffffff', 
                      border: '1px solid #e2e8f0', 
                      padding: '4px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                      minWidth: '82px'
                    }} 
                  />
                ) : (
                  <div 
                    style={{ 
                      width: '82px', 
                      height: '82px', 
                      borderRadius: '50%', 
                      background: '#eff6ff', 
                      border: '1px solid #bfdbfe', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      color: '#2563eb',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                      minWidth: '82px'
                    }}
                  >
                    <Building2 size={40} />
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Empresa Emissora
                  </span>
                  <strong style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: 800 }}>
                    {shareData.empresa}
                  </strong>
                  {shareData.empresaCnpj && (
                    <span style={{ fontSize: '0.72rem', color: '#c59235', fontWeight: 700, marginTop: '1px' }}>
                      CNPJ {shareData.empresaCnpj}
                    </span>
                  )}
                  {/* Mensagem de Responsabilidade da Empresa */}
                  <span style={{ fontSize: '0.66rem', color: '#64748b', marginTop: '4px', lineHeight: 1.3, fontWeight: 500 }}>
                    A responsabilidade pelo conteúdo e integridade deste arquivo é exclusiva da empresa emissora.
                  </span>
                </div>
              </div>

              {/* 2. Compartilhado em */}
              <div className="info-row" style={{ marginBottom: '14px' }}>
                <div className="info-icon-wrapper">
                  <Calendar size={18} />
                </div>
                <div className="info-text-group">
                  <span className="info-title">Compartilhado em</span>
                  <strong className="info-value" style={{ color: '#334155' }}>{shareData.dataGeracao}</strong>
                </div>
              </div>

              {/* 3. Prazo de acesso */}
              <div className="info-row" style={{ marginBottom: '14px' }}>
                <div className="info-icon-wrapper">
                  <Timer size={18} />
                </div>
                <div className="info-text-group">
                  <span className="info-title">Prazo de acesso</span>
                  <strong className="info-value" style={{ color: '#334155' }}>{shareData.tempoLimite}</strong>
                </div>
              </div>

              {/* 4. Tempo restante (Azul para único e Vermelho para lote, tamanho grande) */}
              <div className="info-row" style={{ marginBottom: '14px' }}>
                <div className="info-icon-wrapper">
                  <Timer size={18} />
                </div>
                <div className="info-text-group">
                  <span className="info-title">Tempo restante</span>
                  <strong 
                    className="info-value" 
                    style={{ 
                      color: isExpired ? '#ef4444' : (isSingleFile ? '#2563eb' : '#ef4444'), 
                      fontSize: '1.25rem', 
                      fontFamily: 'monospace', 
                      fontWeight: 800, 
                      marginTop: '2px' 
                    }}
                  >
                    {remainingLabel || '...'}
                  </strong>
                </div>
              </div>

              {/* 5. Expira em (Vermelho) */}
              <div className="info-row" style={{ marginBottom: '20px' }}>
                <div className="info-icon-wrapper danger">
                  <Calendar size={18} />
                </div>
                <div className="info-text-group">
                  <span className="info-title">Expira em</span>
                  <strong className="info-value" style={{ color: '#ef4444' }}>{shareData.dataExpiracao}</strong>
                </div>
              </div>
            </div>

            {/* BOTÃO DE BAIXAR E AVISOS (Renderizados acima do aviso final) */}
            {isSingleFile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: 'auto' }}>
                <button
                  type="button"
                  className="btn-primary-blue"
                  onClick={handleDownloadSelected}
                  disabled={isExpired || isBatchDownloading}
                >
                  {isBatchDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  Baixar arquivo
                </button>

                <div className="sidebar-warning-box info" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
                  <Info size={18} style={{ color: '#2563eb', minWidth: '18px', marginTop: '2px' }} />
                  <span className="sidebar-warning-text" style={{ color: '#1e3a8a' }}>
                    Após o vencimento, o link e o arquivo <strong style={{ color: '#2563eb' }}>não estarão mais disponíveis</strong>.
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: 'auto' }}>
                <button
                  type="button"
                  className="btn-primary-blue"
                  onClick={handleDownloadAll}
                  disabled={isExpired || !canDownloadAll || isBatchDownloading}
                >
                  {isBatchDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  Baixar todos os arquivos (.zip)
                </button>
                <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', marginTop: '-6px', textAlign: 'center' }}>
                  Todos os arquivos serão baixados compactados em um único arquivo .zip
                </span>

                <div className="sidebar-warning-box">
                  <Shield size={18} style={{ color: '#2563eb', minWidth: '18px', marginTop: '2px' }} />
                  <span className="sidebar-warning-text" style={{ color: '#1e3a8a' }}>
                    <strong style={{ color: '#2563eb' }}>Compartilhamento seguro.</strong> Este link é seguro e não requer login. Não compartilhe com pessoas não autorizadas.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Rodapé Centralizado com copyright */}
      <div style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 1, color: '#64748b', fontSize: '0.74rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
        <span>© 2026 | Arkhen Gestão Contábil</span>
      </div>

      {/* 4. Assinatura Dailabs no canto inferior direito da tela */}
      <div className="developer-signature" style={{ color: '#0f172a', opacity: 0.8, right: '30px', bottom: '24px', position: 'absolute', zIndex: 1 }}>
        <img src={signatureLogoImg} alt="Dailabs Logo" className="developer-signature-icon" />
        <div className="developer-signature-copy">
          <span className="developer-signature-brand">DAILABS</span>
          <span className="developer-signature-subtitle" style={{ fontSize: '0.6rem', letterSpacing: '0.8px', color: '#475569' }}>CREATIVE AI & SOFTWARES</span>
        </div>
      </div>
    </main>
  );
};
