/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimulationPdfPreview } from './SimulationPdfPreview';

const createObjectURL = vi.fn();
const revokeObjectURL = vi.fn();

beforeEach(() => {
  createObjectURL.mockReset().mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second');
  revokeObjectURL.mockReset();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
});

afterEach(cleanup);

describe('SimulationPdfPreview', () => {
  it('anuncia carregamento, indisponibilidade e erros com a semântica adequada', () => {
    const { rerender } = render(<SimulationPdfPreview bytes={null} loading error="" />);
    expect(screen.getByRole('status').textContent).toContain('Gerando');

    rerender(<SimulationPdfPreview bytes={null} loading={false} error="Falha ao gerar" />);
    expect(screen.getByRole('alert').textContent).toBe('Falha ao gerar');

    rerender(<SimulationPdfPreview bytes={null} loading={false} error="" />);
    expect(screen.getByRole('status').textContent).toContain('indisponível');
  });

  it('cria e revoga URLs temporárias no ciclo de efeito', async () => {
    const { rerender, unmount } = render(
      <SimulationPdfPreview bytes={new Uint8Array([1])} loading={false} error="" />,
    );
    await waitFor(() => expect(screen.getByTitle('Pré-visualização do PDF')).toBeTruthy());
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    rerender(<SimulationPdfPreview bytes={new Uint8Array([2])} loading={false} error="" />);
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:first'));
    expect(createObjectURL).toHaveBeenCalledTimes(2);

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:second');
  });
});
