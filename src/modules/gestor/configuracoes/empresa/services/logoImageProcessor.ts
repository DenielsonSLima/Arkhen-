export const MAX_LOGO_FILE_SIZE = 5 * 1024 * 1024;
export const LOGO_DISPLAY_SIZE_MIN = 30;
export const LOGO_DISPLAY_SIZE_MAX = 240;
export const LOGO_DISPLAY_SIZE_DEFAULT = 80;

const SUPPORTED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export interface LogoCropParameters {
  sourceWidth: number;
  sourceHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  zoom: number;
  positionX: number;
  positionY: number;
}

export interface LogoCropArea {
  x: number;
  y: number;
  width: number;
  height: number;
  renderedWidth: number;
  renderedHeight: number;
  offsetX: number;
  offsetY: number;
  maxOffsetX: number;
  maxOffsetY: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const clampLogoDisplaySize = (value: number) => (
  clamp(Math.round(value), LOGO_DISPLAY_SIZE_MIN, LOGO_DISPLAY_SIZE_MAX)
);

export const validateLogoFile = (file: File) => {
  if (!SUPPORTED_LOGO_TYPES.has(file.type)) {
    throw new Error('Use uma imagem PNG, JPG ou WebP. GIF animado não é compatível com o recorte.');
  }

  if (file.size > MAX_LOGO_FILE_SIZE) {
    throw new Error('A imagem deve ter no máximo 5 MB.');
  }
};

export const calculateLogoCrop = ({
  sourceWidth,
  sourceHeight,
  viewportWidth,
  viewportHeight,
  zoom,
  positionX,
  positionY,
}: LogoCropParameters): LogoCropArea => {
  if (sourceWidth <= 0 || sourceHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    throw new Error('Não foi possível calcular o recorte da imagem.');
  }

  const safeZoom = clamp(zoom, 1, 5);
  const coverScale = Math.max(viewportWidth / sourceWidth, viewportHeight / sourceHeight);
  const renderedScale = coverScale * safeZoom;
  const renderedWidth = sourceWidth * renderedScale;
  const renderedHeight = sourceHeight * renderedScale;
  const maxOffsetX = Math.max(0, (renderedWidth - viewportWidth) / 2);
  const maxOffsetY = Math.max(0, (renderedHeight - viewportHeight) / 2);
  const offsetX = clamp(positionX, -1, 1) * maxOffsetX;
  const offsetY = clamp(positionY, -1, 1) * maxOffsetY;
  const imageLeft = (viewportWidth - renderedWidth) / 2 + offsetX;
  const imageTop = (viewportHeight - renderedHeight) / 2 + offsetY;

  return {
    x: clamp(-imageLeft / renderedScale, 0, sourceWidth),
    y: clamp(-imageTop / renderedScale, 0, sourceHeight),
    width: Math.min(viewportWidth / renderedScale, sourceWidth),
    height: Math.min(viewportHeight / renderedScale, sourceHeight),
    renderedWidth,
    renderedHeight,
    offsetX,
    offsetY,
    maxOffsetX,
    maxOffsetY,
  };
};

const outputFileName = (originalName: string, mimeType: string) => {
  const baseName = originalName.replace(/\.[^.]+$/, '') || 'logo';
  return `${baseName}-recortada.${mimeType === 'image/webp' ? 'webp' : 'png'}`;
};

const canvasToBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (!blob) {
      reject(new Error('O navegador não conseguiu gerar a imagem recortada.'));
      return;
    }
    resolve(blob);
  }, 'image/webp', 0.92);
});

export const createCroppedLogoFile = async (
  image: HTMLImageElement,
  originalFile: File,
  crop: LogoCropArea,
) => {
  const maxOutputEdge = 1600;
  const outputScale = Math.min(1, maxOutputEdge / Math.max(crop.width, crop.height));
  const outputWidth = Math.max(1, Math.round(crop.width * outputScale));
  const outputHeight = Math.max(1, Math.round(crop.height * outputScale));
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('O navegador não oferece suporte ao recorte de imagens.');
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  const blob = await canvasToBlob(canvas);
  if (blob.size > MAX_LOGO_FILE_SIZE) {
    throw new Error('A imagem recortada ficou maior que 5 MB. Aumente o recorte ou use outra imagem.');
  }

  const outputMimeType = blob.type || 'image/webp';
  return new File([blob], outputFileName(originalFile.name, outputMimeType), {
    type: outputMimeType,
    lastModified: Date.now(),
  });
};
