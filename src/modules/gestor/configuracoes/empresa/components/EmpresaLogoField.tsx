import { useRef, useState } from 'react';
import { Image as ImageIcon, Minus, Plus, RotateCcw, Upload } from 'lucide-react';
import { LogoCropModal } from './LogoCropModal';
import {
  clampLogoDisplaySize,
  LOGO_DISPLAY_SIZE_DEFAULT,
  LOGO_DISPLAY_SIZE_MAX,
  LOGO_DISPLAY_SIZE_MIN,
  validateLogoFile,
} from '../services/logoImageProcessor';
import './EmpresaLogoField.css';

interface EmpresaLogoFieldProps {
  previewUrl: string | null;
  displaySize: number;
  disabled: boolean;
  onDisplaySizeChange: (value: number) => void;
  onLogoUpload: (file: File) => Promise<void> | void;
}

export const EmpresaLogoField = ({
  previewUrl,
  displaySize,
  disabled,
  onDisplaySizeChange,
  onLogoUpload,
}: EmpresaLogoFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectionError, setSelectionError] = useState('');
  const safeDisplaySize = clampLogoDisplaySize(displaySize || LOGO_DISPLAY_SIZE_DEFAULT);

  const selectFile = (file?: File) => {
    if (!file || disabled) return;

    try {
      validateLogoFile(file);
      setSelectionError('');
      setPendingFile(file);
    } catch (error) {
      setSelectionError(error instanceof Error ? error.message : 'Selecione uma imagem válida.');
    }
  };

  const updateDisplaySize = (value: number) => {
    onDisplaySizeChange(clampLogoDisplaySize(value));
  };

  return (
    <section className="empresa-logo-field" aria-labelledby="empresa-logo-title">
      <div
        className={`empresa-logo-field__preview${isDragging ? ' is-dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          selectFile(event.dataTransfer.files?.[0]);
        }}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Logotipo atual da empresa"
            style={{ height: safeDisplaySize }}
          />
        ) : (
          <div className="empresa-logo-field__placeholder">
            <ImageIcon size={28} />
            <span>Sem logotipo</span>
          </div>
        )}
        <button
          type="button"
          className="empresa-logo-field__upload"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          <Upload size={17} />
          <span>{previewUrl ? 'Alterar e recortar' : 'Selecionar e recortar'}</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(event) => {
            selectFile(event.currentTarget.files?.[0]);
            event.currentTarget.value = '';
          }}
        />
      </div>

      <div className="empresa-logo-field__info">
        <div>
          <h3 id="empresa-logo-title">Logotipo da Empresa</h3>
          <p>Arraste ou selecione uma imagem para recortar, reposicionar e ampliar.</p>
          <span>PNG, JPG ou WebP · máximo de 5 MB</span>
        </div>

        {previewUrl && (
          <div className="empresa-logo-field__size-control">
            <div className="empresa-logo-field__size-heading">
              <label htmlFor="empresa-logo-size">Altura de exibição</label>
              <output htmlFor="empresa-logo-size">{safeDisplaySize}px</output>
            </div>
            <div className="empresa-logo-field__size-row">
              <button
                type="button"
                aria-label="Diminuir altura do logotipo"
                onClick={() => updateDisplaySize(safeDisplaySize - 5)}
                disabled={disabled || safeDisplaySize <= LOGO_DISPLAY_SIZE_MIN}
              >
                <Minus size={16} />
              </button>
              <input
                id="empresa-logo-size"
                type="range"
                min={LOGO_DISPLAY_SIZE_MIN}
                max={LOGO_DISPLAY_SIZE_MAX}
                step="5"
                value={safeDisplaySize}
                aria-valuetext={`${safeDisplaySize} pixels`}
                onChange={(event) => updateDisplaySize(Number(event.target.value))}
                disabled={disabled}
              />
              <button
                type="button"
                aria-label="Aumentar altura do logotipo"
                onClick={() => updateDisplaySize(safeDisplaySize + 5)}
                disabled={disabled || safeDisplaySize >= LOGO_DISPLAY_SIZE_MAX}
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="empresa-logo-field__size-meta">
              <span>{LOGO_DISPLAY_SIZE_MIN}px</span>
              <button
                type="button"
                onClick={() => updateDisplaySize(LOGO_DISPLAY_SIZE_DEFAULT)}
                disabled={disabled || safeDisplaySize === LOGO_DISPLAY_SIZE_DEFAULT}
              >
                <RotateCcw size={13} /> Restaurar 80px
              </button>
              <span>{LOGO_DISPLAY_SIZE_MAX}px</span>
            </div>
          </div>
        )}

        {selectionError && <div className="empresa-logo-field__error" role="alert">{selectionError}</div>}
      </div>

      {pendingFile && (
        <LogoCropModal
          file={pendingFile}
          onCancel={() => setPendingFile(null)}
          onApply={async (croppedFile) => {
            await onLogoUpload(croppedFile);
            setPendingFile(null);
          }}
        />
      )}
    </section>
  );
};
