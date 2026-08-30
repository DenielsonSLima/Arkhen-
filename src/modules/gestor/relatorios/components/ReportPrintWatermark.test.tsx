/** @vitest-environment jsdom */

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import { ReportPrintWatermark } from './ReportPrintWatermark';

describe('ReportPrintWatermark', () => {
  it('usa a configuração de retrato na impressão sem criar controles interativos', () => {
    const { container } = render(
      <ReportPrintWatermark
        config={{
          habilitado: true,
          fileUrl: null,
          fileUrlPaisagem: 'https://assets.example.com/paisagem.png',
          fileUrlRetrato: 'https://assets.example.com/retrato.png',
          posicao: 'centro',
          opacidade: 15,
          tamanho: 35,
          posicaoPaisagem: 'centro',
          posicaoRetrato: 'topo-esquerda',
          opacidadePaisagem: 10,
          opacidadeRetrato: 100,
          tamanhoPaisagem: 20,
          tamanhoRetrato: 80,
        }}
      />,
    );

    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    expect(image?.getAttribute('src')).toBe('https://assets.example.com/retrato.png');
    expect(image?.style.opacity).toBe('1');
    expect(image?.style.top).toBe('12mm');
    expect(image?.style.left).toBe('12mm');
    expect(container.querySelectorAll('button,input,select')).toHaveLength(0);
  });
});
