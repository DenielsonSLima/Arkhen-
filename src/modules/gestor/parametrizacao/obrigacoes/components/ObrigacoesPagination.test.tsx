/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ObrigacoesPagination } from './ObrigacoesPagination';

afterEach(cleanup);

describe('ObrigacoesPagination', () => {
  it('informa o intervalo visível e navega entre páginas', () => {
    const onPageChange = vi.fn();

    render(
      <ObrigacoesPagination
        currentPage={2}
        totalPages={3}
        totalItems={15}
        firstItem={7}
        lastItem={12}
        onPageChange={onPageChange}
      />,
    );

    expect(screen.getByText('Exibindo 7–12 de 15')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ir para a página anterior' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ir para a próxima página' }));
    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
  });

  it('não ocupa espaço quando existe apenas uma página', () => {
    const { container } = render(
      <ObrigacoesPagination
        currentPage={1}
        totalPages={1}
        totalItems={4}
        firstItem={1}
        lastItem={4}
        onPageChange={vi.fn()}
      />,
    );

    expect(container.textContent).toBe('');
  });
});
