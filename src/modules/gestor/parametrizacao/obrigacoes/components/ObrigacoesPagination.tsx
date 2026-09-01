import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ObrigacoesPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  firstItem: number;
  lastItem: number;
  onPageChange: (page: number) => void;
}

export const ObrigacoesPagination = ({
  currentPage,
  totalPages,
  totalItems,
  firstItem,
  lastItem,
  onPageChange,
}: ObrigacoesPaginationProps) => {
  if (totalPages <= 1) return null;

  return (
    <nav className="obrigacoes-pagination" aria-label="Paginação das obrigações">
      <span className="obrigacoes-pagination__summary" aria-live="polite">
        Exibindo {firstItem}–{lastItem} de {totalItems}
      </span>
      <div className="obrigacoes-pagination__controls">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Ir para a página anterior"
        >
          <ChevronLeft size={16} />
          <span>Anterior</span>
        </button>
        <span className="obrigacoes-pagination__position">
          Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
        </span>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Ir para a próxima página"
        >
          <span>Próxima</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
};
