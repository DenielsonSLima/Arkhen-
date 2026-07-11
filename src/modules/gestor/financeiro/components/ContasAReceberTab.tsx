import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { CobrancaFinanceira } from '../services/financeiroService';
import { ContasAReceberCard } from './ContasAReceberCard';

type FiltroStatus = 'mesAtual' | 'aberto' | 'atrasado' | 'todos';
type ContasAReceberTabProps = {
  dados: CobrancaFinanceira[];
  onFormatCurrency: (value: number) => string;
  onFormatDate: (value: string) => string;
  getCompanyName: (companyId: string) => string;
};

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

const statusToLabel = (status: CobrancaFinanceira['status']) => {
  if (status === 'Pago') return 'Recebida';
  if (status === 'Vencido') return 'Em atraso';
  if (status === 'Cancelado') return 'Cancelada';
  return 'Em aberto';
};

export const ContasAReceberTab: React.FC<ContasAReceberTabProps> = ({
  dados,
  onFormatCurrency,
  onFormatDate,
  getCompanyName,
}) => {
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas as categorias');
  const [groupByMode, setGroupByMode] = useState<FormaAgrupamento>('mes');
  const [activeSubTab, setActiveSubTab] = useState<FiltroStatus>('mesAtual');
  

  const hoje = new Date().toISOString().slice(0, 10);
  const getCategory = (item: CobrancaFinanceira) => {
    const withCategory = item as CobrancaFinanceira & { categoria?: string };
    return withCategory.categoria?.trim() || 'Faturamento';
  };

  const categories = useMemo(() => {
    const values = new Set<string>(dados.map((item) => getCategory(item)));
    return ['Todas as categorias', ...Array.from(values).sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  }, [dados]);

  const baseFiltrado = useMemo(() => {
    const term = search.trim().toLowerCase();
    return dados.filter((item) => {
      const client = getCompanyName(item.clienteEmpresaId).toLowerCase();
      const statusLabel = statusToLabel(item.status).toLowerCase();
      const lancamento = onFormatDate(item.createdAt.slice(0, 10)).toLowerCase();
      const category = getCategory(item).toLowerCase();
      const matchesSearch = !term || client.includes(term) || statusLabel.includes(term) || item.id.toLowerCase().includes(term) || lancamento.includes(term);
      const dataBase = item.dataVencimento;
      const isAfterStart = !startDate || dataBase >= startDate;
      const isBeforeEnd = !endDate || dataBase <= endDate;
      const matchesCategory = selectedCategory === 'Todas as categorias' || category === selectedCategory.toLowerCase();

      return matchesSearch && isAfterStart && isBeforeEnd && matchesCategory;
    });
  }, [dados, search, startDate, endDate, selectedCategory, getCompanyName, onFormatDate]);

  const filtered = useMemo(() => {
    const current = new Date();
    const currentMonth = current.getMonth() + 1;
    const currentYear = current.getFullYear();

    return baseFiltrado.filter((item) => {
      const [year, month] = item.dataVencimento.split('-').map(Number);
      const isCurrentMonth = month === currentMonth && year === currentYear;
      const isOverdue = item.status === 'Vencido' || (item.status === 'Pendente' && toDate(item.dataVencimento) < toDate(hoje));

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

  const groupByMonth = (list: CobrancaFinanceira[]) => {
    const groups: Record<string, CobrancaFinanceira[]> = {};
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

  const groupByCategory = (list: CobrancaFinanceira[]) => {
    const groups: Record<string, CobrancaFinanceira[]> = {};
    list
      .slice()
      .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))
      .forEach((item) => {
        const category = getCategory(item);
        if (!groups[category]) {
          groups[category] = [];
        }
        groups[category].push(item);
      });
    return groups;
  };

  
  const renderCards = () => {
    const groups = groupByMode === 'mes' ? groupByMonth(filtered) : groupByCategory(filtered);
    return (
      <div className="financeiro-mes-grupo">
        {Object.entries(groups).map(([groupName, items]) => (
          <div key={groupName} className="financeiro-mes-grupo-wrapper animate-slide-up">
            <h4 className="financeiro-mes-titulo">{groupName}</h4>
            <div className="cobrancas-cards-grid" style={{ marginBottom: 24 }}>
              {items.map((item) => (
                <ContasAReceberCard 
                  key={item.id} 
                  item={item} 
                  onFormatCurrency={onFormatCurrency} 
                  onFormatDate={onFormatDate} 
                  getCompanyName={getCompanyName}
                  hoje={hoje}
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
              placeholder="Buscar cliente, status ou identificação..."
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
