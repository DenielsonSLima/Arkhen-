export const OBRIGACOES_PAGE_SIZE = 20;

const OBRIGACOES_CATEGORY_ORDER = [
  'Fiscal',
  'Contábil',
  'Departamento Pessoal',
  'Trabalhista',
  'Financeiro',
  'Documentos',
  'Obrigações Acessórias',
  'Tributos',
  'NF-e',
  'NFC-e',
];

export interface ObrigacoesCategoryGroup<T> {
  category: string;
  items: T[];
}

const categoryPosition = (category: string) => {
  const position = OBRIGACOES_CATEGORY_ORDER.indexOf(category);
  return position === -1 ? OBRIGACOES_CATEGORY_ORDER.length : position;
};

export const sortObrigacoesByCategory = <T extends {
  categoria: string;
  nome: string;
  ativo?: boolean;
  ordem?: number;
}>(
  items: readonly T[],
): T[] => [...items].sort((left, right) => (
  categoryPosition(left.categoria) - categoryPosition(right.categoria)
  || left.categoria.localeCompare(right.categoria, 'pt-BR')
  || Number(right.ativo ?? true) - Number(left.ativo ?? true)
  || (left.ordem ?? 0) - (right.ordem ?? 0)
  || left.nome.localeCompare(right.nome, 'pt-BR')
));

export const groupObrigacoesByCategory = <T extends { categoria: string }>(
  items: readonly T[],
): ObrigacoesCategoryGroup<T>[] => {
  const grouped = new Map<string, T[]>();
  items.forEach((item) => {
    const category = item.categoria.trim() || 'Sem categoria';
    const current = grouped.get(category);
    if (current) current.push(item);
    else grouped.set(category, [item]);
  });
  return [...grouped.entries()].map(([category, categoryItems]) => ({
    category,
    items: categoryItems,
  }));
};

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
