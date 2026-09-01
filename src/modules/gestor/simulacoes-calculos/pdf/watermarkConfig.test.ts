import { describe, expect, it } from 'vitest';
import type { MarcaDaguaDados } from '../../configuracoes/marca-dagua/services/marcaDaguaService';
import {
  resolvePortraitWatermarkSnapshot,
  resolveWatermarkGeometry,
} from './watermarkConfig';

const config: MarcaDaguaDados = {
  habilitado: true,
  fileUrl: null,
  fileUrlPaisagem: 'landscape.png',
  fileUrlRetrato: 'portrait.png',
  posicao: 'topo-esquerda',
  opacidade: 15,
  tamanho: 35,
  posicaoPaisagem: 'topo-direita',
  posicaoRetrato: 'centro',
  opacidadePaisagem: 20,
  opacidadeRetrato: 100,
  tamanhoPaisagem: 40,
  tamanhoRetrato: 100,
};

describe('contrato da marca d’água na simulação de Rescisão', () => {
  it('propaga a configuração Retrato completa até o compositor', () => {
    expect(resolvePortraitWatermarkSnapshot(config)).toEqual({
      enabled: true,
      sourceUrl: 'portrait.png',
      opacity: 100,
      size: 100,
      position: 'centro',
    });
  });

  it('não reduz 100% de opacidade nem 100% de tamanho', () => {
    const geometry = resolveWatermarkGeometry({
      watermark: {
        enabled: true,
        dataUrl: 'data:image/png;base64,AA==',
        opacity: 100,
        size: 100,
        position: 'centro',
        aspectRatio: 2,
      },
      pageWidth: 210,
      pageHeight: 297,
    });

    expect(geometry.opacity).toBe(1);
    expect(geometry.width).toBe(210);
    expect(geometry.height).toBe(105);
    expect(geometry.x).toBe(0);
    expect(geometry.y).toBe(96);
  });

  it('usa uma arte A4 em 100% como fundo da folha A4 inteira', () => {
    const geometry = resolveWatermarkGeometry({
      watermark: {
        enabled: true,
        opacity: 100,
        size: 100,
        position: 'centro',
        aspectRatio: 2480 / 3508,
      },
      pageWidth: 210,
      pageHeight: 297,
    });

    expect(geometry.x).toBeCloseTo(0, 1);
    expect(geometry.y).toBe(0);
    expect(geometry.width).toBeCloseTo(210, 1);
    expect(geometry.height).toBe(297);
  });

  it('mantém a escala de canto igual à prévia da configuração', () => {
    const geometry = resolveWatermarkGeometry({
      watermark: {
        enabled: true,
        opacity: 70,
        size: 100,
        position: 'topo-direita',
        aspectRatio: 2,
      },
      pageWidth: 210,
      pageHeight: 297,
    });

    expect(geometry.width).toBeCloseTo(126);
    expect(geometry.x).toBeCloseTo(77);
    expect(geometry.y).toBe(7);
  });
});
