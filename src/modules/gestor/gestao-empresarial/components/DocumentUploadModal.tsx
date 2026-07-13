import React, { useEffect, useRef, useState } from 'react';
import { CalendarClock, CalendarOff, Check, FileUp, Plus, X } from 'lucide-react';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  currentFolder: string | null;
  onCreateCategory: (categoryName: string) => Promise<string> | string;
  onUpload: (file: File, category: string, description: string, targetFolder: string, dataValidade: string) => Promise<unknown>;
}

interface UploadFileItem {
  file: File;
  relativePath: string;
}

interface UploadProgressState {
  totalFiles: number;
  completedFiles: number;
  totalBytes: number;
  uploadedBytes: number;
  currentFile: string;
  startedAt: number;
}

interface DragFileSystemEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (successCallback: (file: File) => void, errorCallback?: (error: DOMException) => void) => void;
  createReader?: () => {
    readEntries: (
      successCallback: (entries: DragFileSystemEntry[]) => void,
      errorCallback?: (error: DOMException) => void,
    ) => void;
  };
}

const ALLOWED_ACCOUNTING_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.ppt',
  '.pptx',
  '.xml',
  '.txt',
  '.efd',
  '.ecd',
  '.ecf',
  '.ofx',
  '.qif',
  '.rem',
  '.ret',
  '.cnab',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.zip',
  '.rar',
  '.7z',
  '.pfx',
  '.p12',
  '.cer',
  '.crt',
  '.pem',
  '.p7s',
  '.eml',
  '.msg',
];

const ALLOWED_ACCOUNTING_ACCEPT = [
  ...ALLOWED_ACCOUNTING_EXTENSIONS,
  'application/pdf',
  'application/xml',
  'text/xml',
  'text/csv',
  'message/rfc822',
].join(',');

const ACCEPTED_FORMATS_LABEL = 'PDF, Office, XML, TXT/SPED, CSV, OFX/QIF, CNAB, imagens, certificados e ZIP/RAR/7Z';

const getFileExtension = (fileName: string) => {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : '';
};

const getFileRelativePath = (file: File) => (
  (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
);

const formatBytesLabel = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatRemainingTime = (milliseconds: number) => {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return 'calculando...';
  const seconds = Math.ceil(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest ? `${minutes}min ${rest}s` : `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const minutesRest = minutes % 60;
  return minutesRest ? `${hours}h ${minutesRest}min` : `${hours}h`;
};

const getRelativeFolder = (relativePath: string, fileName: string) => {
  const parts = relativePath.split('/').filter(Boolean);
  if (parts.length <= 1) return '';
  if (parts.at(-1) === fileName) parts.pop();
  return parts.join('/');
};

const combineFolders = (baseFolder: string | null, relativeFolder: string) => (
  [baseFolder || '', relativeFolder].map((part) => part.trim()).filter(Boolean).join('/')
);

const readDirectoryEntries = (entry: DragFileSystemEntry) => new Promise<DragFileSystemEntry[]>((resolve, reject) => {
  const reader = entry.createReader?.();
  if (!reader) {
    resolve([]);
    return;
  }

  const entries: DragFileSystemEntry[] = [];
  const readBatch = () => {
    reader.readEntries((batch) => {
      if (batch.length === 0) {
        resolve(entries);
        return;
      }
      entries.push(...batch);
      readBatch();
    }, reject);
  };

  readBatch();
});

const collectEntryFiles = async (entry: DragFileSystemEntry, parentPath = ''): Promise<UploadFileItem[]> => {
  if (entry.isFile && entry.file) {
    return new Promise((resolve, reject) => {
      entry.file?.(
        (file) => resolve([{ file, relativePath: `${parentPath}${file.name}` }]),
        reject,
      );
    });
  }

  if (!entry.isDirectory) return [];
  const children = await readDirectoryEntries(entry);
  const nested = await Promise.all(children.map((child) => collectEntryFiles(child, `${parentPath}${entry.name}/`)));
  return nested.flat();
};

const collectDroppedFiles = async (dataTransfer: DataTransfer): Promise<UploadFileItem[]> => {
  const entries = Array.from(dataTransfer.items || [])
    .map((item) => {
      const getEntry = (item as unknown as { webkitGetAsEntry?: () => unknown }).webkitGetAsEntry;
      return getEntry?.();
    })
    .filter((entry): entry is DragFileSystemEntry => Boolean(entry));

  if (entries.length > 0) {
    const nested = await Promise.all(entries.map((entry) => collectEntryFiles(entry)));
    return nested.flat();
  }

  return Array.from(dataTransfer.files || []).map((file) => ({
    file,
    relativePath: file.name,
  }));
};

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  categories,
  currentFolder,
  onCreateCategory,
  onUpload,
}) => {
  const wasOpenRef = useRef(false);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<UploadFileItem[]>([]);
  const [category, setCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [description, setDescription] = useState('');
  const [hasValidityControl, setHasValidityControl] = useState(false);
  const [dataValidade, setDataValidade] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [categoryValidationMessage, setCategoryValidationMessage] = useState('');
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null);

  useEffect(() => {
    folderInputRef.current?.setAttribute('webkitdirectory', '');
    folderInputRef.current?.setAttribute('directory', '');
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setFiles([]);
      setCategory(categories[0] || 'Outros');
      setNewCategory('');
      setShowCategoryModal(false);
      setDescription('');
      setHasValidityControl(false);
      setDataValidade('');
      setValidationMessage('');
      setCategoryValidationMessage('');
      setIsDraggingUpload(false);
      setUploadProgress(null);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, categories]);

  useEffect(() => {
    if (isOpen && !category && categories.length > 0) {
      setCategory(categories[0]);
    }
  }, [categories, category, isOpen]);

  if (!isOpen) return null;

  const totalSelectedBytes = files.reduce((total, item) => total + item.file.size, 0);
  const progressPercent = uploadProgress
    ? Math.min(100, Math.round((uploadProgress.uploadedBytes / Math.max(uploadProgress.totalBytes, 1)) * 100))
    : 0;
  const remainingTime = uploadProgress && uploadProgress.uploadedBytes > 0
    ? formatRemainingTime(((Date.now() - uploadProgress.startedAt) / uploadProgress.uploadedBytes) * (uploadProgress.totalBytes - uploadProgress.uploadedBytes))
    : 'calculando...';

  const setInputFiles = (fileList: FileList | null) => {
    const nextFiles = Array.from(fileList || []).map((nextFile) => ({
      file: nextFile,
      relativePath: getFileRelativePath(nextFile),
    }));
    setFiles(nextFiles);
    setValidationMessage('');
  };

  const validateSelectedFiles = () => {
    if (files.length === 0 || !category) {
      setValidationMessage('Selecione pelo menos um arquivo e uma categoria.');
      return false;
    }

    const invalidFiles = files.filter((item) => !ALLOWED_ACCOUNTING_EXTENSIONS.includes(getFileExtension(item.file.name)));
    if (invalidFiles.length > 0) {
      setValidationMessage(`Formato não permitido em "${invalidFiles[0].file.name}". Use: ${ACCEPTED_FORMATS_LABEL}.`);
      return false;
    }

    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateSelectedFiles()) {
      return;
    }

    setIsSubmitting(true);
    setValidationMessage('');
    const startedAt = Date.now();
    setUploadProgress({
      totalFiles: files.length,
      completedFiles: 0,
      totalBytes: totalSelectedBytes,
      uploadedBytes: 0,
      currentFile: files[0]?.file.name || '',
      startedAt,
    });

    try {
      let uploadedBytes = 0;
      for (let index = 0; index < files.length; index += 1) {
        const item = files[index];
        const relativeFolder = getRelativeFolder(item.relativePath, item.file.name);
        const targetFolder = combineFolders(currentFolder, relativeFolder);
        setUploadProgress({
          totalFiles: files.length,
          completedFiles: index,
          totalBytes: totalSelectedBytes,
          uploadedBytes,
          currentFile: item.file.name,
          startedAt,
        });
        await onUpload(item.file, category, description.trim(), targetFolder, hasValidityControl ? dataValidade : '');
        uploadedBytes += item.file.size;
        setUploadProgress({
          totalFiles: files.length,
          completedFiles: index + 1,
          totalBytes: totalSelectedBytes,
          uploadedBytes,
          currentFile: item.file.name,
          startedAt,
        });
      }
      onClose();
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  const handleDropUpload = async (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingUpload(false);
    if (isSubmitting) return;

    const droppedFiles = await collectDroppedFiles(event.dataTransfer);
    setFiles(droppedFiles);
    setValidationMessage('');
  };

  const closeSafely = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleCreateCategory = async () => {
    const name = newCategory.trim();
    if (!name) {
      setCategoryValidationMessage('Informe o nome da nova categoria.');
      return;
    }

    setIsCreatingCategory(true);
    setCategoryValidationMessage('');
    try {
      const createdCategory = await onCreateCategory(name);
      if (createdCategory) {
        setCategory(createdCategory);
        setNewCategory('');
        setShowCategoryModal(false);
        setCategoryValidationMessage('');
      }
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    fontSize: '0.84rem',
    border: '1px solid #d8e0ea',
    borderRadius: '8px',
    outline: 'none',
    backgroundColor: '#ffffff',
    color: '#0f172a',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.72rem',
    fontWeight: 800,
    color: '#475569',
    display: 'block',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0',
  };

  return (
    <div className="modal-backdrop" onClick={closeSafely}>
      <div
        className="modal-container"
        style={{
          maxWidth: '620px',
          padding: '0',
          overflow: 'hidden',
          border: '1px solid rgba(197, 146, 53, 0.42)',
          boxShadow: '0 24px 64px rgba(15, 23, 42, 0.24)',
          position: 'relative',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', borderTop: '4px solid var(--color-gold-primary)', padding: '18px 22px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.08rem', fontWeight: 850, margin: 0, color: '#0f172a' }}>
              Enviar arquivo
            </h3>
            <p style={{ display: 'inline-flex', alignItems: 'center', margin: '8px 0 0', padding: '5px 9px', borderRadius: '999px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>
              {currentFolder ? `Destino: ${currentFolder}` : 'Destino: Biblioteca principal'}
            </p>
          </div>
          <button disabled={isSubmitting} onClick={closeSafely} style={{ border: '1px solid #e2e8f0', background: '#f8fafc', cursor: isSubmitting ? 'not-allowed' : 'pointer', color: '#64748b', borderRadius: '8px', width: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '18px 22px 22px', background: '#ffffff' }}>
          <div
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDraggingUpload(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'copy';
              setIsDraggingUpload(true);
            }}
            onDragLeave={() => setIsDraggingUpload(false)}
            onDrop={handleDropUpload}
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
                  onChange={(event) => setInputFiles(event.target.files)}
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
                  onChange={(event) => setInputFiles(event.target.files)}
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
                    onClick={() => setFiles([])}
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

          {validationMessage && (
            <div style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #fed7aa', background: '#fff7ed', color: '#c2410c', fontSize: '0.76rem', fontWeight: 700 }}>
              {validationMessage}
            </div>
          )}

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>
                Categoria *
              </label>
              <button
                type="button"
                onClick={() => {
                  setNewCategory('');
                  setValidationMessage('');
                  setCategoryValidationMessage('');
                  setShowCategoryModal(true);
                }}
                style={{ border: '1px solid #e2e8f0', background: '#ffffff', color: 'var(--color-gold-dark)', borderRadius: '8px', padding: '6px 9px', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <Plus size={13} /> Nova
              </button>
            </div>
            <div>
              <select
                required
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                style={fieldStyle}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>
              Descrição
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              style={{ ...fieldStyle, minHeight: '72px', resize: 'none', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', background: '#ffffff', padding: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', cursor: 'pointer' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#334155', fontSize: '0.82rem', fontWeight: 800 }}>
                {hasValidityControl ? <CalendarClock size={16} color="var(--color-gold-dark)" /> : <CalendarOff size={16} color="#94a3b8" />}
                Controlar validade
              </span>
              <input
                type="checkbox"
                checked={hasValidityControl}
                onChange={(event) => {
                  setHasValidityControl(event.target.checked);
                  if (!event.target.checked) setDataValidade('');
                }}
                style={{ width: '16px', height: '16px', accentColor: 'var(--color-gold-primary)' }}
              />
            </label>
            {hasValidityControl && (
              <input
                type="date"
                value={dataValidade}
                onChange={(event) => setDataValidade(event.target.value)}
                style={{ ...fieldStyle, marginTop: '10px', borderColor: '#f1c879', backgroundColor: '#fffbeb' }}
              />
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button
              type="button"
              onClick={closeSafely}
              style={{ padding: '8px 16px', fontSize: '0.82rem', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff', color: '#475569' }}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{ padding: '8px 16px', fontSize: '0.82rem', background: 'var(--color-gold-gradient)', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Enviando...' : files.length > 1 ? `Enviar ${files.length} arquivos` : 'Enviar'}
            </button>
          </div>
        </form>

        {showCategoryModal && (
          <div
            style={{ position: 'absolute', inset: 0, zIndex: 2, background: 'rgba(15, 23, 42, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '22px' }}
            onClick={() => {
              setShowCategoryModal(false);
              setNewCategory('');
              setCategoryValidationMessage('');
            }}
          >
            <div
              style={{ width: '100%', maxWidth: '360px', background: '#ffffff', borderRadius: '8px', border: '1px solid rgba(197, 146, 53, 0.36)', boxShadow: '0 18px 48px rgba(15, 23, 42, 0.24)', padding: '18px' }}
              onClick={(event) => event.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <h4 style={{ margin: 0, color: '#0f172a', fontSize: '0.98rem', fontWeight: 850 }}>Nova categoria</h4>
                  <p style={{ margin: '3px 0 0', color: '#64748b', fontSize: '0.76rem' }}>Crie e selecione sem sair do envio.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryModal(false);
                    setNewCategory('');
                    setCategoryValidationMessage('');
                  }}
                  style={{ border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', borderRadius: '8px', width: '30px', height: '30px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >
                  <X size={16} />
                </button>
              </div>

              <input
                type="text"
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleCreateCategory();
                  }
                }}
                placeholder="Ex.: Certidões trabalhistas"
                style={fieldStyle}
                autoFocus
              />

              {categoryValidationMessage && (
                <div style={{ marginTop: '8px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #fed7aa', background: '#fff7ed', color: '#c2410c', fontSize: '0.74rem', fontWeight: 700 }}>
                  {categoryValidationMessage}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryModal(false);
                    setNewCategory('');
                    setCategoryValidationMessage('');
                  }}
                  style={{ padding: '8px 14px', fontSize: '0.8rem', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff', color: '#475569', fontWeight: 700 }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  disabled={isCreatingCategory}
                  style={{ padding: '8px 14px', fontSize: '0.8rem', background: 'var(--color-gold-gradient)', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Check size={15} /> {isCreatingCategory ? 'Criando...' : 'Criar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
