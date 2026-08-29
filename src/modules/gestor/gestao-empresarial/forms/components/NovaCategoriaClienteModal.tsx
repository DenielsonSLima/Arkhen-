import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './NovaCategoriaClienteModal.css';

interface NovaCategoriaClienteModalProps {
  nome: string;
  descricao: string;
  error: string;
  isSaving?: boolean;
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
  onNomeChange,
  onDescricaoChange,
  onCancel,
  onSubmit,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusedElementRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusInitialField = window.setTimeout(() => {
      dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusableElements = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusInitialField);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusedElementRef.current?.focus();
    };
  }, [isSaving, onCancel]);

  return createPortal(
    <div
      className="nested-category-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onCancel();
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget && !isSaving) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        className="nested-category-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nova-categoria-cliente-title"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
      <div className="cliente-form-header">
        <h2 id="nova-categoria-cliente-title">Nova Categoria</h2>
        <p>Cadastre uma nova categoria de cliente.</p>
      </div>

      {error && (
        <div className="form-alert-banner error" style={{ marginBottom: '12px' }}>
          <span>{error}</span>
        </div>
      )}

      <div className="cliente-form-main-fields" style={{ gap: '12px' }}>
        <div className="input-container">
          <label>Nome da Categoria *</label>
          <input
            type="text"
            className="input-style"
            placeholder="Ex: Holding Familiar"
            value={nome}
            onChange={(event) => onNomeChange(event.target.value)}
            data-autofocus
          />
        </div>

        <div className="input-container">
          <label>Descrição</label>
          <textarea
            className="input-style"
            placeholder="Descrição da categoria..."
            rows={2}
            value={descricao}
            onChange={(event) => onDescricaoChange(event.target.value)}
          />
        </div>
      </div>

      <div className="form-footer-actions" style={{ marginTop: '16px' }}>
        <button type="button" className="btn-cancel" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="btn-submit" disabled={isSaving} onClick={onSubmit}>
          {isSaving ? 'Adicionando...' : 'Adicionar'}
        </button>
      </div>
    </div>
    </div>,
    document.body,
  );
};
