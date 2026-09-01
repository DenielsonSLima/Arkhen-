import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileText, X } from 'lucide-react';
import { SimulationPdfPreview } from '../pdf/SimulationPdfPreview';

interface Props {
  bytes: Uint8Array | null;
  pageCount: number;
  loading: boolean;
  error: string;
  onClose: () => void;
  onDownload: () => void;
}

export const RescisaoPdfModal: React.FC<Props> = ({
  bytes,
  pageCount,
  loading,
  error,
  onClose,
  onDownload,
}) => {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])',
      )].filter((element) => element.getAttribute('aria-hidden') !== 'true');
      if (focusable.length === 0) {
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
      previouslyFocused?.focus();
    };
  }, []);

  return createPortal(
    <div className="simulation-export-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="simulation-export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rescisao-pdf-modal-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="simulation-export-preview">
          <SimulationPdfPreview bytes={bytes} loading={loading} error={error} />
        </div>
        <aside className="simulation-export-actions">
          <div>
            <div className="simulation-export-actions__header">
              <h3 id="rescisao-pdf-modal-title"><FileText size={18} /> Relatório de Rescisão</h3>
              <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Fechar prévia"><X size={20} /></button>
            </div>
            <p>
              Esta prévia usa o mesmo arquivo do download e a configuração Retrato vigente da marca d’água.
            </p>
            {pageCount > 0 && <span className="simulation-page-count">{pageCount} página(s) A4</span>}
          </div>
          <div className="simulation-export-actions__buttons">
            <button type="button" className="simulation-download-button" onClick={onDownload} disabled={loading || !bytes}>
              <Download size={17} /> Baixar PDF
            </button>
            <button type="button" className="simulation-close-button" onClick={onClose}>Fechar</button>
          </div>
        </aside>
      </section>
    </div>,
    document.body,
  );
};
