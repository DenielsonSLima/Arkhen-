import React from 'react';
import { Loader2, FileText } from 'lucide-react';
import type { SharedDocumentForPublicView } from '../types';

interface SharedDocumentViewerProps {
  activeDocument: SharedDocumentForPublicView | null;
  activePreviewUrl: string | null;
  activeMode: 'pdf' | 'image' | 'generic';
  activePreviewUnavailable: boolean;
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
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        background: '#f8fafc', /* Fundo cinza prancheta profissional */
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.03)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1
      }}
    >
      {/* Loading spinner */}
      {isLoadingSource ? (
        <div style={{ padding: '40px', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flexDirection: 'column' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: '#2563eb' }} />
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Carregando visualização...</span>
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
              style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#f8fafc', display: 'block' }}
            />
          ) : null}

          {/* Fallback para formatos sem prévia ou erros */}
          {activePreviewUnavailable || (activeMode === 'generic' && activePreviewUrl) ? (
            <div style={{ padding: '40px', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #bfdbfe', color: '#2563eb' }}>
                <FileText size={24} />
              </div>
              <strong style={{ color: '#0f172a', fontSize: '0.92rem' }}>Prévia indisponível para este formato</strong>
              <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748b', maxWidth: '240px', lineHeight: 1.5 }}>
                Use o botão de download no painel lateral para abrir o arquivo em seu dispositivo.
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};
