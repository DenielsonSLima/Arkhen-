import { describe, expect, it } from 'vitest';
import { resolveWatermarkDimensions } from './watermarkGeometry';

describe('resolveWatermarkDimensions', () => {
  it('faz 100% ocupar a área inteira da página A4 para uma marca retrato', () => {
    expect(resolveWatermarkDimensions(210, 297, 210 / 297, 100)).toEqual({
      width: 210,
      height: 297,
    });
  });

  it('reduz proporcionalmente a dimensão configurada sem impor margem oculta', () => {
    expect(resolveWatermarkDimensions(210, 297, 210 / 297, 50)).toEqual({
      width: 105,
      height: 148.5,
    });
  });
});
