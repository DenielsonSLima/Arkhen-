/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';

const jsPdfConstructor = vi.hoisted(() => vi.fn());

vi.mock('jspdf', () => ({ jsPDF: jsPdfConstructor }));

import { generateSimulationPdf, getImageDetails } from './generateSimulationPdf';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  jsPdfConstructor.mockReset();
});

describe('imagens do PDF de simulação', () => {
  it('converte SVG para PNG preservando a proporção antes de enviar ao jsPDF', async () => {
    class FakeImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      naturalWidth = 800;
      naturalHeight = 400;
      width = 800;
      height = 400;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', FakeImage);
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as never);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,converted');

    const details = await getImageDetails('data:image/svg+xml,%3Csvg%20viewBox=%220%200%20800%20400%22/%3E');

    expect(details).toEqual({ dataUrl: 'data:image/png;base64,converted', aspectRatio: 2 });
    expect(drawImage).toHaveBeenCalledWith(expect.any(FakeImage), 0, 0, 800, 400);
  });

  it('interrompe a geração se uma marca d’água habilitada não puder ser aplicada', async () => {
    const doc = {
      GState: class { constructor(_options: { opacity: number }) {} },
      setGState: vi.fn(),
      addImage: vi.fn(() => { throw new Error('imagem inválida'); }),
    };
    jsPdfConstructor.mockImplementation(function JsPdfMock() { return doc; });

    await expect(generateSimulationPdf({
      title: 'Rescisão',
      generatedAt: new Date('2026-08-31T22:00:00-03:00'),
      company: { razaoSocial: 'Empresa Teste' },
      sections: [],
      watermark: {
        enabled: true,
        dataUrl: 'data:image/png;base64,invalid',
        opacity: 100,
        size: 100,
        position: 'centro',
      },
    })).rejects.toThrow('Não foi possível aplicar a marca d’água Retrato configurada no PDF.');
  });

  it('ignora um logotipo SVG inválido sem impedir o relatório', async () => {
    class InvalidImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;

      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('Image', InvalidImage);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const doc = {
      addImage: vi.fn(),
      setFont: vi.fn(),
      setFontSize: vi.fn(),
      setTextColor: vi.fn(),
      splitTextToSize: vi.fn((text: string) => [text]),
      text: vi.fn(),
      setFillColor: vi.fn(),
      setDrawColor: vi.fn(),
      setLineWidth: vi.fn(),
      roundedRect: vi.fn(),
      line: vi.fn(),
      getNumberOfPages: vi.fn(() => 1),
      setPage: vi.fn(),
      output: vi.fn(() => new ArrayBuffer(8)),
    };
    jsPdfConstructor.mockImplementation(function JsPdfMock() { return doc; });

    await expect(generateSimulationPdf({
      title: 'Rescisão',
      generatedAt: new Date('2026-08-31T22:00:00-03:00'),
      company: {
        razaoSocial: 'Empresa Teste',
        logoDataUrl: 'data:image/svg+xml,%3Csvg%3Einvalido',
      },
      sections: [],
    })).resolves.toMatchObject({ pageCount: 1 });
    expect(doc.addImage).not.toHaveBeenCalled();
  });
});
