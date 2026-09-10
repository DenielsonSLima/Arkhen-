import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { GuideScreenshot } from '../types';
import '../styles/GuideScreenshot.css';

function ScreenshotImage({ image, expanded = false }: { image: GuideScreenshot; expanded?: boolean }) {
  const [aspectRatio, setAspectRatio] = useState(1223 / 768);
  return (
    <span className="guide-screenshot-image" style={{ '--guide-image-ratio': aspectRatio } as CSSProperties}>
      <img src={image.src} alt={image.alt} loading={expanded ? 'eager' : 'lazy'} decoding="async"
        onLoad={(event) => {
          const { naturalWidth, naturalHeight } = event.currentTarget;
          if (naturalWidth && naturalHeight) setAspectRatio(naturalWidth / naturalHeight);
        }} />
      {image.markers?.map((marker, index) => (
        <span className="guide-screenshot-marker" key={index} aria-hidden="true" title={`${index + 1}. ${marker.label}`}
          style={{ left: `${marker.x}%`, top: `${marker.y}%` }}>{index + 1}</span>
      ))}
    </span>
  );
}

function ScreenshotLegend({ image }: { image: GuideScreenshot }) {
  if (!image.markers?.length) return null;
  return <ol className="guide-screenshot-legend" aria-label="Indicações na imagem">
    {image.markers.map((marker, index) => <li key={index}>
      <span aria-hidden="true">{index + 1}</span><div><strong>{marker.label}</strong><p>{marker.description}</p></div>
    </li>)}
  </ol>;
}

function ScreenshotViewer({ image, onClose }: { image: GuideScreenshot; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const hintId = useId();
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
      if (event.key !== 'Tab') return;
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]');
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const outside = !dialogRef.current?.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey, true);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className="guide-screenshot-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="guide-screenshot-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={hintId} ref={dialogRef}>
        <header className="guide-screenshot-toolbar">
          <div><span>Tela do sistema</span><h2 id={titleId}>{image.caption}</h2></div>
          <button type="button" onClick={() => setZoom((value) => !value)} aria-pressed={zoom}>
            {zoom ? <ZoomOut size={18} aria-hidden="true" /> : <ZoomIn size={18} aria-hidden="true" />}
            {zoom ? 'Ajustar à tela' : 'Ver detalhes'}
          </button>
          <button type="button" ref={closeRef} onClick={onClose} aria-label="Fechar imagem ampliada"><X size={22} aria-hidden="true" /></button>
        </header>
        <p id={hintId} className="guide-screenshot-hint">Use “Ver detalhes” para ampliar. Role a imagem para conferir os campos. Pressione Esc para fechar.</p>
        <div className={`guide-screenshot-viewport${zoom ? ' is-zoomed' : ''}`} tabIndex={0} role="region" aria-label="Imagem do sistema; use as setas para rolar">
          <ScreenshotImage image={image} expanded />
        </div>
        <ScreenshotLegend image={image} />
      </div>
    </div>, document.body,
  );
}

export function GuideScreenshotFigure({ image }: { image: GuideScreenshot }) {
  const [open, setOpen] = useState(false);
  const captionId = useId();
  // Keep the callback stable so zoom changes do not reset focus or scroll locking.
  const close = useCallback(() => setOpen(false), []);
  return (
    <figure className="guide-screenshot-figure">
      <button className="guide-screenshot-preview" type="button" onClick={() => setOpen(true)} aria-label={`Ampliar imagem: ${image.caption}`} aria-describedby={captionId}>
        <ScreenshotImage image={image} />
        <span className="guide-screenshot-expand"><Maximize2 size={15} aria-hidden="true" />Ampliar imagem</span>
      </button>
      <figcaption id={captionId}>{image.caption}</figcaption>
      <ScreenshotLegend image={image} />
      {open ? <ScreenshotViewer image={image} onClose={close} /> : null}
    </figure>
  );
}
