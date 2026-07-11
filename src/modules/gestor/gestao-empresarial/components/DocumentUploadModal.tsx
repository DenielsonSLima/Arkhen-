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

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  categories,
  currentFolder,
  onCreateCategory,
  onUpload,
}) => {
  const wasOpenRef = useRef(false);
  const [file, setFile] = useState<File | null>(null);
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

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setFile(null);
      setCategory(categories[0] || 'Outros');
      setNewCategory('');
      setShowCategoryModal(false);
      setDescription('');
      setHasValidityControl(false);
      setDataValidade('');
      setValidationMessage('');
      setCategoryValidationMessage('');
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, categories]);

  useEffect(() => {
    if (isOpen && !category && categories.length > 0) {
      setCategory(categories[0]);
    }
  }, [categories, category, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !category) {
      setValidationMessage('Selecione um arquivo e uma categoria.');
      return;
    }

    const extension = getFileExtension(file.name);
    if (!ALLOWED_ACCOUNTING_EXTENSIONS.includes(extension)) {
      setValidationMessage(`Formato não permitido. Use: ${ACCEPTED_FORMATS_LABEL}.`);
      return;
    }

    setIsSubmitting(true);
    setValidationMessage('');
    try {
      await onUpload(file, category, description.trim(), currentFolder || '', hasValidityControl ? dataValidade : '');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
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
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container"
        style={{
          maxWidth: '520px',
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
          <button onClick={onClose} style={{ border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', color: '#64748b', borderRadius: '8px', width: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '18px 22px 22px', background: '#ffffff' }}>
          <label style={{ border: '1.5px dashed #cbd5e1', borderRadius: '8px', padding: '18px', textAlign: 'center', background: '#f8fafc', cursor: 'pointer' }}>
            <span style={{ width: '40px', height: '40px', borderRadius: '8px', margin: '0 auto 9px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fffbeb', color: 'var(--color-gold-dark)', border: '1px solid #f1d9a3' }}>
              <FileUp size={22} />
            </span>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b' }}>
              {file ? file.name : 'Selecionar Arquivo Contábil'}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
              {ACCEPTED_FORMATS_LABEL}
            </div>
            <input
              type="file"
              accept={ALLOWED_ACCOUNTING_ACCEPT}
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              style={{ display: 'none' }}
            />
          </label>

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
              onClick={onClose}
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
              {isSubmitting ? 'Enviando...' : 'Enviar'}
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
