import React, { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Timer, Calendar, Building2, Shield, Info, FileText } from 'lucide-react';
import signatureLogoImg from '../../../assets/chatgpt-login.png';
import loginLogoImg from '../../../assets/camada-o.png';
import {
  fetchPublicShare,
  checkPassword,
  createDocumentAccessUrl,
  formatCountdownLabel,
} from './publicSharedDocumentHelpers';
import type { PublicSharedDocumentPayload } from './types';
import { parseShareDurationMs } from '../../gestor/documentos/services/documentShareService';
import { usePublicSharedDownloads } from './hooks/usePublicSharedDownloads';
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

// Componente inline do Logotipo do Google Drive em SVG
const GoogleDriveLogo: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 87.3 78" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '6px' }}>
    <path d="M6.6 74.3l14.4-25h47.2l-14.4 25H6.6z" fill="#0066DA"/>
    <path d="M28.2 49.3L6.6 12.3l14.4-25 21.6 37.3-14.4 25z" fill="#00A859"/>
    <path d="M51.6 24.3L30 12.3l14.4-25 42.9 37.7-14.4 25-22.9-25.7z" fill="#FFD000"/>
  </svg>
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

  const remainingLabel = useMemo(() => formatCountdownLabel(remaining), [remaining]);
  const activeDocument = documents.find((doc) => doc.id === activeId) || documents[0] || null;
  const activePreviewUrl = shareData?.isLegacy ? shareData.legacyUrl : (activeDocument ? documentUrls[activeDocument.id] : null);
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
    let color = '#64748b'; // default gray
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
      {/* 1. Topo Esquerdo: Logo Arkhen */}
      <div style={{ position: 'absolute', top: '30px', left: '30px', zIndex: 10, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img src={loginLogoImg} alt="Logo Arkhen" style={{ width: '38px', height: '38px', objectFit: 'contain' }} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, textAlign: 'left' }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', letterSpacing: '1px' }}>ARKHEN</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-gold-primary)', fontWeight: 600, letterSpacing: '0.5px' }}>GESTÃO CONTÁBIL</span>
        </div>
      </div>

      {/* 2. Topo Direito: Compartilhamento Seguro */}
      <div style={{ position: 'absolute', top: '38px', right: '30px', zIndex: 10, display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff', fontSize: '0.8rem', opacity: 0.9 }}>
        <Shield size={16} style={{ color: '#22c55e' }} />
        <span>Compartilhamento seguro</span>
      </div>

      {/* 3. Card Centralizado Branco */}
      <div className="public-shared-glass-modal animate-slide-up">
        {/* ================= COLUNA ESQUERDA ================= */}
        <div className="public-shared-body-left">
          {isSingleFile && activeDocument ? (
            /* Layout Arquivo Único (Imagem 2) */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', justifyContent: 'center', height: '100%' }}>
              {/* Ícone Gigante do Formato */}
              <div style={{ width: '96px', height: '96px', borderRadius: '16px', background: getFileExtension(activeDocument.documento) === 'pdf' ? '#fef2f2' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0,0,0,0.04)', color: getFileExtension(activeDocument.documento) === 'pdf' ? '#ef4444' : '#64748b', boxShadow: '0 8px 16px rgba(0,0,0,0.03)' }}>
                <FileText size={48} />
              </div>

              {/* Nome do Arquivo */}
              <h2 style={{ margin: '8px 0 2px', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', maxWidth: '400px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={activeDocument.documento}>
                {activeDocument.documento}
              </h2>
              <span style={{ fontSize: '0.84rem', color: '#64748b', fontWeight: 600 }}>
                {getFileExtension(activeDocument.documento).toUpperCase()} • {formatBytes(activeDocument.tamanho_bytes)}
              </span>

              {/* Botões de Ação */}
              <div style={{ width: '100%', maxWidth: '340px', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' }}>
                <button
                  type="button"
                  className="btn-primary-blue"
                  onClick={handleDownloadSelected}
                  disabled={isExpired || isBatchDownloading}
                >
                  {isBatchDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  Baixar arquivo
                </button>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', margin: '4px 0' }}>
                  <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                  <span style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>ou</span>
                  <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                </div>

                <button
                  type="button"
                  className="btn-secondary-outline"
                  onClick={() => {
                    if (activePreviewUrl) {
                      window.open(activePreviewUrl, '_blank');
                    }
                  }}
                  disabled={isExpired || !activePreviewUrl}
                >
                  <GoogleDriveLogo />
                  Salvar no Google Drive
                </button>
              </div>

              {/* Rodapé do arquivo único */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.76rem', marginTop: '16px', opacity: 0.8 }}>
                <Shield size={14} style={{ color: '#2563eb' }} />
                <span>Este arquivo foi compartilhado de forma segura. Não é necessário fazer login para acessar.</span>
              </div>
            </div>
          ) : (
            /* Layout Lote de Múltiplos Arquivos (Imagem 1) */
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

              {/* Botão de download do zip */}
              <button
                type="button"
                className="btn-primary-blue"
                onClick={handleDownloadAll}
                disabled={isExpired || !canDownloadAll || isBatchDownloading}
              >
                {isBatchDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Baixar todos os arquivos (.zip)
              </button>
              <span style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginTop: '6px' }}>
                Todos os arquivos serão baixados compactados em um único arquivo .zip
              </span>
            </div>
          )}
        </div>

        {/* ================= COLUNA DIREITA ================= */}
        <div className="public-shared-body-right">
          <div className="sidebar-scroll-content">
            {/* 1. Empresa Emissora */}
            <div className="info-row">
              <div className="info-icon-wrapper" style={{ background: '#eff6ff', color: '#2563eb' }}>
                {shareData.empresaLogo ? (
                  <img src={shareData.empresaLogo} alt={shareData.empresa} style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                ) : (
                  <Building2 size={20} />
                )}
              </div>
              <div className="info-text-group">
                <span className="info-title">Empresa Emissora</span>
                <strong className="info-value" style={{ color: '#0f172a' }}>{shareData.empresa}</strong>
                {shareData.empresaCnpj && <span style={{ fontSize: '0.72rem', color: '#c59235', fontWeight: 600 }}>CNPJ {shareData.empresaCnpj}</span>}
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

            {/* 4. Tempo restante (Vermelho, grande) */}
            <div className="info-row">
              <div className="info-icon-wrapper">
                <Timer size={18} />
              </div>
              <div className="info-text-group">
                <span className="info-title">Tempo restante</span>
                <strong className="info-value" style={{ color: '#ef4444', fontSize: '1.25rem', fontFamily: 'monospace', fontWeight: 800, marginTop: '2px' }}>
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
          </div>

          {/* Caixas de Aviso no Rodapé do Card da Direita */}
          {isSingleFile ? (
            <div className="sidebar-warning-box info">
              <Info size={18} style={{ color: '#2563eb', minWidth: '18px', marginTop: '2px' }} />
              <span className="sidebar-warning-text" style={{ color: '#1e3a8a' }}>
                Após o vencimento, o link e o arquivo <strong style={{ color: '#2563eb' }}>não estarão mais disponíveis</strong>.
              </span>
            </div>
          ) : (
            <div className="sidebar-warning-box">
              <Shield size={18} style={{ color: '#15803d', minWidth: '18px', marginTop: '2px' }} />
              <span className="sidebar-warning-text" style={{ color: '#14532d' }}>
                <strong style={{ color: '#15803d' }}>Compartilhamento seguro.</strong> Este link é seguro e não requer login. Não compartilhe com pessoas não autorizadas.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Rodapé Centralizado com copyright */}
      <div style={{ position: 'absolute', bottom: '24px', zIndex: 10, color: '#94a3b8', fontSize: '0.74rem', fontWeight: 600 }}>
        <span>© 2026 | Arkhen Gestão Contábil</span>
      </div>

      {/* 5. Assinatura Dailabs no canto inferior direito da tela */}
      <div className="developer-signature" style={{ color: '#ffffff', opacity: 0.75, right: '30px', bottom: '24px', position: 'absolute', zIndex: 10 }}>
        <img src={signatureLogoImg} alt="Dailabs Logo" className="developer-signature-icon" />
        <div className="developer-signature-copy">
          <span className="developer-signature-brand">DAILABS</span>
          <span className="developer-signature-subtitle" style={{ fontSize: '0.6rem', letterSpacing: '0.8px' }}>CREATIVE AI & SOFTWARES</span>
        </div>
      </div>
    </main>
  );
};
