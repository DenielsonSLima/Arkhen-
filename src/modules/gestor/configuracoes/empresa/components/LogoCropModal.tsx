import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Crop, Minus, Move, Plus, RotateCcw, X } from 'lucide-react';
import {
  calculateLogoCrop,
  createCroppedLogoFile,
  type LogoCropArea,
} from '../services/logoImageProcessor';
import './LogoCropModal.css';

type CropFormat = 'original' | 'square' | 'wide';

interface LogoCropModalProps {
  file: File;
  onCancel: () => void;
  onApply: (file: File) => Promise<void> | void;
}

interface Size {
  width: number;
  height: number;
}

interface DragState {
  pointerId: number;
  clientX: number;
  clientY: number;
  offsetX: number;
  offsetY: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const formatOptions: Array<{ value: CropFormat; label: string }> = [
  { value: 'original', label: 'Original' },
  { value: 'square', label: 'Quadrado' },
  { value: 'wide', label: 'Horizontal' },
];

const getFocusableElements = (container: HTMLElement) => Array.from(
  container.querySelectorAll<HTMLElement>(
    'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
  ),
);

export const LogoCropModal = ({ file, onCancel, onApply }: LogoCropModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);
  const isApplyingRef = useRef(false);
  const [imageSize, setImageSize] = useState<Size | null>(null);
  const [stageSize, setStageSize] = useState<Size | null>(null);
  const [format, setFormat] = useState<CropFormat>('original');
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState('');
  const sourceUrl = useMemo(() => URL.createObjectURL(file), [file]);
  onCancelRef.current = onCancel;
  isApplyingRef.current = isApplying;

  const originalRatio = imageSize ? imageSize.width / imageSize.height : 1;
  const cropRatio = format === 'square'
    ? 1
    : format === 'wide'
      ? 3
      : originalRatio;

  const cropArea = useMemo<LogoCropArea | null>(() => {
    if (!imageSize || !stageSize) return null;

    return calculateLogoCrop({
      sourceWidth: imageSize.width,
      sourceHeight: imageSize.height,
      viewportWidth: stageSize.width,
      viewportHeight: stageSize.height,
      zoom,
      positionX: position.x,
      positionY: position.y,
    });
  }, [imageSize, position.x, position.y, stageSize, zoom]);

  useEffect(() => () => URL.revokeObjectURL(sourceUrl), [sourceUrl]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const updateStageSize = () => {
      const bounds = stage.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) {
        setStageSize({ width: bounds.width, height: bounds.height });
      }
    };

    updateStageSize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateStageSize);
    observer?.observe(stage);
    window.addEventListener('resize', updateStageSize);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateStageSize);
    };
  }, [cropRatio, imageSize]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isApplyingRef.current) {
        event.preventDefault();
        onCancelRef.current();
        return;
      }

      if (event.key !== 'Tab' || !modalRef.current) return;
      const focusable = getFocusableElements(modalRef.current);
      if (focusable.length === 0) return;
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
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, []);

  const resetPosition = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const selectFormat = (nextFormat: CropFormat) => {
    setFormat(nextFormat);
    resetPosition();
  };

  const setSafeZoom = (value: number) => setZoom(clamp(value, 1, 5));

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!cropArea || isApplying) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      offsetX: cropArea.offsetX,
      offsetY: cropArea.offsetY,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !cropArea) return;

    const nextOffsetX = drag.offsetX + event.clientX - drag.clientX;
    const nextOffsetY = drag.offsetY + event.clientY - drag.clientY;
    setPosition({
      x: cropArea.maxOffsetX > 0 ? clamp(nextOffsetX / cropArea.maxOffsetX, -1, 1) : 0,
      y: cropArea.maxOffsetY > 0 ? clamp(nextOffsetY / cropArea.maxOffsetY, -1, 1) : 0,
    });
  };

  const endPointerDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  };

  const handleStageKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!cropArea || isApplying) return;
    const step = event.shiftKey ? 20 : 6;
    const movements: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const movement = movements[event.key];
    if (!movement) return;

    event.preventDefault();
    const nextOffsetX = cropArea.offsetX + movement.x;
    const nextOffsetY = cropArea.offsetY + movement.y;
    setPosition({
      x: cropArea.maxOffsetX > 0 ? clamp(nextOffsetX / cropArea.maxOffsetX, -1, 1) : 0,
      y: cropArea.maxOffsetY > 0 ? clamp(nextOffsetY / cropArea.maxOffsetY, -1, 1) : 0,
    });
  };

  const handleApply = async () => {
    if (!cropArea || !imageRef.current || isApplying) return;
    setIsApplying(true);
    setError('');

    try {
      const croppedFile = await createCroppedLogoFile(imageRef.current, file, cropArea);
      await onApply(croppedFile);
      setIsApplying(false);
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Não foi possível aplicar o recorte.');
      setIsApplying(false);
    }
  };

  return createPortal(
    <div
      className="logo-crop-modal__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isApplying) onCancel();
      }}
    >
      <div
        ref={modalRef}
        className="logo-crop-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logo-crop-title"
      >
        <header className="logo-crop-modal__header">
          <div className="logo-crop-modal__title-wrap">
            <span className="logo-crop-modal__title-icon"><Crop size={20} /></span>
            <div>
              <h2 id="logo-crop-title">Recortar logotipo</h2>
              <p>Arraste a imagem e ajuste o zoom antes de enviar.</p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="logo-crop-modal__close"
            aria-label="Fechar editor de logotipo"
            onClick={onCancel}
            disabled={isApplying}
          >
            <X size={20} />
          </button>
        </header>

        <div className="logo-crop-modal__body">
          <div className="logo-crop-modal__formats" aria-label="Formato do recorte">
            {formatOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={format === option.value ? 'is-active' : ''}
                aria-pressed={format === option.value}
                onClick={() => selectFormat(option.value)}
                disabled={isApplying}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="logo-crop-modal__stage-wrap">
            <div
              ref={stageRef}
              className="logo-crop-modal__stage"
              style={cropRatio < 1
                ? { aspectRatio: String(cropRatio), height: 'min(420px, 52vh)', width: 'auto' }
                : { aspectRatio: String(cropRatio) }}
              role="group"
              tabIndex={0}
              aria-label="Área de recorte. Arraste a imagem ou use as setas do teclado para reposicionar."
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={endPointerDrag}
              onPointerCancel={endPointerDrag}
              onKeyDown={handleStageKeyDown}
            >
              <img
                ref={imageRef}
                src={sourceUrl}
                alt="Prévia do recorte do logotipo"
                draggable={false}
                onLoad={(event) => {
                  const image = event.currentTarget;
                  setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
                  setError('');
                }}
                onError={() => setError('Não foi possível abrir essa imagem.')}
                style={cropArea ? {
                  width: cropArea.renderedWidth,
                  height: cropArea.renderedHeight,
                  transform: `translate(calc(-50% + ${cropArea.offsetX}px), calc(-50% + ${cropArea.offsetY}px))`,
                  opacity: 1,
                } : { opacity: 0 }}
              />
              <span className="logo-crop-modal__grid" aria-hidden="true" />
              {!imageSize && <span className="logo-crop-modal__loading">Carregando imagem...</span>}
            </div>
            <p className="logo-crop-modal__drag-hint"><Move size={15} /> Arraste ou use as setas para reposicionar</p>
          </div>

          <div className="logo-crop-modal__zoom-row">
            <span>Zoom</span>
            <button type="button" aria-label="Diminuir zoom" onClick={() => setSafeZoom(zoom - 0.1)} disabled={isApplying || zoom <= 1}>
              <Minus size={17} />
            </button>
            <input
              type="range"
              min="1"
              max="5"
              step="0.05"
              value={zoom}
              aria-label="Zoom do recorte"
              aria-valuetext={`${Math.round(zoom * 100)}%`}
              onChange={(event) => setSafeZoom(Number(event.target.value))}
              disabled={isApplying}
            />
            <button type="button" aria-label="Aumentar zoom" onClick={() => setSafeZoom(zoom + 0.1)} disabled={isApplying || zoom >= 5}>
              <Plus size={17} />
            </button>
            <strong>{Math.round(zoom * 100)}%</strong>
          </div>

          <button type="button" className="logo-crop-modal__reset" onClick={resetPosition} disabled={isApplying}>
            <RotateCcw size={15} /> Reposicionar
          </button>

          {error && <div className="logo-crop-modal__error" role="alert">{error}</div>}
        </div>

        <footer className="logo-crop-modal__footer">
          <span>{file.name}</span>
          <div>
            <button type="button" className="logo-crop-modal__cancel" onClick={onCancel} disabled={isApplying}>
              Cancelar
            </button>
            <button type="button" className="logo-crop-modal__apply" onClick={handleApply} disabled={!cropArea || isApplying}>
              {isApplying ? 'Aplicando...' : 'Aplicar recorte'}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
};
