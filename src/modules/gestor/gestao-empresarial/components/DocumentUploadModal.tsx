import React, { useEffect, useRef, useState } from 'react';
import { CalendarClock, CalendarOff, Check, Plus, X } from 'lucide-react';
import { DocumentUploadSelection } from './DocumentUploadSelection';
import {
  ACCEPTED_FORMATS_LABEL,
  ALLOWED_ACCOUNTING_EXTENSIONS,
  collectDroppedFiles,
  combineFolders,
  formatRemainingTime,
  getFileExtension,
  getFileRelativePath,
  getRelativeFolder,
  type DocumentUploadModalProps,
  type UploadFileItem,
  type UploadProgressState,
} from './documentUploadModel';

export type { DocumentUploadModalProps } from './documentUploadModel';

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
          <DocumentUploadSelection
            files={files}
            totalSelectedBytes={totalSelectedBytes}
            uploadProgress={uploadProgress}
            progressPercent={progressPercent}
            remainingTime={remainingTime}
            isDraggingUpload={isDraggingUpload}
            isSubmitting={isSubmitting}
            folderInputRef={folderInputRef}
            onDraggingChange={setIsDraggingUpload}
            onDrop={handleDropUpload}
            onSelectFiles={setInputFiles}
            onClear={() => setFiles([])}
          />

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
