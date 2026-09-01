import type { MarcaDaguaDados } from '../../configuracoes/marca-dagua/services/marcaDaguaService';
import {
  resolveMarcaDaguaMode,
  resolveMarcaDaguaPlacement,
} from '../../configuracoes/marca-dagua/services/marcaDaguaPresentation';
import type { SimulationPdfWatermark } from './simulationPdfTypes';

const clamp = (value: number, min: number, max: number) => (
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
);

export const resolvePortraitWatermarkSnapshot = (
  config: MarcaDaguaDados | null | undefined,
): Omit<SimulationPdfWatermark, 'dataUrl' | 'aspectRatio'> & { sourceUrl: string | null } => {
  if (!config) {
    return { enabled: false, sourceUrl: null, opacity: 15, size: 35, position: 'centro' };
  }
  const resolved = resolveMarcaDaguaMode(config, 'portrait');
  return {
    enabled: config.habilitado,
    sourceUrl: resolved.sourceUrl,
    opacity: clamp(resolved.opacity, 0, 100),
    size: clamp(resolved.size, 10, 100),
    position: resolved.position,
  };
};

interface WatermarkGeometryInput {
  watermark: SimulationPdfWatermark;
  pageWidth: number;
  pageHeight: number;
}

export interface WatermarkGeometry {
  opacity: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const resolveWatermarkGeometry = ({
  watermark,
  pageWidth,
  pageHeight,
}: WatermarkGeometryInput): WatermarkGeometry => {
  const size = clamp(watermark.size ?? 35, 10, 100) / 100;
  const opacity = clamp(watermark.opacity ?? 15, 0, 100) / 100;
  const position = watermark.position ?? 'centro';
  const mode = pageWidth > pageHeight ? 'landscape' : 'portrait';
  const placement = resolveMarcaDaguaPlacement(position, size * 100, mode);
  const boxX = pageWidth * placement.leftPercent / 100;
  const boxY = pageHeight * placement.topPercent / 100;
  const maxWidth = pageWidth * placement.widthPercent / 100;
  const maxHeight = pageHeight * placement.heightPercent / 100;
  const aspectRatio = watermark.aspectRatio && watermark.aspectRatio > 0
    ? watermark.aspectRatio
    : 1;

  let width = maxWidth;
  let height = width / aspectRatio;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  let x = boxX + ((maxWidth - width) / 2);
  let y = boxY + ((maxHeight - height) / 2);
  if (position === 'topo-esquerda') {
    x = boxX;
    y = boxY;
  } else if (position === 'topo-direita') {
    x = boxX + maxWidth - width;
    y = boxY;
  } else if (position === 'rodape-direita') {
    x = boxX + maxWidth - width;
    y = boxY + maxHeight - height;
  }

  return { opacity, x, y, width, height };
};
