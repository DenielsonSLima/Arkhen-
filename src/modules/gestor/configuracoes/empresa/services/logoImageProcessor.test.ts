/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  calculateLogoCrop,
  clampLogoDisplaySize,
  createCroppedLogoFile,
  validateLogoFile,
} from './logoImageProcessor';

describe('calculateLogoCrop', () => {
  it('centraliza uma imagem horizontal em um recorte quadrado', () => {
    const crop = calculateLogoCrop({
      sourceWidth: 1200,
      sourceHeight: 600,
      viewportWidth: 300,
      viewportHeight: 300,
      zoom: 1,
      positionX: 0,
      positionY: 0,
    });

    expect(crop.x).toBeCloseTo(300);
    expect(crop.y).toBe(0);
    expect(crop.width).toBeCloseTo(600);
    expect(crop.height).toBeCloseTo(600);
    expect(crop.maxOffsetX).toBeCloseTo(150);
    expect(crop.maxOffsetY).toBe(0);
  });

  it('limita o deslocamento para não deixar espaço vazio no recorte', () => {
    const crop = calculateLogoCrop({
      sourceWidth: 1200,
      sourceHeight: 600,
      viewportWidth: 300,
      viewportHeight: 300,
      zoom: 1,
      positionX: 9,
      positionY: -9,
    });

    expect(crop.x).toBe(0);
    expect(crop.y).toBe(0);
    expect(crop.offsetX).toBe(crop.maxOffsetX);
  });
});

describe('logo validation and display size', () => {
  it('limita a altura de exibição ao intervalo de 30 a 240 pixels', () => {
    expect(clampLogoDisplaySize(10)).toBe(30);
    expect(clampLogoDisplaySize(157.6)).toBe(158);
    expect(clampLogoDisplaySize(500)).toBe(240);
  });

  it('aceita formatos estáticos e recusa GIF no editor', () => {
    expect(() => validateLogoFile(new File(['logo'], 'logo.png', { type: 'image/png' }))).not.toThrow();
    expect(() => validateLogoFile(new File(['logo'], 'logo.gif', { type: 'image/gif' }))).toThrow(/GIF/i);
  });
});

describe('createCroppedLogoFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('gera WebP com o maior lado limitado a 1600px', async () => {
    const drawImage = vi.fn();
    const context = {
      drawImage,
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['cropped-logo'], { type: 'image/webp' }));
    });

    const file = await createCroppedLogoFile(
      document.createElement('img'),
      new File(['original'], 'marca.png', { type: 'image/png' }),
      {
        x: 100,
        y: 50,
        width: 2000,
        height: 1000,
        renderedWidth: 0,
        renderedHeight: 0,
        offsetX: 0,
        offsetY: 0,
        maxOffsetX: 0,
        maxOffsetY: 0,
      },
    );

    expect(file.name).toBe('marca-recortada.webp');
    expect(file.type).toBe('image/webp');
    expect(drawImage).toHaveBeenCalledWith(
      expect.any(HTMLImageElement),
      100,
      50,
      2000,
      1000,
      0,
      0,
      1600,
      800,
    );
  });

  it('informa quando o canvas não está disponível', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    await expect(createCroppedLogoFile(
      document.createElement('img'),
      new File(['original'], 'marca.png', { type: 'image/png' }),
      {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        renderedWidth: 0,
        renderedHeight: 0,
        offsetX: 0,
        offsetY: 0,
        maxOffsetX: 0,
        maxOffsetY: 0,
      },
    )).rejects.toThrow(/suporte ao recorte/i);
  });
});
