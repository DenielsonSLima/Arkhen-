import type { ClienteEmpresa } from '../services/atividadesService';
import type { RotinaCompanyGroup } from './rotinasWorkspace';

export const ROTINAS_COMPANIES_PER_PAGE = 12;

export interface RotinasCompanyFilters {
  search: string;
  partnerTypeId: string;
  taxRegime: string;
}

export const EMPTY_ROTINAS_COMPANY_FILTERS: RotinasCompanyFilters = {
  search: '',
  partnerTypeId: '',
  taxRegime: '',
};

export const normalizeCompanySearch = (value: unknown) => String(value ?? '')
  .trim()
  .toLocaleLowerCase('pt-BR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '');

export const filterRotinaCompanyGroups = (
  groups: readonly RotinaCompanyGroup<ClienteEmpresa>[],
  filters: RotinasCompanyFilters,
) => {
  const search = normalizeCompanySearch(filters.search);

  return groups.filter(({ cliente }) => {
    const matchesSearch = !search || [
      cliente.nome,
      cliente.cnpj,
      cliente.regime,
      cliente.tipoEstabelecimento,
      cliente.tipoParceiroNome,
    ].some((value) => normalizeCompanySearch(value).includes(search));

    return matchesSearch
      && (!filters.partnerTypeId || cliente.tipoParceiroId === filters.partnerTypeId)
      && (!filters.taxRegime || cliente.regime === filters.taxRegime);
  });
};

export const paginateRotinaCompanyGroups = <T,>(
  groups: readonly T[],
  page: number,
  pageSize = ROTINAS_COMPANIES_PER_PAGE,
) => {
  const totalPages = Math.max(1, Math.ceil(groups.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;

  return {
    currentPage,
    totalPages,
    items: groups.slice(start, start + pageSize),
    rangeStart: groups.length === 0 ? 0 : start + 1,
    rangeEnd: Math.min(start + pageSize, groups.length),
  };
};

export const getVisiblePageNumbers = (currentPage: number, totalPages: number) => {
  const count = Math.min(5, totalPages);
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - count + 1));
  return Array.from({ length: count }, (_, index) => start + index);
};
