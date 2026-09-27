import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, FilterX, Search, SlidersHorizontal } from 'lucide-react';
import type { ClienteEmpresa } from '../../services/atividadesService';
import type { RotinaCompanyGroup } from '../../utils/rotinasWorkspace';
import {
  filterRotinaCompanyGroups,
  EMPTY_ROTINAS_COMPANY_FILTERS,
  getVisiblePageNumbers,
  paginateRotinaCompanyGroups,
  type RotinasCompanyFilters,
} from '../../utils/rotinasCompanyDirectory';
import { RotinasCompanyGrid } from './RotinasCompanyGrid';
import './RotinasCompanyDirectory.css';

interface RotinasCompanyDirectoryProps {
  groups: RotinaCompanyGroup<ClienteEmpresa>[];
  filters: RotinasCompanyFilters;
  page: number;
  onOpenCompany: (companyId: string) => void;
  onFiltersChange: (filters: RotinasCompanyFilters) => void;
  onPageChange: (page: number) => void;
}

const sortLabels = (left: string, right: string) => (
  left.localeCompare(right, 'pt-BR', { sensitivity: 'base' })
);

export const RotinasCompanyDirectory: React.FC<RotinasCompanyDirectoryProps> = ({
  groups,
  filters,
  page,
  onOpenCompany,
  onFiltersChange,
  onPageChange,
}) => {
  const partnerTypes = useMemo(() => {
    const options = new Map<string, string>();
    groups.forEach(({ cliente }) => {
      if (cliente.tipoParceiroId) {
        options.set(
          cliente.tipoParceiroId,
          cliente.tipoParceiroNome || 'Tipo de parceiro não identificado',
        );
      }
    });
    return [...options.entries()].sort((left, right) => sortLabels(left[1], right[1]));
  }, [groups]);
  const taxRegimes = useMemo(() => (
    [...new Set(groups.map(({ cliente }) => cliente.regime).filter(Boolean))].sort(sortLabels)
  ), [groups]);
  const filteredGroups = useMemo(
    () => filterRotinaCompanyGroups(groups, filters),
    [filters, groups],
  );
  const pagination = useMemo(
    () => paginateRotinaCompanyGroups(filteredGroups, page),
    [filteredGroups, page],
  );
  const pageNumbers = getVisiblePageNumbers(pagination.currentPage, pagination.totalPages);
  const hasFilters = Boolean(filters.search || filters.partnerTypeId || filters.taxRegime);

  const updateFilter = (key: keyof RotinasCompanyFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
    onPageChange(1);
  };

  const clearFilters = () => {
    onFiltersChange(EMPTY_ROTINAS_COMPANY_FILTERS);
    onPageChange(1);
  };

  return (
    <section className="rotinas-company-directory" aria-label="Empresas com rotinas">
      <div className="rotinas-company-filters">
        <div className="rotinas-company-search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={filters.search}
            onChange={(event) => updateFilter('search', event.target.value)}
            placeholder="Buscar por parceiro ou CNPJ..."
            aria-label="Buscar parceiros"
          />
        </div>

        <select
          value={filters.partnerTypeId}
          onChange={(event) => updateFilter('partnerTypeId', event.target.value)}
          aria-label="Filtrar por tipo de parceiro"
        >
          <option value="">Todos os tipos de parceiro</option>
          {partnerTypes.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>

        <select
          value={filters.taxRegime}
          onChange={(event) => updateFilter('taxRegime', event.target.value)}
          aria-label="Filtrar por regime tributário"
        >
          <option value="">Todos os regimes tributários</option>
          {taxRegimes.map((regime) => <option key={regime} value={regime}>{regime}</option>)}
        </select>

        {hasFilters ? (
          <button
            type="button"
            className="rotinas-company-clear"
            onClick={clearFilters}
          >
            <FilterX size={15} /> Limpar
          </button>
        ) : null}
      </div>

      <div className="rotinas-company-results" role="status" aria-live="polite">
        <span><SlidersHorizontal size={14} /> {filteredGroups.length} {filteredGroups.length === 1 ? 'parceiro encontrado' : 'parceiros encontrados'}</span>
        {filteredGroups.length > 0 ? (
          <span>Exibindo {pagination.rangeStart}–{pagination.rangeEnd} de {filteredGroups.length}</span>
        ) : null}
      </div>

      {filteredGroups.length === 0 ? (
        <div className="rotinas-empty">
          <Search size={34} />
          <h3>Nenhum parceiro encontrado</h3>
          <p>Ajuste a busca ou remova os filtros de tipo de parceiro e regime tributário.</p>
          {hasFilters ? (
            <button
              type="button"
              className="rotinas-button rotinas-button--secondary"
              onClick={clearFilters}
            >
              <FilterX size={14} /> Limpar filtros
            </button>
          ) : null}
        </div>
      ) : (
        <RotinasCompanyGrid groups={pagination.items} onOpenCompany={onOpenCompany} />
      )}

      {pagination.totalPages > 1 ? (
        <nav className="rotinas-pagination" aria-label="Paginação de parceiros">
          <button
            type="button"
            onClick={() => onPageChange(pagination.currentPage - 1)}
            disabled={pagination.currentPage === 1}
            aria-label="Página anterior"
          >
            <ChevronLeft size={16} /> Anterior
          </button>
          <div className="rotinas-pagination__pages">
            {pageNumbers.map((pageNumber) => (
              <button
                type="button"
                key={pageNumber}
                className={pageNumber === pagination.currentPage ? 'is-active' : ''}
                onClick={() => onPageChange(pageNumber)}
                aria-label={`Página ${pageNumber}`}
                aria-current={pageNumber === pagination.currentPage ? 'page' : undefined}
              >
                {pageNumber}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onPageChange(pagination.currentPage + 1)}
            disabled={pagination.currentPage === pagination.totalPages}
            aria-label="Próxima página"
          >
            Próxima <ChevronRight size={16} />
          </button>
        </nav>
      ) : null}
    </section>
  );
};
