import React from 'react';
import { FileUp } from 'lucide-react';
import {
  ACCEPTED_FORMATS_LABEL,
  ALLOWED_ACCOUNTING_ACCEPT,
  formatBytesLabel,
  type UploadFileItem,
  type UploadProgressState,
} from './documentUploadModel';

interface DocumentUploadSelectionProps {
  files: UploadFileItem[];
  totalSelectedBytes: number;
  uploadProgress: UploadProgressState | null;
  progressPercent: number;
  remainingTime: string;
  isDraggingUpload: boolean;
  isSubmitting: boolean;
  folderInputRef: React.RefObject<HTMLInputElement | null>;
  onDraggingChange: (isDragging: boolean) => void;
  onDrop: (event: React.DragEvent) => void;
  onSelectFiles: (fileList: FileList | null) => void;
  onClear: () => void;
}

export const DocumentUploadSelection: React.FC<DocumentUploadSelectionProps> = ({
  files,
  totalSelectedBytes,
  uploadProgress,
  progressPercent,
  remainingTime,
  isDraggingUpload,
  isSubmitting,
  folderInputRef,
  onDraggingChange,
  onDrop,
  onSelectFiles,
  onClear,
}) => (
  <>
    <div
      onDragEnter={(event) => {
        event.preventDefault();
        onDraggingChange(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        onDraggingChange(true);
      }}
      onDragLeave={() => onDraggingChange(false)}
      onDrop={onDrop}
      style={{
        border: `1.5px dashed ${isDraggingUpload ? 'var(--color-gold-primary)' : '#cbd5e1'}`,
        borderRadius: '10px',
        padding: '18px',
        textAlign: 'center',
        background: isDraggingUpload ? 'linear-gradient(135deg, #fff8e7 0%, #ffffff 74%)' : '#f8fafc',
        boxShadow: isDraggingUpload ? '0 14px 32px rgba(197, 146, 53, 0.16)' : 'none',
        transition: 'all 160ms ease',
      }}
    >
      <span style={{ width: '40px', height: '40px', borderRadius: '8px', margin: '0 auto 9px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fffbeb', color: 'var(--color-gold-dark)', border: '1px solid #f1d9a3' }}>
        <FileUp size={22} />
      </span>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b' }}>
        {files.length > 0
          ? `${files.length} ${files.length === 1 ? 'arquivo selecionado' : 'arquivos selecionados'}`
          : 'Arraste uma pasta, subpastas ou arquivos aqui'}
      </div>
      <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
        {ACCEPTED_FORMATS_LABEL}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
        <label style={{ border: '1px solid #e2e8f0', background: '#ffffff', color: '#334155', borderRadius: '8px', padding: '7px 10px', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '0.74rem', fontWeight: 800 }}>
          Selecionar arquivos
          <input
            type="file"
            multiple
            accept={ALLOWED_ACCOUNTING_ACCEPT}
            disabled={isSubmitting}
            onChange={(event) => onSelectFiles(event.target.files)}
            style={{ display: 'none' }}
          />
        </label>
        <label style={{ border: '1px solid #f1d9a3', background: '#fffbeb', color: 'var(--color-gold-dark)', borderRadius: '8px', padding: '7px 10px', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '0.74rem', fontWeight: 850 }}>
          Selecionar pasta
          <input
            ref={folderInputRef}
            type="file"
            multiple
            disabled={isSubmitting}
            onChange={(event) => onSelectFiles(event.target.files)}
            style={{ display: 'none' }}
          />
        </label>
      </div>
    </div>

    {files.length > 0 && (
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', background: '#ffffff', overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <strong style={{ color: '#0f172a', fontSize: '0.78rem' }}>
            {files.length} arquivo(s) • {formatBytesLabel(totalSelectedBytes)}
          </strong>
          {!isSubmitting && (
            <button
              type="button"
              onClick={onClear}
              style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 800 }}
            >
              Limpar
            </button>
          )}
        </div>
        <div style={{ maxHeight: '118px', overflowY: 'auto', padding: '6px 0' }}>
          {files.slice(0, 8).map((item) => (
            <div key={`${item.relativePath}-${item.file.size}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '5px 12px', color: '#475569', fontSize: '0.72rem' }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.relativePath}</span>
              <span style={{ color: '#94a3b8', flexShrink: 0 }}>{formatBytesLabel(item.file.size)}</span>
            </div>
          ))}
          {files.length > 8 && (
            <div style={{ padding: '5px 12px', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 700 }}>
              + {files.length - 8} arquivo(s) na fila
            </div>
          )}
        </div>
      </div>
    )}

    {uploadProgress && (
      <div style={{ border: '1px solid #f1d9a3', borderRadius: '10px', background: '#fffbeb', padding: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '8px', color: '#92400e', fontSize: '0.74rem', fontWeight: 850 }}>
          <span>Enviando {uploadProgress.completedFiles}/{uploadProgress.totalFiles}</span>
          <span>{progressPercent}% • resta {remainingTime}</span>
        </div>
        <div style={{ height: '8px', borderRadius: '999px', background: '#f8e4b4', overflow: 'hidden' }}>
          <div style={{ width: `${progressPercent}%`, height: '100%', borderRadius: '999px', background: 'var(--color-gold-gradient)', transition: 'width 180ms ease' }} />
        </div>
        <div style={{ marginTop: '7px', color: '#64748b', fontSize: '0.7rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Atual: {uploadProgress.currentFile}
        </div>
      </div>
    )}
  </>
);
