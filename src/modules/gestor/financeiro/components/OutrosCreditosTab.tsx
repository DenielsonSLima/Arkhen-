import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { LancamentoFinanceiro } from '../services/financeiroService';
import { OutrosCreditosCard } from './OutrosCreditosCard';
import { OutrosCreditosFormModal } from './OutrosCreditosFormModal';

type FiltroStatus = 'mesAtual' | 'todos';
type OutrosCreditoItem = {
  id: string;
  data: string;
  descricao: string;
  categoria: string;
  valor: number;
  status: 'Concluído' | 'Pendente';
};

type OutrosCreditosTabProps = {
  dados: LancamentoFinanceiro[];
  onCreateLancamento: (dados: Pick<
    LancamentoFinanceiro,
    'tipo' | 'origem' | 'descricao' | 'categoria' | 'valor' | 'dataCompetencia' | 'status'
  > & Partial<Pick<LancamentoFinanceiro, 'contaBancariaId' | 'clienteEmpresaId' | 'dataPagamento' | 'referenciaId' | 'metadados'>>) => Promise<void>;
  onFormatCurrency: (value: number) => string;
  onFormatDate: (value: string) => string;
};

const SUBTABS: { id: FiltroStatus; label: string }[] = [
  { id: 'mesAtual', label: 'Mês atual' },
  { id: 'todos', label: 'Todos' },
];

export const OutrosCreditosTab: React.FC<OutrosCreditosTabProps> = ({
  dados,
  onCreateLancamento,
  onFormatCurrency,
  onFormatDate,
}) => {
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<FiltroStatus>('mesAtual');
  
  const itens = useMemo<OutrosCreditoItem[]>(() => dados.map((item) => ({
    id: item.id,
    data: item.dataCompetencia,
    descricao: item.descricao,
    categoria: item.categoria,
    valor: item.valor,
    status: item.status === 'Pendente' ? 'Pendente' : 'Concluído',
  })), [dados]);

  const baseFiltrado = useMemo(() => {
    const term = search.trim().toLowerCase();

    return itens.filter((item) => {
      const matchesSearch =
        !term ||
        item.descricao.toLowerCase().includes(term) ||
        item.categoria.toLowerCase().includes(term) ||
        item.id.toLowerCase().includes(term) ||
        String(item.valor).includes(term) ||
        onFormatDate(item.data).toLowerCase().includes(term);

      const isAfterStart = !startDate || item.data >= startDate;
      const isBeforeEnd = !endDate || item.data <= endDate;

      return matchesSearch && isAfterStart && isBeforeEnd;
    });
  }, [itens, search, startDate, endDate, onFormatDate]);

  const filtered = useMemo(() => {
    if (activeSubTab === 'todos') return baseFiltrado;

    const current = new Date();
    const currentMonth = current.getMonth() + 1;
    const currentYear = current.getFullYear();

    return baseFiltrado.filter((item) => {
      const [year, month] = item.data.split('-').map(Number);
      return month === currentMonth && year === currentYear;
    });
  }, [baseFiltrado, activeSubTab]);

  const onSubmit = async (item: Omit<OutrosCreditoItem, 'id' | 'status'> & { descricao: string }) => {
    await onCreateLancamento({
      tipo: 'receita',
      origem: 'outro_credito',
      descricao: item.descricao,
      categoria: item.categoria,
      valor: item.valor,
      dataCompetencia: item.data,
      dataPagamento: item.data,
      status: 'Pago',
    });
    setShowForm(false);
  };

  const renderCards = () => {
    if (filtered.length === 0) {
      return (
        <div className="financeiro-empty-state">
          Nenhum crédito localizado para os filtros selecionados.
        </div>
      );
    }

    return (
      <div className="financeiro-mes-grupo animate-slide-up" style={{ marginTop: 16 }}>
        <div className="financeiro-mes-titulo">{activeSubTab === 'mesAtual' ? 'Mês atual' : 'Todos'}</div>
        <div className="cobrancas-cards-grid">
          {filtered.map((item) => (
            <OutrosCreditosCard
              key={item.id}
              item={item}
              onFormatCurrency={onFormatCurrency}
              onFormatDate={onFormatDate}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="financeiro-controls-bar">
        <div className="financeiro-filters-group">
          <label className="financeiro-search-wrapper">
            <Search size={15} className="financeiro-search-icon" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar descrição, categoria ou identificação..."
            />
          </label>
          <div className="financeiro-date-filter">
            <span>Data inicial:</span>
            <input value={startDate} onChange={(event) => setStartDate(event.target.value)} type="date" />
            <span>Data final:</span>
            <input value={endDate} onChange={(event) => setEndDate(event.target.value)} type="date" />
          </div>
          
          <div className="financeiro-inline-action">
            <button
              className="financeiro-form-btn"
              type="button"
              onClick={() => setShowForm((prev) => !prev)}
            >
              {showForm ? 'Fechar formulário' : 'Novo crédito'}
            </button>
          </div>
        </div>
      </div>

      <OutrosCreditosFormModal isOpen={showForm} onSubmit={onSubmit} onClose={() => setShowForm(false)} />

      <div className="financeiro-subtabs-row">
        {SUBTABS.map((subtab) => (
          <button
            key={subtab.id}
            className={`btn-subtab ${activeSubTab === subtab.id ? 'active' : ''}`}
            onClick={() => setActiveSubTab(subtab.id)}
          >
            {subtab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="financeiro-empty-state">
          Nenhum crédito localizado para os filtros selecionados.
        </div>
      ) : renderCards()}
    </div>
  );
};
