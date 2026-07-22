import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Search, Calendar, CheckCircle2, Clipboard, ShieldAlert, CheckCircle, Clock, AlertTriangle, XCircle, ExternalLink, TrendingUp, Wallet } from 'lucide-react';
import type { CobrancaFinanceira } from '../services/financeiroService';
import './ContasAReceberTab.css';
import '../../faturamento/Faturamento.css';

type FiltroStatus = 'todos' | 'aberto' | 'hoje' | 'atrasado' | 'recebido' | 'cancelado';
type ContasAReceberTabProps = {
  dados: CobrancaFinanceira[];
  onFormatCurrency: (value: number) => string;
  onFormatDate: (value: string) => string;
  getCompanyName: (companyId: string) => string;
  getCompanyDetails: (companyId: string) => { nome: string; cnpj: string };
  onManualSettlement: (item: CobrancaFinanceira) => void;
  isManualSettlementLoading: boolean;
};

const toDate = (value: string) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const ContasAReceberTab: React.FC<ContasAReceberTabProps> = ({
  dados,
  onFormatCurrency,
  onFormatDate,
  getCompanyName,
  getCompanyDetails,
  onManualSettlement,
  isManualSettlementLoading,
}) => {
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas as categorias');
  const [activeFilterPill, setActiveFilterPill] = useState<FiltroStatus>('todos');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemsPerPage = 8;

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, startDate, endDate, selectedCategory, activeFilterPill]);

  const hoje = new Date().toISOString().slice(0, 10);
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const getCategory = (item: CobrancaFinanceira) => {
    const withCategory = item as CobrancaFinanceira & { categoria?: string };
    return withCategory.categoria?.trim() || 'Faturamento';
  };

  const categories = useMemo(() => {
    const values = new Set<string>(dados.map((item) => getCategory(item)));
    return ['Todas as categorias', ...Array.from(values).sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  }, [dados]);



  // Calculate dynamic KPI Card metrics
  const kpis = useMemo(() => {
    const receberHoje = dados.filter(i => i.status === 'Pendente' && i.dataVencimento === hoje);
    const receberHojeVal = receberHoje.reduce((acc, i) => acc + i.valor, 0);

    const emAtraso = dados.filter(i => i.status === 'Vencido' || (i.status === 'Pendente' && i.dataVencimento < hoje));
    const emAtrasoVal = emAtraso.reduce((acc, i) => acc + i.valor, 0);

    const mesStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
    const recebidoNoMes = dados.filter(i => i.status === 'Pago' && i.dataVencimento.startsWith(mesStr));
    const recebidoNoMesVal = recebidoNoMes.reduce((acc, i) => acc + i.valor, 0);

    const previstoNoMes = dados.filter(i => i.dataVencimento.startsWith(mesStr));
    const previstoNoMesVal = previstoNoMes.reduce((acc, i) => acc + i.valor, 0);

    const pendente = dados.filter(i => i.status === 'Pendente' || i.status === 'Vencido');
    const pendenteVal = pendente.reduce((acc, i) => acc + i.valor, 0);

    return {
      receberHojeVal,
      receberHojeQty: receberHoje.length,
      emAtrasoVal,
      emAtrasoQty: emAtraso.length,
      recebidoNoMesVal,
      recebidoNoMesQty: recebidoNoMes.length,
      previstoNoMesVal,
      previstoNoMesQty: previstoNoMes.length,
      pendenteVal,
      pendenteQty: pendente.length,
    };
  }, [dados, hoje, currentMonth, currentYear]);

  // Handle link copying
  const handleCopyLink = async (item: CobrancaFinanceira) => {
    const link = item.bankSlipPdfUrl || item.bankSlipUrl || item.paymentUrl || '';
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(item.id);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        copyTimerRef.current = null;
        setCopiedId(null);
      }, 1600);
    } catch (error) {
      console.warn('[Financeiro] Não foi possível copiar o link de pagamento.', error);
    }
  };

  // Filter core dataset
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const termClean = term.replace(/\D/g, '');

    return dados.filter((item) => {
      // 1. Search filter
      const client = getCompanyName(item.clienteEmpresaId).toLowerCase();
      const details = getCompanyDetails(item.clienteEmpresaId);
      const cnpj = details.cnpj.replace(/\D/g, '');
      const desc = item.descricao.toLowerCase();
      const cat = getCategory(item).toLowerCase();
      const valStr = String(item.valor);

      const matchesSearch =
        !term ||
        client.includes(term) ||
        cnpj.includes(termClean) ||
        desc.includes(term) ||
        cat.includes(term) ||
        valStr.includes(term) ||
        item.id.toLowerCase().includes(term);

      // 2. Date filters
      const isAfterStart = !startDate || item.dataVencimento >= startDate;
      const isBeforeEnd = !endDate || item.dataVencimento <= endDate;

      // 3. Category filter
      const matchesCategory = selectedCategory === 'Todas as categorias' || cat === selectedCategory.toLowerCase();

      // 4. Pill status filter
      const isOverdue = item.status === 'Vencido' || (item.status === 'Pendente' && toDate(item.dataVencimento) < toDate(hoje));
      let matchesPill = true;

      if (activeFilterPill === 'aberto') {
        matchesPill = item.status === 'Pendente' && !isOverdue;
      } else if (activeFilterPill === 'hoje') {
        matchesPill = item.status === 'Pendente' && item.dataVencimento === hoje;
      } else if (activeFilterPill === 'atrasado') {
        matchesPill = isOverdue;
      } else if (activeFilterPill === 'recebido') {
        matchesPill = item.status === 'Pago';
      } else if (activeFilterPill === 'cancelado') {
        matchesPill = item.status === 'Cancelado';
      }

      return matchesSearch && isAfterStart && isBeforeEnd && matchesCategory && matchesPill;
    });
  }, [dados, search, startDate, endDate, selectedCategory, activeFilterPill, hoje, getCompanyName, getCompanyDetails]);

  // Sliced pagination data
  const paginatedItems = useMemo(() => {
    return filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filtered, currentPage]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  // Pill counts helper
  const pillCounts = useMemo(() => {
    const aberto = dados.filter(i => {
      const isOverdue = i.status === 'Vencido' || (i.status === 'Pendente' && toDate(i.dataVencimento) < toDate(hoje));
      return i.status === 'Pendente' && !isOverdue;
    }).length;

    const hojeQty = dados.filter(i => i.status === 'Pendente' && i.dataVencimento === hoje).length;
    const atrasado = dados.filter(i => i.status === 'Vencido' || (i.status === 'Pendente' && toDate(i.dataVencimento) < toDate(hoje))).length;
    const recebido = dados.filter(i => i.status === 'Pago').length;
    const cancelado = dados.filter(i => i.status === 'Cancelado').length;

    return {
      todos: dados.length,
      aberto,
      hoje: hojeQty,
      atrasado,
      recebido,
      cancelado,
    };
  }, [dados, hoje]);

  // Helper to determine status badge metadata
  const getStatusBadge = (item: CobrancaFinanceira) => {
    const isOverdue = item.status === 'Vencido' || (item.status === 'Pendente' && toDate(item.dataVencimento) < toDate(hoje));
    if (item.status === 'Pago') {
      return { label: 'Recebido', className: 'status-paid-badge', icon: <CheckCircle size={12} /> };
    }
    if (item.status === 'Cancelado') {
      return { label: 'Cancelado', className: 'status-cancelled-badge', icon: <XCircle size={12} /> };
    }
    if (isOverdue) {
      return { label: 'Em atraso', className: 'status-overdue-badge', icon: <AlertTriangle size={12} /> };
    }
    if (item.dataVencimento === hoje) {
      return { label: 'Vence hoje', className: 'status-today-badge', icon: <Clock size={12} /> };
    }
    return { label: 'Em aberto', className: 'status-open-badge', icon: <Clock size={12} /> };
  };

  // Helper to calculate days remaining/overdue text
  const getDueHelperText = (item: CobrancaFinanceira) => {
    if (item.status === 'Pago' || item.status === 'Cancelado') return null;

    const diffTime = toDate(item.dataVencimento).getTime() - toDate(hoje).getTime();
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
            <span className="kpi-title">Receber Hoje</span>
            <strong className="kpi-value">{onFormatCurrency(kpis.receberHojeVal)}</strong>
            <span className="kpi-subtitle">{kpis.receberHojeQty} {kpis.receberHojeQty === 1 ? 'título' : 'títulos'}</span>
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
            <TrendingUp size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-title">Recebido no Mês</span>
            <strong className="kpi-value blue-text">{onFormatCurrency(kpis.recebidoNoMesVal)}</strong>
            <span className="kpi-subtitle">{kpis.recebidoNoMesQty} {kpis.recebidoNoMesQty === 1 ? 'título' : 'títulos'}</span>
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
            <Wallet size={20} />
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
        <button className={`pill-btn ${activeFilterPill === 'recebido' ? 'active' : ''}`} onClick={() => setActiveFilterPill('recebido')}>
          Recebidos <span className="pill-count green-bg">{pillCounts.recebido}</span>
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
              placeholder="Buscar descrição, cliente, ID..."
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
        </div>
      </div>

      {/* Unified Table View */}
      {filtered.length === 0 ? (
        <div className="financeiro-empty-state-box">
          <ShieldAlert size={36} style={{ color: '#94a3b8', marginBottom: '8px' }} />
          <strong>Nenhuma cobrança encontrada</strong>
          <span>Ajuste os filtros ou faça uma nova busca.</span>
        </div>
      ) : (
        <div className="financeiro-table-container animate-fade-in">
          <table className="financeiro-table">
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Status / Meio</th>
                <th>Cliente</th>
                <th>Descrição / Categoria</th>
                <th style={{ width: '140px', textAlign: 'right' }}>Valor</th>
                <th style={{ width: '180px' }}>Vencimento / Pagamento</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item) => {
                const badge = getStatusBadge(item);
                const isItemOverdue = item.status === 'Vencido' || (item.status === 'Pendente' && toDate(item.dataVencimento) < toDate(hoje));
                const paymentLink = item.bankSlipPdfUrl || item.bankSlipUrl || item.paymentUrl || '';
                const details = getCompanyDetails(item.clienteEmpresaId);

                return (
                  <tr key={item.id} className={item.status === 'Pago' ? 'row-paid' : ''}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className={`status-badge-pill ${badge.className}`} style={{ width: 'fit-content' }}>
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, paddingLeft: '4px' }}>
                          {item.meioPagamento || 'Não informado'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="table-cell-client">
                        <strong>{getCompanyName(item.clienteEmpresaId)}</strong>
                        <small>CNPJ {details.cnpj || '-'}</small>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span className="table-cell-desc" title={item.descricao} style={{ fontWeight: 600 }}>{item.descricao}</span>
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
                          <span style={{ fontWeight: 600 }}>{onFormatDate(item.dataVencimento)}</span>
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
                    <td style={{ textAlign: 'right' }}>
                      <div className="faturamento-table-actions">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(item)}
                          disabled={!paymentLink}
                          title={copiedId === item.id ? 'Copiado!' : 'Copiar link de pagamento'}
                        >
                          {copiedId === item.id ? <CheckCircle size={16} style={{ color: '#10b981' }} /> : <Clipboard size={16} />}
                        </button>
                        {paymentLink ? (
                          <a
                            href={paymentLink}
                            target="_blank"
                            rel="noreferrer"
                            title="Abrir cobrança Banco Inter"
                          >
                            <ExternalLink size={16} />
                          </a>
                        ) : (
                          <button type="button" disabled title="Cobrança sem documento bancário">
                            <ExternalLink size={16} />
                          </button>
                        )}
                        {(item.status === 'Pendente' || item.status === 'Vencido' || isItemOverdue) && (
                          <button
                            type="button"
                            className="table-action-btn-success"
                            onClick={() => onManualSettlement(item)}
                            disabled={isManualSettlementLoading || item.bankProvider === 'inter'}
                            title={item.bankProvider === 'inter'
                              ? 'Baixa do Banco Inter indisponível até existir cancelamento e conciliação'
                              : 'Dar baixa manual'}
                          >
                            <CheckCircle2 size={13} />
                            <span>Baixar</span>
                          </button>
                        )}
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
    </div>
  );
};
