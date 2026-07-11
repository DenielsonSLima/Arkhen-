import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, ExternalLink, FileText, Image as ImageIcon, Presentation, Sheet, X } from 'lucide-react';
import type { CompanyDocument } from '../services/gestaoEmpresarialService';
import { isXmlDocument, XmlFiscalViewer } from '../../documentos/xml/XmlFiscalViewer';

interface DocumentQuickPreviewProps {
  document: CompanyDocument;
  onClose: () => void;
}

export const DocumentQuickPreview: React.FC<DocumentQuickPreviewProps> = ({ document: doc, onClose }) => {
  const extension = doc.nome.split('.').pop()?.toLowerCase() || '';
  const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(extension);
  const isPdf = extension === 'pdf';
  const isSpreadsheet = ['xls', 'xlsx'].includes(extension);
  const isPresentation = ['ppt', 'pptx'].includes(extension);
  const isTextDocument = ['doc', 'docx', 'txt'].includes(extension);
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

  const handleOpen = () => {
    if (!doc.url) return;
    window.open(doc.url, '_blank', 'noopener,noreferrer');
  };

  const handleDownload = () => {
    if (!doc.url) return;
    const anchor = document.createElement('a');
    anchor.href = doc.url;
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
    if (!doc.url) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100%', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '40px', textAlign: 'center' }}>
          <FileText size={48} style={{ color: '#94a3b8', marginBottom: '16px' }} />
          <h4 style={{ margin: '0 0 8px 0', fontSize: '0.98rem', color: '#1e293b' }}>Link indisponível</h4>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
            Não foi possível gerar uma URL assinada para este arquivo.
          </p>
        </div>
      );
    }

    if (isPdf) {
      return (
        <div style={{ width: '100%', height: '100%', overflow: 'auto', background: '#2b313b', padding: '26px', boxSizing: 'border-box' }}>
          <div style={{ width: 'min(100%, 980px)', height: '100%', minHeight: '640px', margin: '0 auto', background: '#ffffff', boxShadow: '0 22px 52px rgba(0,0,0,0.34)' }}>
            <iframe
              src={`${doc.url}#view=FitH`}
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
          <img src={doc.url} alt={doc.nome} style={{ maxWidth: 'min(100%, 1100px)', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain', boxShadow: '0 22px 52px rgba(0,0,0,0.34)' }} />
        </div>
      );
    }

    if (isXml) {
      return <XmlFiscalViewer document={doc} />;
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
              disabled={!doc.url}
              title="Abrir em nova aba"
              style={{ border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.08)', cursor: doc.url ? 'pointer' : 'not-allowed', color: '#e2e8f0', width: '34px', height: '34px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ExternalLink size={16} />
            </button>
            <button
              onClick={handleDownload}
              disabled={!doc.url}
              title="Baixar arquivo"
              style={{ border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.08)', cursor: doc.url ? 'pointer' : 'not-allowed', color: '#e2e8f0', width: '34px', height: '34px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
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
