import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, ExternalLink, FileText, Image as ImageIcon, Presentation, Sheet, X } from 'lucide-react';
import type { CompanyDocument } from '../services/gestaoEmpresarialService';
import { isXmlDocument, XmlFiscalViewer } from '../../documentos/xml/XmlFiscalViewer';
import { documentosService } from '../../documentos/services/documentosService';
import { renderAsync } from 'docx-preview';

interface DocumentQuickPreviewProps {
  document: CompanyDocument;
  onClose: () => void;
}

export const DocumentQuickPreview: React.FC<DocumentQuickPreviewProps> = ({ document: doc, onClose }) => {
  const [accessUrl, setAccessUrl] = React.useState(doc.url || '');
  const [urlStatus, setUrlStatus] = React.useState<'idle' | 'loading' | 'ready' | 'error'>(doc.url ? 'ready' : 'idle');
  const [urlError, setUrlError] = React.useState('');
  
  // Estados e refs para pré-visualização de DOCX
  const [docxData, setDocxData] = React.useState<ArrayBuffer | null>(null);
  const [docxLoading, setDocxLoading] = React.useState<boolean>(false);
  const [docxError, setDocxError] = React.useState<string>('');
  const docxContainerRef = React.useRef<HTMLDivElement>(null);

  const extension = doc.nome.split('.').pop()?.toLowerCase() || '';
  const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(extension);
  const isPdf = extension === 'pdf';
  const isDocx = extension === 'docx';
  const isSpreadsheet = ['xls', 'xlsx'].includes(extension);
  const isPresentation = ['ppt', 'pptx'].includes(extension);
  const isTextDocument = ['doc', 'txt'].includes(extension);
  const isXml = isXmlDocument(doc);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    const loadAccessUrl = async () => {
      if (doc.url) {
        setAccessUrl(doc.url);
        setUrlStatus('ready');
        setUrlError('');
        return;
      }

      if (!doc.storagePath) {
        setAccessUrl('');
        setUrlStatus('error');
        setUrlError('Este arquivo não possui caminho de armazenamento.');
        return;
      }

      try {
        setUrlStatus('loading');
        setUrlError('');
        const url = await documentosService.getDocumentAccessUrl(doc);
        if (!cancelled) {
          setAccessUrl(url || '');
          setUrlStatus(url ? 'ready' : 'error');
          if (!url) setUrlError('Não foi possível gerar uma URL assinada para este arquivo.');
        }
      } catch (error) {
        if (!cancelled) {
          setAccessUrl('');
          setUrlStatus('error');
          setUrlError(error instanceof Error ? error.message : 'Não foi possível gerar uma URL assinada.');
        }
      }
    };

    loadAccessUrl();

    return () => {
      cancelled = true;
    };
  }, [doc]);

  useEffect(() => {
    if (!isDocx || urlStatus !== 'ready' || !accessUrl) return;

    let cancelled = false;
    const fetchDocx = async () => {
      try {
        setDocxLoading(true);
        setDocxError('');
        const response = await fetch(accessUrl);
        if (!response.ok) {
          throw new Error(`Erro ao baixar o arquivo: ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        if (!cancelled) {
          setDocxData(buffer);
          setDocxLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching docx:', err);
          setDocxError(err instanceof Error ? err.message : 'Falha ao baixar o arquivo para visualização.');
          setDocxLoading(false);
        }
      }
    };

    fetchDocx();
    return () => {
      cancelled = true;
    };
  }, [isDocx, urlStatus, accessUrl]);

  useEffect(() => {
    if (!docxData || !docxContainerRef.current) return;

    // Limpa qualquer pré-visualização anterior
    docxContainerRef.current.innerHTML = '';
    
    // Chama a biblioteca para renderizar o documento Word
    renderAsync(docxData, docxContainerRef.current, undefined, {
      className: "docx-document",
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      experimental: false
    }).catch((err) => {
      console.error('Error rendering docx:', err);
      setDocxError('Não foi possível renderizar este documento Word.');
    });
  }, [docxData]);

  const handleOpen = () => {
    if (!accessUrl) return;
    window.open(accessUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownload = () => {
    if (!accessUrl) return;
    const anchor = document.createElement('a');
    anchor.href = accessUrl;
    anchor.download = doc.nome;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const renderUnavailableContent = () => {
    const PreviewIcon = isSpreadsheet ? Sheet : isPresentation ? Presentation : isImage ? ImageIcon : FileText;
    const tone = isSpreadsheet
      ? { color: '#15803d', bg: '#dcfce7', border: '#86efac' }
      : isPresentation
        ? { color: '#c2410c', bg: '#ffedd5', border: '#fdba74' }
        : isTextDocument
          ? { color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd' }
          : { color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100%', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '40px', textAlign: 'center' }}>
        <span style={{ width: '72px', height: '88px', borderRadius: '10px', border: `1px solid ${tone.border}`, background: tone.bg, color: tone.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px', boxShadow: '0 12px 28px rgba(15, 23, 42, 0.12)' }}>
          <PreviewIcon size={34} />
        </span>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.98rem', color: '#1e293b' }}>Pré-visualização indisponível</h4>
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
          Use abrir ou baixar para acessar este tipo de arquivo.
        </p>
      </div>
    );
  };

  const renderContent = () => {
    if (urlStatus === 'loading' || urlStatus === 'idle') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100%', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '40px', textAlign: 'center' }}>
          <div className="loading-spinner" style={{ marginBottom: '16px' }} />
          <h4 style={{ margin: '0 0 8px 0', fontSize: '0.98rem', color: '#1e293b' }}>Preparando pré-visualização</h4>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
            Gerando acesso seguro ao arquivo.
          </p>
        </div>
      );
    }

    if (!accessUrl) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100%', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '40px', textAlign: 'center' }}>
          <FileText size={48} style={{ color: '#94a3b8', marginBottom: '16px' }} />
          <h4 style={{ margin: '0 0 8px 0', fontSize: '0.98rem', color: '#1e293b' }}>Link indisponível</h4>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
            {urlError || 'Não foi possível gerar uma URL assinada para este arquivo.'}
          </p>
        </div>
      );
    }

    if (isDocx) {
      if (docxLoading) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100%', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '40px', textAlign: 'center' }}>
            <div className="loading-spinner" style={{ marginBottom: '16px' }} />
            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.98rem', color: '#1e293b' }}>Lendo documento Word...</h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
              Carregando páginas e formatação.
            </p>
          </div>
        );
      }

      if (docxError) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100%', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '40px', textAlign: 'center' }}>
            <FileText size={48} style={{ color: '#ef4444', marginBottom: '16px' }} />
            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.98rem', color: '#ef4444' }}>Não foi possível visualizar</h4>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: '#64748b' }}>
              {docxError}
            </p>
            <button
              onClick={handleDownload}
              style={{ padding: '8px 16px', background: '#9a6b22', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
            >
              Baixar e abrir no Word
            </button>
          </div>
        );
      }

      return (
        <div style={{ width: '100%', height: '100%', overflow: 'auto', background: '#2b313b', padding: '26px', boxSizing: 'border-box' }}>
          <div 
            ref={docxContainerRef}
            className="docx-preview-container"
            style={{ 
              width: 'min(100%, 980px)', 
              minHeight: '640px', 
              margin: '0 auto', 
              background: '#ffffff', 
              boxShadow: '0 22px 52px rgba(0,0,0,0.34)',
              boxSizing: 'border-box'
            }} 
          />
        </div>
      );
    }

    if (isPdf) {
      return (
        <div style={{ width: '100%', height: '100%', overflow: 'auto', background: '#2b313b', padding: '26px', boxSizing: 'border-box' }}>
          <div style={{ width: 'min(100%, 980px)', height: '100%', minHeight: '640px', margin: '0 auto', background: '#ffffff', boxShadow: '0 22px 52px rgba(0,0,0,0.34)' }}>
            <iframe
              src={`${accessUrl}#view=FitH`}
              title={doc.nome}
              style={{ width: '100%', height: '100%', border: 'none', background: '#ffffff' }}
            />
          </div>
        </div>
      );
    }

    if (isImage) {
      return (
        <div style={{ height: '100%', background: '#171c25', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: '26px', boxSizing: 'border-box' }}>
          <img src={accessUrl} alt={doc.nome} style={{ maxWidth: 'min(100%, 1100px)', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain', boxShadow: '0 22px 52px rgba(0,0,0,0.34)' }} />
        </div>
      );
    }

    if (isXml) {
      return <XmlFiscalViewer document={{ ...doc, url: accessUrl }} />;
    }

    return renderUnavailableContent();
  };

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(2, 6, 23, 0.86)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 2100,
      backdropFilter: 'blur(8px)', padding: '18px'
    }} onClick={onClose}>
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        padding: 0,
        width: 'min(1280px, calc(100vw - 36px))',
        height: 'min(860px, calc(100vh - 36px))',
        boxShadow: '0 30px 80px rgba(0,0,0,0.38)',
        border: '2px solid #9a6b22',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        outline: '1px solid rgba(2, 6, 23, 0.88)'
      }} onClick={(event) => event.stopPropagation()}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 14px 12px 18px',
          background: '#0f172a',
          borderBottom: '1px solid rgba(217, 164, 65, 0.42)',
          flexShrink: 0
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 850, color: '#ffffff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {doc.nome}
            </h3>
            <p style={{ margin: '3px 0 0', color: '#cbd5e1', fontSize: '0.72rem', fontWeight: 700 }}>
              {extension ? extension.toUpperCase() : 'ARQUIVO'} · {doc.tamanho || 'Tamanho não informado'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleOpen}
              disabled={!accessUrl}
              title="Abrir em nova aba"
              style={{ border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.08)', cursor: accessUrl ? 'pointer' : 'not-allowed', color: '#e2e8f0', width: '34px', height: '34px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ExternalLink size={16} />
            </button>
            <button
              onClick={handleDownload}
              disabled={!accessUrl}
              title="Baixar arquivo"
              style={{ border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.08)', cursor: accessUrl ? 'pointer' : 'not-allowed', color: '#e2e8f0', width: '34px', height: '34px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Download size={16} />
            </button>
            <button
              onClick={onClose}
              title="Fechar"
              style={{ border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.08)', cursor: 'pointer', color: '#e2e8f0', width: '34px', height: '34px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, background: isImage ? '#171c25' : '#2b313b', padding: isPdf || isImage ? 0 : '18px', overflow: 'hidden' }}>
          {renderContent()}
        </div>
      </div>
    </div>,
    document.body,
  );
};
