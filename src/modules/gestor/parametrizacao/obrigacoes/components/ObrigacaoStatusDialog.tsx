import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CircleOff, X } from 'lucide-react';
import type { ObrigacaoModelo } from '../obrigacoes.types';

export interface ObrigacaoStatusDialogProps {
  obrigacao: ObrigacaoModelo;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ObrigacaoStatusDialog = ({
  obrigacao,
  isSaving,
  onCancel,
  onConfirm,
}: ObrigacaoStatusDialogProps) => {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const isSavingRef = useRef(isSaving);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    isSavingRef.current = isSaving;
  }, [isSaving]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSavingRef.current) {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
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
      document.body.style.overflow = previousBodyOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="obrigacao-confirm-backdrop">
      <section
        ref={dialogRef}
        className="obrigacao-confirm"
        role="alertdialog"
        tabIndex={-1}
        aria-modal="true"
        aria-busy={isSaving}
        aria-labelledby="obrigacao-confirm-title"
        aria-describedby="obrigacao-confirm-description"
      >
        <header>
          <span><CircleOff size={20} /></span>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            aria-label="Fechar confirmação"
          >
            <X size={18} />
          </button>
        </header>
        <h2 id="obrigacao-confirm-title">Desativar esta obrigação?</h2>
        <p id="obrigacao-confirm-description">
          <strong>{obrigacao.nome}</strong> deixará de ficar disponível para novas ativações e
          será desativada nas rotinas vinculadas das empresas.
        </p>
        <footer>
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={isSaving}>
            Manter disponível
          </button>
          <button type="button" className="danger" onClick={onConfirm} disabled={isSaving}>
            {isSaving ? 'Desativando...' : 'Sim, desativar'}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
};
