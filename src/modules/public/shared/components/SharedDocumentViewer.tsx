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
  // Se ainda estiver carregando o link assinado do arquivo ativo
  const isLoadingSource = !activePreviewUrl;

  return (
    <div 
      style={{
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        background: '#121212', // Cor de fundo cinza escuro/preto do sistema
        minHeight: '600px', // Altura maior para uma leitura confortável de documentos
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1
      }}
    >
      {/* Loading signed URL spinner */}
      {isLoadingSource ? (
        <div style={{ padding: '40px', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flexDirection: 'column' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-gold-primary)' }} />
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Carregando arquivo seguro...</span>
        </div>
      ) : (
        <>
          {/* PDF View (iframe completo e nativo) */}
          {activeMode === 'pdf' && activePreviewUrl ? (
            <iframe
              src={activePreviewUrl}
              title={activeDocument?.documento || 'Visualizador de PDF'}
              style={{ width: '100%', height: '100%', minHeight: '600px', border: 'none', background: '#ffffff', display: 'block' }}
            />
          ) : null}

          {/* Image View */}
          {activeMode === 'image' && activePreviewUrl ? (
            <img
              src={activePreviewUrl}
              alt={activeDocument?.documento || 'Visualizador de Imagem'}
              onError={onPreviewError}
              style={{ width: '100%', height: '100%', minHeight: '600px', objectFit: 'contain', background: '#121212', display: 'block' }}
            />
          ) : null}

          {/* Fallback / Preview Unavailable */}
          {activePreviewUnavailable || (activeMode === 'generic' && activePreviewUrl) ? (
            <div style={{ padding: '40px', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.06)', color: '#cbd5e1' }}>
                <FileText size={26} />
              </div>
              <strong style={{ color: '#ffffff', fontSize: '0.94rem' }}>Prévia indisponível</strong>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', maxWidth: '280px', lineHeight: 1.5 }}>
                Visualização indisponível para este tipo de arquivo. Use a opção de download para abri-lo localmente.
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};
