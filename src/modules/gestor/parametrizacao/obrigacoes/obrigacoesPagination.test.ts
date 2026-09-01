import { describe, expect, it } from 'vitest';
import { OBRIGACOES_PAGE_SIZE, paginateObrigacoes } from './obrigacoesPagination';

describe('paginateObrigacoes', () => {
  const items = Array.from({ length: 15 }, (_, index) => `obrigacao-${index + 1}`);

  it('divide o catálogo em páginas de seis cards', () => {
    const page = paginateObrigacoes(items, 2);

    expect(OBRIGACOES_PAGE_SIZE).toBe(6);
    expect(page.items).toEqual(items.slice(6, 12));
    expect(page).toMatchObject({ currentPage: 2, totalPages: 3, firstItem: 7, lastItem: 12 });
  });

  it('ajusta uma página fora do intervalo após filtros ou remoções', () => {
    const page = paginateObrigacoes(items, 99);

    expect(page.items).toEqual(items.slice(12));
    expect(page).toMatchObject({ currentPage: 3, totalPages: 3, firstItem: 13, lastItem: 15 });
  });

  it('mantém a primeira página e um intervalo vazio quando não há resultados', () => {
    expect(paginateObrigacoes([], 3)).toEqual({
      items: [],
      currentPage: 1,
      totalPages: 1,
      firstItem: 0,
      lastItem: 0,
    });
  });
});
