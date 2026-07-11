import React from 'react';
import { Loader2, FileText } from 'lucide-react';
import type { SharedDocumentForPublicView } from '../types';

interface SharedDocumentViewerProps {
  activeDocument: SharedDocumentForPublicView | null;
  activePreviewUrl: string | null;
  activeMode: 'pdf' | 'image' | 'generic';
  activePdfPreviewUrl: string | null;
  activePdfPreviewStatus?: 'loading' | 'ready' | 'error';
  activeLoadingPreview: boolean;
  activePdfFailedToPreview: boolean;
  activePreviewUnavailable: boolean;
  activePreviewError: boolean;
  onPreviewError: () => void;
}

export const SharedDocumentViewer: React.FC<SharedDocumentViewerProps> = ({
  activeDocument,
  activePreviewUrl,
  activeMode,
  activePdfPreviewUrl,
  activePdfPreviewStatus,
  activeLoadingPreview,
  activePdfFailedToPreview,
  activePreviewUnavailable,
  activePreviewError,
  onPreviewError,
}) => {
  const getLoadingMessage = () => {
    if (activeMode === 'pdf' && activePdfPreviewStatus === 'loading') {
      return 'Gerando prévia da primeira página...';
    }
    return 'Prévia indisponível';
  };

  return (
    <div 
      style={{
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '12px',
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.5), rgba(2, 6, 23, 0.8))',
        minHeight: '450px',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      {/* PDF View (Ready) */}
      {activeMode === 'pdf' && activePdfPreviewUrl && !activePreviewError ? (
        <img
          src={activePdfPreviewUrl}
          alt={activeDocument?.documento || 'Prévia do PDF'}
          onError={onPreviewError}
          style={{ width: '100%', height: '100%', minHeight: '450px', objectFit: 'contain', background: '#ffffff', display: 'block' }}
        />
      ) : null}

      {/* Loading State */}
      {activeLoadingPreview ? (
        <div style={{ padding: '40px', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flexDirection: 'column' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-gold-primary)' }} />
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>{getLoadingMessage()}</span>
        </div>
      ) : null}

      {/* Image View */}
      {activeMode === 'image' && activePreviewUrl ? (
        <img
          src={activePreviewUrl}
          alt={activeDocument?.documento || 'Prévia da Imagem'}
          onError={onPreviewError}
          style={{ width: '100%', height: '100%', minHeight: '450px', objectFit: 'contain', background: '#0f172a', display: 'block' }}
        />
      ) : null}

      {/* Fallback / Preview Unavailable / Protected PDF */}
      {(activePdfFailedToPreview || activePreviewUnavailable) && !activeLoadingPreview ? (
        <div style={{ padding: '40px', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1' }}>
            <FileText size={26} />
          </div>
          <strong style={{ color: '#ffffff', fontSize: '0.94rem' }}>{getLoadingMessage()}</strong>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', maxWidth: '280px', lineHeight: 1.5 }}>
            {activePdfFailedToPreview
              ? 'Este arquivo pode ser protegido por senha ou possuir restrições. Baixe-o diretamente para abrir.'
              : 'Visualização indisponível para este tipo de arquivo. Use a opção de download para abri-lo.'}
          </p>
        </div>
      ) : null}
    </div>
  );
};
