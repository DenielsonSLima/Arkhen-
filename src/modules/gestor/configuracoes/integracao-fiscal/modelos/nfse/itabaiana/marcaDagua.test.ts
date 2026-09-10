import { afterEach, describe, expect, it, vi } from 'vitest';
import { carregarMarcaDagua, geometriaMarcaDagua } from './marcaDagua';
import type { MarcaDaguaDados } from '../../../../marca-dagua/services/marcaDaguaService';
import { createPdfLayout } from './pdfLayout';

const config: MarcaDaguaDados = {
  habilitado: true, fileUrl: '/legado.png', fileUrlRetrato: '/empresa/retrato.jpeg', fileUrlPaisagem: '/empresa/paisagem.jpeg',
  posicao: 'centro', opacidade: 15, tamanho: 35, posicaoRetrato: 'centro', opacidadeRetrato: 100, tamanhoRetrato: 100,
  posicaoPaisagem: 'topo-direita', opacidadePaisagem: 20, tamanhoPaisagem: 30,
};
afterEach(() => vi.unstubAllGlobals());
describe('Marca d’água cadastrada da NFS-e', () => {
  it('usa retrato, tamanho e opacidade salvos sem aplicar outra transparência', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new Uint8Array([1, 2]).buffer });
    vi.stubGlobal('fetch', fetcher);
    const marca = await carregarMarcaDagua(config);
    expect(fetcher).toHaveBeenCalledWith('/empresa/retrato.jpeg');
    expect(marca).toMatchObject({ posicao: 'centro', opacidade: 100, tamanho: 100 });
    const geometry = geometriaMarcaDagua(marca!, 210, 297);
    expect(geometry).toEqual({ x: 0, y: 0, width: 210, height: 297, opacity: 1 });
  });
  it('respeita desabilitado e não inventa marca textual ou fixa', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect(await carregarMarcaDagua({ ...config, habilitado: false })).toBeUndefined();
    expect(fetcher).not.toHaveBeenCalled();
    const pdf = createPdfLayout({ ambiente: 'producao', empresaNome: 'NÃO USAR COMO MARCA' }, '1').finish('');
    expect(pdf.output()).not.toContain('NÃO USAR COMO MARCA');
  });
  it('interrompe a geração se a marca habilitada estiver ausente ou falhar', async () => {
    await expect(carregarMarcaDagua({ ...config, fileUrl: null, fileUrlRetrato: null })).rejects.toThrow('não possui imagem');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(carregarMarcaDagua(config)).rejects.toThrow('Não foi possível carregar');
  });
  it('não compartilha a imagem entre empresas e preserva opacidade zero', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new Uint8Array([1]).buffer });
    vi.stubGlobal('fetch', fetcher);
    await carregarMarcaDagua(config);
    const outra = await carregarMarcaDagua({ ...config, fileUrlRetrato: '/outra/retrato.png', opacidadeRetrato: 0 });
    expect(fetcher.mock.calls).toEqual([['/empresa/retrato.jpeg'], ['/outra/retrato.png']]);
    expect(geometriaMarcaDagua(outra!, 210, 297).opacity).toBe(0);
  });
  it('preserva proporções, tamanho e posições da prévia cadastrada', () => {
    const imagem = new Uint8Array();
    const marca = { imagem, opacidade: 45, tamanho: 50, posicao: 'topo-direita' as const };
    const geometry = geometriaMarcaDagua(marca, 200, 100);
    expect(geometry).toMatchObject({ y: 7, width: 63, height: 31.5, opacity: 0.45 });
    expect(geometry.x).toBeCloseTo(140);
    expect(geometriaMarcaDagua({ ...marca, posicao: 'rodape-direita' }, 200, 100).y).toBe(258.5);
  });
});
