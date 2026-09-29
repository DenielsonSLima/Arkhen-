import { describe, expect, it } from 'vitest';
import {
  OBRIGACOES_PAGE_SIZE,
  groupObrigacoesByCategory,
  paginateObrigacoes,
  sortObrigacoesByCategory,
} from './obrigacoesPagination';

describe('paginateObrigacoes', () => {
  const items = Array.from({ length: 45 }, (_, index) => `obrigacao-${index + 1}`);

  it('divide o catálogo em páginas de vinte cards', () => {
    const page = paginateObrigacoes(items, 2);

    expect(OBRIGACOES_PAGE_SIZE).toBe(20);
    expect(page.items).toEqual(items.slice(20, 40));
    expect(page).toMatchObject({ currentPage: 2, totalPages: 3, firstItem: 21, lastItem: 40 });
  });

  it('ajusta uma página fora do intervalo após filtros ou remoções', () => {
    const page = paginateObrigacoes(items, 99);

    expect(page.items).toEqual(items.slice(40));
    expect(page).toMatchObject({ currentPage: 3, totalPages: 3, firstItem: 41, lastItem: 45 });
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

describe('agrupamento do catálogo de obrigações', () => {
  it('ordena e agrupa as obrigações por área', () => {
    const items = [
      { id: 'financeiro', nome: 'Caixa', categoria: 'Financeiro' },
      { id: 'fiscal-b', nome: 'SPED', categoria: 'Fiscal' },
      { id: 'contabil', nome: 'Balancete', categoria: 'Contábil' },
      { id: 'fiscal-a', nome: 'DCTFWeb', categoria: 'Fiscal' },
    ];

    const groups = groupObrigacoesByCategory(sortObrigacoesByCategory(items));

    expect(groups.map((group) => group.category)).toEqual(['Fiscal', 'Contábil', 'Financeiro']);
    expect(groups[0].items.map((item) => item.nome)).toEqual(['DCTFWeb', 'SPED']);
  });
});
