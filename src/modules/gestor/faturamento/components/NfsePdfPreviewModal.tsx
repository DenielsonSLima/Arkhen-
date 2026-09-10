import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileText, LoaderCircle, X } from 'lucide-react';
import type { FiscalDraft } from '../services/faturamentoFiscalTypes';
import { useNfsePdfPreview } from '../hooks/useNfsePdfPreview';
import './NfsePdfPreviewModal.css';

export function NfsePdfPreviewModal({ note, onClose }: { note: FiscalDraft; onClose: () => void }) {
  const { file, error, retry } = useNfsePdfPreview(note);
  const [viewerError, setViewerError] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  const titleId = useId();
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], iframe, [tabindex="0"]');
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      const outside = !dialog.current?.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || outside)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || outside)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keydown);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(<div className="nfse-pdf-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="nfse-pdf-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialog}>
      <header className="nfse-pdf-header">
        <div><h2 id={titleId}><FileText size={20} />Prévia da NFS-e {note.numeroNfse || ''}</h2>
          <p>{note.ambiente === 'homologacao' ? 'Homologação · sem valor fiscal' : 'Produção'} · Confira o documento antes de baixar.</p></div>
        <button type="button" ref={closeButton} onClick={onClose} aria-label="Fechar prévia do PDF"><X size={22} /></button>
      </header>
      <div className="nfse-pdf-content">
        {error ? <div className="nfse-pdf-status" role="alert"><p>{error}</p><button type="button" onClick={retry}>Tentar novamente</button></div>
          : !file ? <div className="nfse-pdf-status" role="status"><LoaderCircle className="nfse-history-spinning" size={26} /><p>Preparando PDF da nota…</p></div>
          : viewerError ? <div className="nfse-pdf-status" role="alert">Não foi possível exibir a prévia. Você pode baixar o PDF abaixo.</div>
          : <iframe title="Pré-visualização do PDF da NFS-e" src={`${file.url}#view=FitH`} onError={() => setViewerError(true)} />}
      </div>
      <footer className="nfse-pdf-footer"><span>A prévia e o download usam o mesmo arquivo.</span><div>
        <button type="button" onClick={onClose}>Fechar</button>
        {file ? <a className="nfse-pdf-download" href={file.url} download={file.filename}><Download size={17} />Baixar PDF</a>
          : <button className="nfse-pdf-download" type="button" disabled><Download size={17} />Baixar PDF</button>}
      </div></footer>
    </section>
  </div>, document.body);
}
