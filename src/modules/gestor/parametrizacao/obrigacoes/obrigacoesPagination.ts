export const OBRIGACOES_PAGE_SIZE = 6;

export interface ObrigacoesPageSlice<T> {
  items: T[];
  currentPage: number;
  totalPages: number;
  firstItem: number;
  lastItem: number;
}

export const paginateObrigacoes = <T,>(
  items: T[],
  requestedPage: number,
  pageSize = OBRIGACOES_PAGE_SIZE,
): ObrigacoesPageSlice<T> => {
  const safePageSize = Math.max(1, Math.trunc(pageSize) || OBRIGACOES_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(items.length / safePageSize));
  const currentPage = Math.min(Math.max(1, Math.trunc(requestedPage) || 1), totalPages);
  const startIndex = (currentPage - 1) * safePageSize;
  const pageItems = items.slice(startIndex, startIndex + safePageSize);

  return {
    items: pageItems,
    currentPage,
    totalPages,
    firstItem: pageItems.length ? startIndex + 1 : 0,
    lastItem: startIndex + pageItems.length,
  };
};
