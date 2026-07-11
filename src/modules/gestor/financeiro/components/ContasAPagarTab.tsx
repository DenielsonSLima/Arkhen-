import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ContasAPagarCard } from './ContasAPagarCard';

type ContasPagarItem = {
  id: string;
  descricao: string;
  categoria: string;
  dataVencimento: string;
  dataLancamento: string;
  valor: number;
  status: 'Pendente' | 'Pago' | 'Vencido' | 'Cancelado';
};

const CONTAS_PAGAR: ContasPagarItem[] = [
  {
    id: 'pag-1',
    descricao: 'Aluguel do escritório',
    categoria: 'Custos Fixos',
    dataVencimento: '2026-07-10',
    dataLancamento: '2026-07-01',
    valor: 4200,
    status: 'Pendente',
  },
  {
    id: 'pag-2',
    descricao: 'Folha interna',
    categoria: 'Pessoal',
    dataVencimento: '2026-07-05',
    dataLancamento: '2026-06-28',
    valor: 18500,
    status: 'Pago',
  },
  {
    id: 'pag-3',
    descricao: 'Softwares e certificados',
    categoria: 'Tecnologia',
    dataVencimento: '2026-07-20',
    dataLancamento: '2026-07-02',
    valor: 1290,
    status: 'Pendente',
  },
  {
    id: 'pag-4',
    descricao: 'Taxa de cartório',
    categoria: 'Tributos',
    dataVencimento: '2026-06-15',
    dataLancamento: '2026-06-10',
    valor: 870,
    status: 'Vencido',
  },
];

type FiltroStatus = 'mesAtual' | 'aberto' | 'atrasado' | 'todos';
const SUBTABS: { id: FiltroStatus; label: string }[] = [
  { id: 'mesAtual', label: 'Mês atual' },
  { id: 'aberto', label: 'Em aberto' },
  { id: 'atrasado', label: 'Em atraso' },
  { id: 'todos', label: 'Todos' },
];

type FormaAgrupamento = 'mes' | 'categoria';

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const toDate = (value: string) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const statusToLabel = (status: ContasPagarItem['status']) => {
  if (status === 'Pago') return 'Pago';
  if (status === 'Vencido') return 'Em atraso';
  if (status === 'Cancelado') return 'Cancelado';
  return 'Em aberto';
};

type ContasAPagarTabProps = {
  onFormatCurrency: (value: number) => string;
  onFormatDate: (value: string) => string;
};

export const ContasAPagarTab: React.FC<ContasAPagarTabProps> = ({ onFormatCurrency, onFormatDate }) => {
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas as categorias');
  const [groupByMode, setGroupByMode] = useState<FormaAgrupamento>('mes');
  const [activeSubTab, setActiveSubTab] = useState<FiltroStatus>('mesAtual');
  

  const hoje = new Date().toISOString().slice(0, 10);
  const hojeDate = toDate(hoje);

  const categories = useMemo(() => {
    const values = new Set<string>(CONTAS_PAGAR.map((item) => item.categoria || 'Despesas diversas'));
    return ['Todas as categorias', ...Array.from(values).sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  }, []);

  const baseFiltrado = useMemo(() => {
    const term = search.trim().toLowerCase();
    return CONTAS_PAGAR.filter((item) => {
      const matchesSearch =
        !term ||
        item.descricao.toLowerCase().includes(term) ||
        statusToLabel(item.status).toLowerCase().includes(term) ||
        onFormatDate(item.dataVencimento).toLowerCase().includes(term);
      const isAfterStart = !startDate || item.dataVencimento >= startDate;
      const isBeforeEnd = !endDate || item.dataVencimento <= endDate;
      const matchesCategory = selectedCategory === 'Todas as categorias' || item.categoria === selectedCategory;
      return matchesSearch && isAfterStart && isBeforeEnd && matchesCategory;
    });
  }, [search, startDate, endDate, onFormatDate, selectedCategory]);

  const filtered = useMemo(() => {
    const current = new Date();
    const currentMonth = current.getMonth() + 1;
    const currentYear = current.getFullYear();

    return baseFiltrado.filter((item) => {
      const [year, month] = item.dataVencimento.split('-').map(Number);
      const isCurrentMonth = month === currentMonth && year === currentYear;
      const isOverdue = item.status === 'Vencido' || (item.status === 'Pendente' && toDate(item.dataVencimento) < hojeDate);

      if (activeSubTab === 'mesAtual') return isCurrentMonth;
      if (activeSubTab === 'aberto') return item.status === 'Pendente' && !isOverdue;
      if (activeSubTab === 'atrasado') return isOverdue;
      return true;
    });
  }, [baseFiltrado, activeSubTab, hoje]);

  const getMonthName = (value: string) => {
    const parts = value.split('-');
    const month = Number(parts[1]);
    const year = parts[0];
    return `${MONTHS[month - 1] || ''} de ${year}`;
  };

  const groupByMonth = (list: ContasPagarItem[]) => {
    const groups: Record<string, ContasPagarItem[]> = {};
    list
      .slice()
      .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))
      .forEach((item) => {
        const month = getMonthName(item.dataVencimento);
        if (!groups[month]) groups[month] = [];
        groups[month].push(item);
      });
    return groups;
  };

  const groupByCategory = (list: ContasPagarItem[]) => {
    const groups: Record<string, ContasPagarItem[]> = {};
    list
      .slice()
      .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))
      .forEach((item) => {
        const categoria = item.categoria || 'Despesas diversas';
        if (!groups[categoria]) groups[categoria] = [];
        groups[categoria].push(item);
      });
    return groups;
  };

  const renderCards = () => {
    const grouped = groupByMode === 'mes' ? groupByMonth(filtered) : groupByCategory(filtered);
    const months = Object.keys(grouped);

    if (filtered.length === 0) {
      return (
        <div className="financeiro-empty-state">
          Nenhuma conta localizada para os filtros selecionados.
        </div>
      );
    }

    return (
      <div className="financeiro-mes-grupo animate-slide-up" style={{ marginTop: 16 }}>
        {months.map((month) => (
          <div key={month} className="financeiro-mes-grupo">
            <h3 className="financeiro-mes-titulo">
              {groupByMode === 'mes' ? month : `Categoria: ${month}`}
            </h3>
            <div className="cobrancas-cards-grid">
              {grouped[month].map((item) => (
                <ContasAPagarCard
                  key={item.id}
                  item={item}
                  onFormatCurrency={onFormatCurrency}
                  onFormatDate={onFormatDate}
                  hoje={hoje}
                  categoria={item.categoria || 'Despesas diversas'}
                />
              ))}
            </div>
          </div>
        ))}
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
              placeholder="Buscar descrição..."
            />
          </label>
          <div className="financeiro-date-filter">
            <span>Data inicial:</span>
            <input value={startDate} onChange={(event) => setStartDate(event.target.value)} type="date" />
            <span>Data final:</span>
            <input value={endDate} onChange={(event) => setEndDate(event.target.value)} type="date" />
          </div>
          <select
            className="financeiro-select-filter"
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            className="financeiro-select-filter"
            value={groupByMode}
            onChange={(event) => setGroupByMode(event.target.value as FormaAgrupamento)}
          >
            <option value="mes">Agrupar por mês</option>
            <option value="categoria">Agrupar por categoria</option>
          </select>
          
        </div>
      </div>

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
          Nenhuma conta localizada para os filtros selecionados.
        </div>
      ) : renderCards()}
    </div>
  );
};
