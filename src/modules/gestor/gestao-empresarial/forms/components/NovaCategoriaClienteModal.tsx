import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

interface NovaCategoriaClienteModalProps {
  nome: string;
  descricao: string;
  error: string;
  isSaving?: boolean;
  title?: string;
  subtitle?: string;
  nameLabel?: string;
  namePlaceholder?: string;
  submitLabel?: string;
  onNomeChange: (value: string) => void;
  onDescricaoChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export const NovaCategoriaClienteModal: React.FC<NovaCategoriaClienteModalProps> = ({
  nome,
  descricao,
  error,
  isSaving = false,
  title = 'Nova categoria de cliente',
  subtitle = 'Cadastre uma nova opção para usar neste parceiro.',
  nameLabel = 'Nome *',
  namePlaceholder = 'Ex: Clínica',
  submitLabel = 'Adicionar',
  onNomeChange,
  onDescricaoChange,
  onCancel,
  onSubmit,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  const isSavingRef = useRef(isSaving);
  const onCancelRef = useRef(onCancel);
  const returnFocusRef = useRef<HTMLElement | null>(
    typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null,
  );

  useEffect(() => {
    isSavingRef.current = isSaving;
    onCancelRef.current = onCancel;
    if (isSaving) dialogRef.current?.focus();
  }, [isSaving, onCancel]);

  useEffect(() => {
    const returnFocus = returnFocusRef.current;
    nameInputRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSavingRef.current) onCancelRef.current();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])',
      ));
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      returnFocus?.focus();
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="modal-overlay-custom"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onCancel();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        zIndex: 10000,
      }}
    >
      <form
        ref={dialogRef}
        className="cliente-form-container"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSubmit();
        }}
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: '420px', width: '95%' }}
      >
        <div className="cliente-form-header">
          <h2 id={titleId}>{title}</h2>
          <p id={descriptionId}>{subtitle}</p>
        </div>

        {error && (
          <div className="form-alert-banner error" role="alert" style={{ marginBottom: '12px' }}>
            <span>{error}</span>
          </div>
        )}

        <div className="cliente-form-main-fields" style={{ gap: '12px' }}>
          <div className="input-container">
            <label htmlFor={`${titleId}-name`}>{nameLabel}</label>
            <input
              ref={nameInputRef}
              id={`${titleId}-name`}
              type="text"
              className="input-style"
              placeholder={namePlaceholder}
              value={nome}
              disabled={isSaving}
              onChange={(event) => onNomeChange(event.target.value)}
            />
          </div>

          <div className="input-container">
            <label htmlFor={`${titleId}-description`}>Descrição</label>
            <textarea
              id={`${titleId}-description`}
              className="input-style"
              placeholder="Descrição da opção..."
              rows={2}
              value={descricao}
              disabled={isSaving}
              onChange={(event) => onDescricaoChange(event.target.value)}
            />
          </div>
        </div>

        <div className="form-footer-actions" style={{ marginTop: '16px' }}>
          <button type="button" className="btn-cancel" disabled={isSaving} onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="btn-submit" disabled={isSaving}>
            {isSaving ? 'Salvando...' : submitLabel}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
};
