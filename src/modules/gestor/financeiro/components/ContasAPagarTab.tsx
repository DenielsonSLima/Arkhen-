import React, { useMemo, useState, useEffect } from 'react';
import { Search, Calendar, CheckCircle2, ShieldAlert, CheckCircle, Clock, AlertTriangle, XCircle, Plus } from 'lucide-react';
import type { LancamentoFinanceiro } from '../services/financeiroService';
import './ContasAPagarTab.css';
import { AddContasAPagarModal } from './AddContasAPagarModal';

type FiltroStatus = 'todos' | 'aberto' | 'hoje' | 'atrasado' | 'pago' | 'cancelado';
type ContasAPagarTabProps = {
  dados: LancamentoFinanceiro[];
  onFormatCurrency: (value: number) => string;
  onFormatDate: (value: string) => string;
  onCreateContasAPagar?: (dados: any) => Promise<void>;
};

const toDate = (value: string) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const ContasAPagarTab: React.FC<ContasAPagarTabProps> = ({
  dados,
  onFormatCurrency,
  onFormatDate,
  onCreateContasAPagar,
}) => {
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas as categorias');
  const [activeFilterPill, setActiveFilterPill] = useState<FiltroStatus>('todos');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, startDate, endDate, selectedCategory, activeFilterPill]);

  const hoje = new Date().toISOString().slice(0, 10);
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const getCategory = (item: LancamentoFinanceiro) => {
    return item.categoria?.trim() || 'Despesas diversas';
  };

  const categories = useMemo(() => {
    const values = new Set<string>(dados.map((item) => getCategory(item)));
    return ['Todas as categorias', ...Array.from(values).sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  }, [dados]);

  // Calculate dynamic KPI Card metrics
  const kpis = useMemo(() => {
    const pagarHoje = dados.filter(i => i.status === 'Pendente' && i.dataCompetencia === hoje);
    const pagarHojeVal = pagarHoje.reduce((acc, i) => acc + i.valor, 0);

    const emAtraso = dados.filter(i => i.status === 'Pendente' && i.dataCompetencia < hoje);
    const emAtrasoVal = emAtraso.reduce((acc, i) => acc + i.valor, 0);

    const mesStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
    const pagoNoMes = dados.filter(i => i.status === 'Pago' && i.dataCompetencia.startsWith(mesStr));
    const pagoNoMesVal = pagoNoMes.reduce((acc, i) => acc + i.valor, 0);

    const previstoNoMes = dados.filter(i => i.dataCompetencia.startsWith(mesStr));
    const previstoNoMesVal = previstoNoMes.reduce((acc, i) => acc + i.valor, 0);

    const pendente = dados.filter(i => i.status === 'Pendente');
    const pendenteVal = pendente.reduce((acc, i) => acc + i.valor, 0);

    return {
      pagarHojeVal,
      pagarHojeQty: pagarHoje.length,
      emAtrasoVal,
      emAtrasoQty: emAtraso.length,
      pagoNoMesVal,
      pagoNoMesQty: pagoNoMes.length,
      previstoNoMesVal,
      previstoNoMesQty: previstoNoMes.length,
      pendenteVal,
      pendenteQty: pendente.length,
    };
  }, [dados, hoje, currentMonth, currentYear]);


  // Filter core dataset
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return dados.filter((item) => {
      // 1. Search filter
      const desc = item.descricao.toLowerCase();
      const cat = getCategory(item).toLowerCase();
      const valStr = String(item.valor);
      
      const matchesSearch =
        !term ||
        desc.includes(term) ||
        cat.includes(term) ||
        valStr.includes(term) ||
        item.id.toLowerCase().includes(term);

      // 2. Date filters
      const isAfterStart = !startDate || item.dataCompetencia >= startDate;
      const isBeforeEnd = !endDate || item.dataCompetencia <= endDate;

      // 3. Category filter
      const matchesCategory = selectedCategory === 'Todas as categorias' || cat === selectedCategory.toLowerCase();

      // 4. Pill status filter
      const isOverdue = item.status === 'Pendente' && item.dataCompetencia < hoje;
      let matchesPill = true;

      if (activeFilterPill === 'aberto') {
        matchesPill = item.status === 'Pendente' && !isOverdue;
      } else if (activeFilterPill === 'hoje') {
        matchesPill = item.status === 'Pendente' && item.dataCompetencia === hoje;
      } else if (activeFilterPill === 'atrasado') {
        matchesPill = isOverdue;
      } else if (activeFilterPill === 'pago') {
        matchesPill = item.status === 'Pago';
      } else if (activeFilterPill === 'cancelado') {
        matchesPill = item.status === 'Cancelado';
      }

      return matchesSearch && isAfterStart && isBeforeEnd && matchesCategory && matchesPill;
    });
  }, [dados, search, startDate, endDate, selectedCategory, activeFilterPill, hoje]);

  // Sliced pagination data
  const paginatedItems = useMemo(() => {
    return filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filtered, currentPage]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  // Pill counts helper
  const pillCounts = useMemo(() => {
    const aberto = dados.filter(i => {
      const isOverdue = i.status === 'Pendente' && i.dataCompetencia < hoje;
      return i.status === 'Pendente' && !isOverdue;
    }).length;

    const hojeQty = dados.filter(i => i.status === 'Pendente' && i.dataCompetencia === hoje).length;
    const atrasado = dados.filter(i => i.status === 'Pendente' && i.dataCompetencia < hoje).length;
    const pago = dados.filter(i => i.status === 'Pago').length;
    const cancelado = dados.filter(i => i.status === 'Cancelado').length;

    return {
      todos: dados.length,
      aberto,
      hoje: hojeQty,
      atrasado,
      pago,
      cancelado,
    };
  }, [dados, hoje]);

  // Helper to determine status badge metadata
  const getStatusBadge = (item: LancamentoFinanceiro) => {
    const isOverdue = item.status === 'Pendente' && item.dataCompetencia < hoje;
    if (item.status === 'Pago') {
      return { label: 'Pago', className: 'status-paid-badge', icon: <CheckCircle size={12} /> };
    }
    if (item.status === 'Cancelado') {
      return { label: 'Cancelado', className: 'status-cancelled-badge', icon: <XCircle size={12} /> };
    }
    if (isOverdue) {
      return { label: 'Em atraso', className: 'status-overdue-badge', icon: <AlertTriangle size={12} /> };
    }
    if (item.dataCompetencia === hoje) {
      return { label: 'Vence hoje', className: 'status-today-badge', icon: <Clock size={12} /> };
    }
    return { label: 'Em aberto', className: 'status-open-badge', icon: <Clock size={12} /> };
  };

  // Helper to calculate days remaining/overdue text
  const getDueHelperText = (item: LancamentoFinanceiro) => {
    if (item.status === 'Pago' || item.status === 'Cancelado') return null;
    
    const diffTime = toDate(item.dataCompetencia).getTime() - toDate(hoje).getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const positiveDays = Math.abs(diffDays);
      return <span style={{ color: '#ef4444', display: 'block', fontSize: '0.72rem', fontWeight: 600, marginTop: '2px' }}>{positiveDays} {positiveDays === 1 ? 'dia de atraso' : 'dias de atraso'}</span>;
    }
    if (diffDays === 0) {
      return <span style={{ color: '#f59e0b', display: 'block', fontSize: '0.72rem', fontWeight: 600, marginTop: '2px' }}>Vence hoje</span>;
    }
    return <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem', fontWeight: 500, marginTop: '2px' }}>Vence em {diffDays} {diffDays === 1 ? 'dia' : 'dias'}</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 5 KPI Cards in a Row */}
      <div className="financeiro-kpi-grid">
        <div className="financeiro-kpi-card hover-grow">
          <div className="kpi-icon-wrapper green">
            <CheckCircle2 size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-title">Pagar Hoje</span>
            <strong className="kpi-value">{onFormatCurrency(kpis.pagarHojeVal)}</strong>
            <span className="kpi-subtitle">{kpis.pagarHojeQty} {kpis.pagarHojeQty === 1 ? 'título' : 'títulos'}</span>
          </div>
        </div>

        <div className="financeiro-kpi-card hover-grow">
          <div className="kpi-icon-wrapper red">
            <ShieldAlert size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-title">Em Atraso</span>
            <strong className="kpi-value red-text">{onFormatCurrency(kpis.emAtrasoVal)}</strong>
            <span className="kpi-subtitle">{kpis.emAtrasoQty} {kpis.emAtrasoQty === 1 ? 'título' : 'títulos'}</span>
          </div>
        </div>

        <div className="financeiro-kpi-card hover-grow">
          <div className="kpi-icon-wrapper blue">
            <CheckCircle2 size={20} style={{ color: '#10b981' }} />
          </div>
          <div className="kpi-content">
            <span className="kpi-title">Pago no Mês</span>
            <strong className="kpi-value green-text">{onFormatCurrency(kpis.pagoNoMesVal)}</strong>
            <span className="kpi-subtitle">{kpis.pagoNoMesQty} {kpis.pagoNoMesQty === 1 ? 'título' : 'títulos'}</span>
          </div>
        </div>

        <div className="financeiro-kpi-card hover-grow">
          <div className="kpi-icon-wrapper purple">
            <Calendar size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-title">Previsto no Mês</span>
            <strong className="kpi-value purple-text">{onFormatCurrency(kpis.previstoNoMesVal)}</strong>
            <span className="kpi-subtitle">{kpis.previstoNoMesQty} {kpis.previstoNoMesQty === 1 ? 'título' : 'títulos'}</span>
          </div>
        </div>

        <div className="financeiro-kpi-card hover-grow">
          <div className="kpi-icon-wrapper black">
            <WalletIcon size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-title">Total Pendente</span>
            <strong className="kpi-value">{onFormatCurrency(kpis.pendenteVal)}</strong>
            <span className="kpi-subtitle">{kpis.pendenteQty} {kpis.pendenteQty === 1 ? 'título' : 'títulos'}</span>
          </div>
        </div>
      </div>

      {/* Pill Filter Subtabs */}
      <div className="financeiro-pills-row">
        <button className={`pill-btn ${activeFilterPill === 'todos' ? 'active' : ''}`} onClick={() => setActiveFilterPill('todos')}>
          Todos <span className="pill-count">{pillCounts.todos}</span>
        </button>
        <button className={`pill-btn ${activeFilterPill === 'aberto' ? 'active' : ''}`} onClick={() => setActiveFilterPill('aberto')}>
          Em aberto <span className="pill-count">{pillCounts.aberto}</span>
        </button>
        <button className={`pill-btn ${activeFilterPill === 'hoje' ? 'active' : ''}`} onClick={() => setActiveFilterPill('hoje')}>
          Vence hoje <span className="pill-count">{pillCounts.hoje}</span>
        </button>
        <button className={`pill-btn ${activeFilterPill === 'atrasado' ? 'active' : ''}`} onClick={() => setActiveFilterPill('atrasado')}>
          Em atraso <span className="pill-count red-bg">{pillCounts.atrasado}</span>
        </button>
        <button className={`pill-btn ${activeFilterPill === 'pago' ? 'active' : ''}`} onClick={() => setActiveFilterPill('pago')}>
          Pagos <span className="pill-count green-bg">{pillCounts.pago}</span>
        </button>
        <button className={`pill-btn ${activeFilterPill === 'cancelado' ? 'active' : ''}`} onClick={() => setActiveFilterPill('cancelado')}>
          Cancelados <span className="pill-count">{pillCounts.cancelado}</span>
        </button>
      </div>

      {/* Modern Horizontal Control & Filter Bar */}
      <div className="financeiro-controls-bar">
        <div className="financeiro-filters-group">
          <label className="financeiro-search-wrapper" style={{ flex: 1.5 }}>
            <Search size={15} className="financeiro-search-icon" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar descrição ou ID..."
            />
          </label>

          <div className="financeiro-date-range-group">
            <div className="date-group-inputs">
              <input value={startDate} onChange={(event) => setStartDate(event.target.value)} type="date" />
              <span className="date-separator">-</span>
              <input value={endDate} onChange={(event) => setEndDate(event.target.value)} type="date" />
            </div>
          </div>

          <select
            className="financeiro-select-filter"
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            style={{ flex: 0.8 }}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          {onCreateContasAPagar && (
            <button
              type="button"
              className="financeiro-dropdown-btn"
              style={{ marginLeft: 'auto' }}
              onClick={() => setShowAddModal(true)}
            >
              <Plus size={15} />
              <span>Novo contas a pagar</span>
            </button>
          )}
        </div>
      </div>

      {/* Unified Table View */}
      {filtered.length === 0 ? (
        <div className="financeiro-empty-state-box">
          <ShieldAlert size={36} style={{ color: '#94a3b8', marginBottom: '8px' }} />
          <strong>Nenhuma obrigação encontrada</strong>
          <span>Ajuste os filtros ou faça uma nova busca.</span>
        </div>
      ) : (
        <div className="financeiro-table-container animate-fade-in">
          <table className="financeiro-table">
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Status / Tipo</th>
                <th>Descrição / Categoria</th>
                <th style={{ width: '140px', textAlign: 'right' }}>Valor</th>
                <th style={{ width: '180px' }}>Vencimento / Pagamento</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item) => {
                const badge = getStatusBadge(item);
                const isItemOverdue = item.status === 'Pendente' && item.dataCompetencia < hoje;
                const tipoDespesa = item.metadados?.tipoDespesa === 'variavel' ? 'Variável' : 'Fixa';

                return (
                  <tr key={item.id} className={item.status === 'Pago' ? 'row-paid' : ''}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className={`status-badge-pill ${badge.className}`} style={{ width: 'fit-content' }}>
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, paddingLeft: '4px' }}>
                          Despesa {tipoDespesa}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span className="table-cell-desc bold" title={item.descricao}>{item.descricao}</span>
                        <span className="table-cell-category" style={{ fontSize: '0.75rem', color: '#64748b' }}>{getCategory(item)}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                      <strong className={`table-cell-value ${isItemOverdue ? 'overdue' : (item.status === 'Pago' ? 'paid' : '')}`}>
                        {onFormatCurrency(item.valor)}
                      </strong>
                    </td>
                    <td>
                      <div className="table-cell-date" style={{ gap: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 600 }}>{onFormatDate(item.dataCompetencia)}</span>
                          {getDueHelperText(item)}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: item.status === 'Pago' ? '#10b981' : '#94a3b8', fontWeight: 600 }}>
                          {item.status === 'Pago' && item.dataPagamento ? (
                            `Pago em: ${onFormatDate(item.dataPagamento.split('T')[0])}`
                          ) : (
                            'Em aberto'
                          )}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="financeiro-pagination-bar">
          <button 
            disabled={currentPage === 1} 
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          >
            Anterior
          </button>
          <span>Página {currentPage} de {totalPages}</span>
          <button 
            disabled={currentPage === totalPages} 
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          >
            Próxima
          </button>
        </div>
      )}
      {showAddModal && onCreateContasAPagar && (
        <AddContasAPagarModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSubmit={async (newDados) => {
            setIsSubmitLoading(true);
            try {
              await onCreateContasAPagar(newDados);
            } catch (err) {
              console.error(err);
            } finally {
              setIsSubmitLoading(false);
            }
          }}
          isLoading={isSubmitLoading}
        />
      )}
    </div>
  );
};

const WalletIcon = ({ size }: { size: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
  </svg>
);
