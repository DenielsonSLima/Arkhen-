import type { MarcaDaguaDados } from '../../../../marca-dagua/services/marcaDaguaService';
import { resolveMarcaDaguaMode, resolveMarcaDaguaPlacement } from '../../../../marca-dagua/services/marcaDaguaPresentation';

export interface NfseMarcaDagua {
  imagem: Uint8Array;
  opacidade: number;
  tamanho: number;
  posicao: MarcaDaguaDados['posicao'];
}

export async function carregarMarcaDagua(config: MarcaDaguaDados): Promise<NfseMarcaDagua | undefined> {
  if (!config.habilitado) return undefined;
  const portrait = resolveMarcaDaguaMode(config, 'portrait');
  if (!portrait.sourceUrl) throw new Error('A marca d’água Retrato está habilitada, mas não possui imagem cadastrada.');
  const response = await fetch(portrait.sourceUrl);
  if (!response.ok) throw new Error('Não foi possível carregar a marca d’água Retrato cadastrada para esta empresa.');
  return { imagem: new Uint8Array(await response.arrayBuffer()), opacidade: portrait.opacity,
    tamanho: portrait.size, posicao: portrait.position };
}

/** Mesma caixa e object-fit: contain utilizados na prévia das Configurações. */
export function geometriaMarcaDagua(marca: NfseMarcaDagua, imageWidth: number, imageHeight: number) {
  const p = resolveMarcaDaguaPlacement(marca.posicao, marca.tamanho, 'portrait');
  const box = { x: 210 * p.leftPercent / 100, y: 297 * p.topPercent / 100,
    width: 210 * p.widthPercent / 100, height: 297 * p.heightPercent / 100 };
  const scale = Math.min(box.width / imageWidth, box.height / imageHeight);
  const width = imageWidth * scale, height = imageHeight * scale;
  const x = marca.posicao === 'topo-esquerda' ? box.x
    : marca.posicao === 'centro' ? box.x + (box.width - width) / 2 : box.x + box.width - width;
  const y = marca.posicao === 'rodape-direita' ? box.y + box.height - height
    : marca.posicao === 'centro' ? box.y + (box.height - height) / 2 : box.y;
  return { x, y, width, height, opacity: Math.max(0, Math.min(100, marca.opacidade)) / 100 };
}
