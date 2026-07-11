import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { OutrosDebitosCard } from './OutrosDebitosCard';
import { OutrosDebitosFormModal } from './OutrosDebitosFormModal';

type FiltroStatus = 'mesAtual' | 'todos';
type OutrosDebitoItem = {
  id: string;
  data: string;
  descricao: string;
  categoria: string;
  valor: number;
  status: 'Concluído' | 'Pendente';
};

type OutrosDebitosTabProps = {
  onFormatCurrency: (value: number) => string;
  onFormatDate: (value: string) => string;
};

const SUBTABS: { id: FiltroStatus; label: string }[] = [
  { id: 'mesAtual', label: 'Mês atual' },
  { id: 'todos', label: 'Todos' },
];

const OUTROS_DEBITOS_INICIAIS: OutrosDebitoItem[] = [
  {
    id: 'od-1',
    data: '2026-07-02',
    descricao: 'Taxa de manutenção bancária',
    categoria: 'Taxas',
    valor: 98,
    status: 'Concluído',
  },
  {
    id: 'od-2',
    data: '2026-07-09',
    descricao: 'Multa administrativa',
    categoria: 'Multa',
    valor: 56,
    status: 'Concluído',
  },
];

export const OutrosDebitosTab: React.FC<OutrosDebitosTabProps> = ({
  onFormatCurrency,
  onFormatDate,
}) => {
  const [itens, setItens] = useState<OutrosDebitoItem[]>(OUTROS_DEBITOS_INICIAIS);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<FiltroStatus>('mesAtual');
  

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

  const onSubmit = (item: Omit<OutrosDebitoItem, 'id' | 'status'> & { descricao: string }) => {
    const novoItem: OutrosDebitoItem = {
      ...item,
      id: `od-${Date.now()}`,
      status: 'Concluído',
    };
    setItens((prev) => [novoItem, ...prev]);
    setShowForm(false);
  };

  const renderCards = () => {
    if (filtered.length === 0) {
      return (
        <div className="financeiro-empty-state">
          Nenhum débito localizado para os filtros selecionados.
        </div>
      );
    }

    return (
      <div className="financeiro-mes-grupo animate-slide-up" style={{ marginTop: 16 }}>
        <div className="financeiro-mes-titulo">{activeSubTab === 'mesAtual' ? 'Mês atual' : 'Todos'}</div>
        <div className="cobrancas-cards-grid">
          {filtered.map((item) => (
            <OutrosDebitosCard
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
              {showForm ? 'Fechar formulário' : 'Novo débito'}
            </button>
          </div>
        </div>
      </div>

      <OutrosDebitosFormModal isOpen={showForm} onSubmit={onSubmit} onClose={() => setShowForm(false)} />

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
          Nenhum débito localizado para os filtros selecionados.
        </div>
      ) : renderCards()}
    </div>
  );
};
