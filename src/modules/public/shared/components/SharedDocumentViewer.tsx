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
  activePreviewUnavailable,
  onPreviewError,
}) => {
  const isLoadingSource = !activePreviewUrl;

  return (
    <div 
      style={{
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        background: '#121212',
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 15px 35px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1
      }}
    >
      {/* Loading spinner */}
      {isLoadingSource ? (
        <div style={{ padding: '40px', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flexDirection: 'column' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-gold-primary)' }} />
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Carregando arquivo...</span>
        </div>
      ) : (
        <>
          {/* PDF View (iframe nativo) */}
          {activeMode === 'pdf' && activePreviewUrl ? (
            <iframe
              src={activePreviewUrl}
              title={activeDocument?.documento || 'Visualizador de PDF'}
              style={{ width: '100%', height: '100%', border: 'none', background: '#ffffff', display: 'block' }}
            />
          ) : null}

          {/* Image View */}
          {activeMode === 'image' && activePreviewUrl ? (
            <img
              src={activePreviewUrl}
              alt={activeDocument?.documento || 'Visualizador de Imagem'}
              onError={onPreviewError}
              style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#121212', display: 'block' }}
            />
          ) : null}

          {/* Fallback */}
          {activePreviewUnavailable || (activeMode === 'generic' && activePreviewUrl) ? (
            <div style={{ padding: '40px', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.06)', color: '#cbd5e1' }}>
                <FileText size={24} />
              </div>
              <strong style={{ color: '#ffffff', fontSize: '0.92rem' }}>Prévia indisponível</strong>
              <p style={{ margin: 0, fontSize: '0.76rem', color: '#94a3b8', maxWidth: '240px', lineHeight: 1.5 }}>
                Use o botão de download para abrir o arquivo em seu dispositivo.
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};
