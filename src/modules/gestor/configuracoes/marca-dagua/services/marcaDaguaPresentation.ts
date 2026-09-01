import type { MarcaDaguaDados } from './marcaDaguaService';

export type MarcaDaguaMode = 'landscape' | 'portrait';

type MarcaDaguaPosition = MarcaDaguaDados['posicao'];

export interface MarcaDaguaPlacement {
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  heightPercent: number;
  objectPosition: 'center' | 'top left' | 'top right' | 'bottom right';
}

const PAGE_SIZE = {
  landscape: { width: 297, height: 210 },
  portrait: { width: 210, height: 297 },
} as const;

const clampSize = (value: number) => Math.min(100, Math.max(10, Number.isFinite(value) ? value : 35));

export const resolveMarcaDaguaPlacement = (
  position: MarcaDaguaPosition,
  size: number,
  mode: MarcaDaguaMode,
): MarcaDaguaPlacement => {
  const page = PAGE_SIZE[mode];
  const scale = (clampSize(size) / 100) * (position === 'centro' ? 1 : 0.6);
  const width = page.width * scale;
  const height = page.height * scale;
  const edgeInset = 7;

  let left = (page.width - width) / 2;
  let top = (page.height - height) / 2;
  let objectPosition: MarcaDaguaPlacement['objectPosition'] = 'center';

  if (position === 'topo-esquerda') {
    left = edgeInset;
    top = edgeInset;
    objectPosition = 'top left';
  } else if (position === 'topo-direita') {
    left = page.width - edgeInset - width;
    top = edgeInset;
    objectPosition = 'top right';
  } else if (position === 'rodape-direita') {
    left = page.width - edgeInset - width;
    top = page.height - edgeInset - height;
    objectPosition = 'bottom right';
  }

  return {
    leftPercent: (left / page.width) * 100,
    topPercent: (top / page.height) * 100,
    widthPercent: scale * 100,
    heightPercent: scale * 100,
    objectPosition,
  };
};

export const resolveMarcaDaguaMode = (
  config: MarcaDaguaDados,
  mode: MarcaDaguaMode,
) => {
  const isLandscape = mode === 'landscape';
  return {
    sourceUrl: isLandscape
      ? config.fileUrlPaisagem || config.fileUrl
      : config.fileUrlRetrato || config.fileUrl,
    size: isLandscape
      ? config.tamanhoPaisagem ?? config.tamanho ?? 35
      : config.tamanhoRetrato ?? config.tamanho ?? 35,
    opacity: isLandscape
      ? config.opacidadePaisagem ?? config.opacidade ?? 15
      : config.opacidadeRetrato ?? config.opacidade ?? 15,
    position: isLandscape
      ? config.posicaoPaisagem ?? config.posicao ?? 'centro'
      : config.posicaoRetrato ?? config.posicao ?? 'centro',
  };
};
