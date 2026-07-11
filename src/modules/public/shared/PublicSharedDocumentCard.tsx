import React from 'react';
import {
  CheckSquare,
  Circle,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  Square,
} from 'lucide-react';
import { getDocumentMode } from './publicSharedDocumentHelpers';

import type { SharedDocumentForPublicView } from './types';

interface PublicSharedDocumentCardProps {
  document: SharedDocumentForPublicView;
  isSelected: boolean;
  isChecked: boolean;
  previewUrl?: string | null;
  previewImageUrl?: string | null;
  previewStatus?: 'loading' | 'ready' | 'error';
  canDownload: boolean;
  onSelect: (documentId: string) => void;
  onPreview: (documentId: string) => void;
  onDownload: (documentId: string) => void;
}

const fallbackLabelByMode = {
  pdf: 'PDF',
  image: 'Imagem',
  generic: 'Arquivo',
};

export const PublicSharedDocumentCard: React.FC<PublicSharedDocumentCardProps> = ({
  document,
  isSelected,
  isChecked,
  previewUrl,
  previewImageUrl,
  previewStatus,
  canDownload,
  onSelect,
  onPreview,
  onDownload,
}) => {
  const mode = getDocumentMode(document.documento);
  const icon = mode === 'image' ? <ImageIcon size={16} /> : <FileText size={16} />;
  const selectedStyle = isSelected ? 'rgba(197, 146, 53, 0.14)' : '#ffffff';
  const selectedBorder = isSelected ? '1px solid rgba(197, 146, 53, 0.46)' : '1px solid #e2e8f0';
  const subtitle = fallbackLabelByMode[mode];
  const isPdfReady = mode === 'pdf' && previewStatus === 'ready' && Boolean(previewImageUrl);
  const isPdfLoading = mode === 'pdf' && previewStatus === 'loading';
  const hasImagePreview = mode === 'image' && Boolean(previewUrl);

  return (
    <article
      style={{
        borderRadius: '10px',
        border: selectedBorder,
        background: selectedStyle,
        overflow: 'hidden',
        minHeight: '150px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        onClick={() => onPreview(document.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onPreview(document.id);
        }}
        style={{
          border: 'none',
          background: 'transparent',
          color: '#0f172a',
          padding: 0,
          textAlign: 'left',
          cursor: 'pointer',
          height: '100%',
        }}
      >
        <div style={{ padding: '10px', borderBottom: '1px solid rgba(226, 232, 240, 0.82)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelect(document.id);
              }}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                border: '1px solid #94a3b8',
                background: 'transparent',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isChecked ? '#b45309' : '#94a3b8',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              aria-label={isChecked ? 'Desmarcar arquivo' : 'Marcar arquivo'}
            >
              {isChecked ? <CheckSquare size={13} /> : <Square size={13} />}
            </button>
            <span style={{
              width: '20px',
              height: '20px',
              borderRadius: '6px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#64748b',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {icon}
            </span>
            <strong
              style={{
                fontSize: '0.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {document.documento}
            </strong>
          </div>
        </div>

        <div style={{ height: '94px', background: '#0f172a', position: 'relative', overflow: 'hidden' }}>
          {hasImagePreview ? (
            <img
              src={previewUrl || ''}
              alt={document.documento}
              style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.93 }}
              loading="lazy"
            />
          ) : null}

          {isPdfReady && previewImageUrl ? (
            <img
              src={previewImageUrl}
              alt={`Prévia de ${document.documento}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#ffffff' }}
              loading="lazy"
            />
          ) : null}

          {isPdfLoading ? (
            <div
              style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                color: '#e2e8f0',
                background: '#0f172a',
                flexDirection: 'column',
              }}
            >
              <Loader2 size={18} />
              <span style={{ fontSize: '0.62rem' }}>Carregando prévia</span>
            </div>
          ) : null}

          {!previewUrl && !hasImagePreview && !isPdfReady && !isPdfLoading ? (
            <div
              style={{
                width: '100%',
                height: '100%',
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <Circle size={18} />
              <span style={{ fontSize: '0.68rem', color: '#cbd5e1' }}>{subtitle}</span>
              {mode === 'pdf' && previewStatus === 'error' ? (
                <small style={{ fontSize: '0.62rem', textAlign: 'center', padding: '0 6px', color: '#94a3b8' }}>
                  Prévia indisponível (possível PDF protegido)
                </small>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{
        padding: '8px',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '8px',
        alignItems: 'center',
      }}>
        <button
          type="button"
          onClick={() => onPreview(document.id)}
          style={{
            border: '1px solid #dbeafe',
            background: '#eff6ff',
            color: '#1d4ed8',
            borderRadius: '7px',
            padding: '6px 8px',
            cursor: 'pointer',
            fontSize: '0.7rem',
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            justifyContent: 'center',
          }}
        >
          Ver no painel
        </button>
        <button
          type="button"
          onClick={() => onDownload(document.id)}
          disabled={!canDownload}
          style={{
            width: '34px',
            height: '31px',
            borderRadius: '7px',
            border: '1px solid #d8e0ea',
            background: canDownload ? '#ffffff' : '#f1f5f9',
            color: canDownload ? '#0f172a' : '#94a3b8',
            cursor: canDownload ? 'pointer' : 'not-allowed',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={canDownload ? 'Baixar arquivo' : 'Indisponível no momento'}
          aria-label="Baixar arquivo"
        >
          <Download size={14} />
        </button>
      </div>
    </article>
  );
};
