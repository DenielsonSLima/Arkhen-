import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Calendar,
  CheckCircle2,
  ShieldAlert,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Clipboard,
  Share2,
  Download,
  ExternalLink,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { gestaoEmpresarialService } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import type { Company } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { useCobrancasFinanceirasQuery } from '../../financeiro/queries/useFinanceiroQueries';
import type { CobrancaFinanceira } from '../../financeiro/services/financeiroService';
import {
  copyTextToClipboard,
  downloadCobrancaBankSlip,
  formatCobrancaCurrency,
  formatCobrancaDate,
  getCobrancaAccessLabel,
  getCobrancaBankSlipLink,
  getPublicCobrancaLink,
} from '../cobrancas/utils/cobrancaLinks';
import './HistoricoFinanceiroTab.css';

type FiltroStatus = 'todos' | 'aberto' | 'hoje' | 'atrasado' | 'recebido' | 'cancelado';

const toDate = (value: string) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const HistoricoFinanceiroTab = () => {
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedType, setSelectedType] = useState('Todos');
  const [activeFilterPill, setActiveFilterPill] = useState<FiltroStatus>('todos');
  const [copiedId, setCopiedId] = useState('');
  const [downloadingId, setDownloadingId] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const cobrancasQuery = useCobrancasFinanceirasQuery();
  const clientesQuery = useQuery({
    queryKey: ['gestao-empresarial', 'companies'],
    queryFn: gestaoEmpresarialService.getCompanies,
  });

  const companyMap = useMemo(() => {
    const map = new Map<string, Company>();
    (clientesQuery.data || []).forEach((c) => map.set(c.id, c));
    return map;
  }, [clientesQuery.data]);

  const dados = cobrancasQuery.data || [];

  useEffect(() => {
    setCurrentPage(1);
  }, [search, startDate, endDate, selectedType, activeFilterPill]);

  const hoje = new Date().toISOString().slice(0, 10);
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // KPI metrics
  const kpis = useMemo(() => {
    const receberHoje = dados.filter(i => i.status === 'Pendente' && i.dataVencimento === hoje);
    const emAtraso = dados.filter(i => i.status === 'Vencido' || (i.status === 'Pendente' && i.dataVencimento < hoje));
    const mesStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
    const recebidoNoMes = dados.filter(i => i.status === 'Pago' && i.dataVencimento.startsWith(mesStr));
    const previstoNoMes = dados.filter(i => i.dataVencimento.startsWith(mesStr));
    const pendente = dados.filter(i => i.status === 'Pendente' || i.status === 'Vencido');

    return {
      receberHojeVal: receberHoje.reduce((a, i) => a + i.valor, 0),
      receberHojeQty: receberHoje.length,
      emAtrasoVal: emAtraso.reduce((a, i) => a + i.valor, 0),
      emAtrasoQty: emAtraso.length,
      recebidoNoMesVal: recebidoNoMes.reduce((a, i) => a + i.valor, 0),
      recebidoNoMesQty: recebidoNoMes.length,
      previstoNoMesVal: previstoNoMes.reduce((a, i) => a + i.valor, 0),
      previstoNoMesQty: previstoNoMes.length,
      pendenteVal: pendente.reduce((a, i) => a + i.valor, 0),
      pendenteQty: pendente.length,
    };
  }, [dados, hoje, currentMonth, currentYear]);

  // Pill counts
  const pillCounts = useMemo(() => {
    const aberto = dados.filter(i => {
      const overdue = i.status === 'Vencido' || (i.status === 'Pendente' && toDate(i.dataVencimento) < toDate(hoje));
      return i.status === 'Pendente' && !overdue;
    }).length;
    return {
      todos: dados.length,
      aberto,
      hoje: dados.filter(i => i.status === 'Pendente' && i.dataVencimento === hoje).length,
      atrasado: dados.filter(i => i.status === 'Vencido' || (i.status === 'Pendente' && toDate(i.dataVencimento) < toDate(hoje))).length,
      recebido: dados.filter(i => i.status === 'Pago').length,
      cancelado: dados.filter(i => i.status === 'Cancelado').length,
    };
  }, [dados, hoje]);

  // Filtering
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return dados.filter((item) => {
      const cliente = companyMap.get(item.clienteEmpresaId);
      const clienteName = (cliente?.nome || '').toLowerCase();
      const cnpj = (cliente?.cnpj || '').replace(/\D/g, '');
      const termClean = term.replace(/\D/g, '');
      const desc = item.descricao.toLowerCase();

      const matchesSearch = !term || clienteName.includes(term) || cnpj.includes(termClean) || desc.includes(term) || item.id.toLowerCase().includes(term);
      const isAfterStart = !startDate || item.dataVencimento >= startDate;
      const isBeforeEnd = !endDate || item.dataVencimento <= endDate;
      const matchesType = selectedType === 'Todos' || item.meioPagamento === selectedType;

      const isOverdue = item.status === 'Vencido' || (item.status === 'Pendente' && toDate(item.dataVencimento) < toDate(hoje));
      let matchesPill = true;
      if (activeFilterPill === 'aberto') matchesPill = item.status === 'Pendente' && !isOverdue;
      else if (activeFilterPill === 'hoje') matchesPill = item.status === 'Pendente' && item.dataVencimento === hoje;
      else if (activeFilterPill === 'atrasado') matchesPill = isOverdue;
      else if (activeFilterPill === 'recebido') matchesPill = item.status === 'Pago';
      else if (activeFilterPill === 'cancelado') matchesPill = item.status === 'Cancelado';

      return matchesSearch && isAfterStart && isBeforeEnd && matchesType && matchesPill;
    });
  }, [dados, search, startDate, endDate, selectedType, activeFilterPill, hoje, companyMap]);

  const paginatedItems = useMemo(() => filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [filtered, currentPage]);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  // Status badge helper
  const getStatusBadge = (item: CobrancaFinanceira) => {
    const isOverdue = item.status === 'Vencido' || (item.status === 'Pendente' && toDate(item.dataVencimento) < toDate(hoje));
    if (item.status === 'Pago') return { label: 'Recebido', className: 'paid', icon: <CheckCircle size={12} /> };
    if (item.status === 'Cancelado') return { label: 'Cancelado', className: 'cancelled', icon: <XCircle size={12} /> };
    if (isOverdue) return { label: 'Em atraso', className: 'overdue', icon: <AlertTriangle size={12} /> };
    if (item.dataVencimento === hoje) return { label: 'Vence hoje', className: 'today', icon: <Clock size={12} /> };
    return { label: 'Em aberto', className: 'open', icon: <Clock size={12} /> };
  };

  // Due date helper text
  const getDueHelperText = (item: CobrancaFinanceira) => {
    if (item.status === 'Pago' || item.status === 'Cancelado') return null;
    const diffTime = toDate(item.dataVencimento).getTime() - toDate(hoje).getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      const pos = Math.abs(diffDays);
      return <span style={{ color: '#ef4444', display: 'block', fontSize: '0.72rem', fontWeight: 600, marginTop: '2px' }}>{pos} {pos === 1 ? 'dia de atraso' : 'dias de atraso'}</span>;
    }
    if (diffDays === 0) return <span style={{ color: '#f59e0b', display: 'block', fontSize: '0.72rem', fontWeight: 600, marginTop: '2px' }}>Vence hoje</span>;
    return <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem', fontWeight: 500, marginTop: '2px' }}>Vence em {diffDays} {diffDays === 1 ? 'dia' : 'dias'}</span>;
  };

  // Actions
  const showFeedback = (type: 'success' | 'error', message: string, timeout = 2200) => {
    setFeedbackType(type);
    setFeedback(message);
    window.setTimeout(() => setFeedback(''), timeout);
  };

  const buildShareLink = (item: CobrancaFinanceira) => getPublicCobrancaLink(item, companyMap.get(item.clienteEmpresaId));

  const copyChargeLink = async (item: CobrancaFinanceira) => {
    const link = buildShareLink(item);
    if (!link) return;
    try {
      await copyTextToClipboard(link);
      showFeedback('success', 'Link copiado.');
      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId(''), 1800);
    } catch {
      showFeedback('error', 'Não foi possível copiar.');
    }
  };

  const shareChargeLink = async (item: CobrancaFinanceira) => {
    const link = buildShareLink(item);
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Cobrança Arkhen', text: `Cobrança ${item.descricao || ''} - ${formatCobrancaCurrency(item.valor)}`, url: link });
        return;
      } catch { /* fallback to copy */ }
    }
    await copyChargeLink(item);
  };

  const openChargePage = (item: CobrancaFinanceira) => {
    const link = buildShareLink(item);
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  const downloadBankSlip = async (item: CobrancaFinanceira) => {
    const bankSlipLink = getCobrancaBankSlipLink(item);
    if (!bankSlipLink) return;
    try {
      setDownloadingId(item.id);
      await downloadCobrancaBankSlip(item);
      showFeedback('success', 'Boleto baixado.');
    } catch {
      showFeedback('error', 'Erro ao baixar boleto.');
    } finally {
      setDownloadingId('');
    }
  };

  const isLoading = cobrancasQuery.isLoading || clientesQuery.isLoading;

  if (isLoading) return <div className="sub-loading">Carregando cobranças...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {feedback && (
        <div className={`faturamento-list-feedback ${feedbackType}`}>
          {feedbackType === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{feedback}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="fat-fin-kpi-grid">
        <KpiCard icon={<CheckCircle2 size={20} />} iconColor="green" title="Receber Hoje" value={formatCobrancaCurrency(kpis.receberHojeVal)} subtitle={`${kpis.receberHojeQty} ${kpis.receberHojeQty === 1 ? 'título' : 'títulos'}`} />
        <KpiCard icon={<ShieldAlert size={20} />} iconColor="red" title="Em Atraso" value={formatCobrancaCurrency(kpis.emAtrasoVal)} valueColor="red" subtitle={`${kpis.emAtrasoQty} ${kpis.emAtrasoQty === 1 ? 'título' : 'títulos'}`} />
        <KpiCard icon={<TrendingUp size={20} />} iconColor="blue" title="Recebido no Mês" value={formatCobrancaCurrency(kpis.recebidoNoMesVal)} valueColor="blue" subtitle={`${kpis.recebidoNoMesQty} ${kpis.recebidoNoMesQty === 1 ? 'título' : 'títulos'}`} />
        <KpiCard icon={<Calendar size={20} />} iconColor="purple" title="Previsto no Mês" value={formatCobrancaCurrency(kpis.previstoNoMesVal)} valueColor="purple" subtitle={`${kpis.previstoNoMesQty} ${kpis.previstoNoMesQty === 1 ? 'título' : 'títulos'}`} />
        <KpiCard icon={<WalletSvg size={20} />} iconColor="black" title="Total Pendente" value={formatCobrancaCurrency(kpis.pendenteVal)} subtitle={`${kpis.pendenteQty} ${kpis.pendenteQty === 1 ? 'título' : 'títulos'}`} />
      </div>

      {/* Pill Filters */}
      <div className="fat-fin-pills-row">
        <PillButton label="Todos" count={pillCounts.todos} active={activeFilterPill === 'todos'} onClick={() => setActiveFilterPill('todos')} />
        <PillButton label="Em aberto" count={pillCounts.aberto} active={activeFilterPill === 'aberto'} onClick={() => setActiveFilterPill('aberto')} />
        <PillButton label="Vence hoje" count={pillCounts.hoje} active={activeFilterPill === 'hoje'} onClick={() => setActiveFilterPill('hoje')} />
        <PillButton label="Em atraso" count={pillCounts.atrasado} active={activeFilterPill === 'atrasado'} onClick={() => setActiveFilterPill('atrasado')} countClass="red-bg" />
        <PillButton label="Recebidos" count={pillCounts.recebido} active={activeFilterPill === 'recebido'} onClick={() => setActiveFilterPill('recebido')} countClass="green-bg" />
        <PillButton label="Cancelados" count={pillCounts.cancelado} active={activeFilterPill === 'cancelado'} onClick={() => setActiveFilterPill('cancelado')} />
      </div>

      {/* Search & Filter Controls */}
      <div className="fat-fin-controls-bar">
        <div className="fat-fin-filters-group">
          <label className="fat-fin-search-wrapper" style={{ flex: 1.5 }}>
            <Search size={15} className="fat-fin-search-icon" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar descrição, parceiro, ID..." />
          </label>

          <div className="fat-fin-date-range-group">
            <div className="fat-fin-date-inputs">
              <input value={startDate} onChange={(e) => setStartDate(e.target.value)} type="date" />
              <span className="fat-fin-date-separator">-</span>
              <input value={endDate} onChange={(e) => setEndDate(e.target.value)} type="date" />
            </div>
          </div>

          <select className="fat-fin-select-filter" value={selectedType} onChange={(e) => setSelectedType(e.target.value)} style={{ flex: 0.6 }}>
            <option value="Todos">Todos os tipos</option>
            <option value="Ambos">Boleto + Pix</option>
            <option value="Pix">Pix</option>
            <option value="Boleto">Boleto</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="fat-fin-empty-state">
          <ShieldAlert size={36} style={{ color: '#94a3b8', marginBottom: '8px' }} />
          <strong>Nenhuma cobrança encontrada</strong>
          <span>Ajuste os filtros ou faça uma nova busca.</span>
        </div>
      ) : (
        <div className="fat-fin-table-container animate-fade-in">
          <table className="fat-fin-table">
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Status / Meio</th>
                <th>Parceiro</th>
                <th>Descrição</th>
                <th style={{ width: '140px', textAlign: 'right' }}>Valor</th>
                <th style={{ width: '180px' }}>Vencimento / Pagamento</th>
                <th style={{ width: '140px', textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item) => {
                const badge = getStatusBadge(item);
                const isItemOverdue = item.status === 'Vencido' || (item.status === 'Pendente' && toDate(item.dataVencimento) < toDate(hoje));
                const link = buildShareLink(item);
                const bankSlipLink = getCobrancaBankSlipLink(item);
                const cliente = companyMap.get(item.clienteEmpresaId);

                return (
                  <tr key={item.id} className={item.status === 'Pago' ? 'row-paid' : ''}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className={`fat-fin-status-badge ${badge.className}`} style={{ width: 'fit-content' }}>
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, paddingLeft: '4px' }}>
                          {item.meioPagamento || 'Não informado'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="fat-fin-cell-client">
                        <strong>{cliente?.nome || 'Cliente removido'}</strong>
                        <small>CNPJ {cliente?.cnpj || '-'}</small>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span className="fat-fin-cell-desc" title={item.descricao}>{item.descricao || 'Cobrança'}</span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{getCobrancaAccessLabel(item)}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                      <strong className={`fat-fin-cell-value ${isItemOverdue ? 'overdue' : item.status === 'Pago' ? 'paid' : ''}`}>
                        {formatCobrancaCurrency(item.valor)}
                      </strong>
                    </td>
                    <td>
                      <div className="fat-fin-cell-date">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 600 }}>{formatCobrancaDate(item.dataVencimento)}</span>
                          {getDueHelperText(item)}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: item.status === 'Pago' ? '#10b981' : '#94a3b8', fontWeight: 600 }}>
                          {item.status === 'Pago' && item.dataPagamento
                            ? `Pago em: ${formatCobrancaDate(item.dataPagamento.split('T')[0])}`
                            : 'Em aberto'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="fat-fin-cell-actions">
                        <button type="button" className="fat-fin-action-icon-btn" onClick={() => void copyChargeLink(item)} disabled={!link} title={copiedId === item.id ? 'Copiado!' : 'Copiar link'}>
                          <Clipboard size={14} style={{ color: copiedId === item.id ? '#10b981' : '#64748b' }} />
                        </button>
                        <button type="button" className="fat-fin-action-icon-btn" onClick={() => void shareChargeLink(item)} disabled={!link} title="Compartilhar">
                          <Share2 size={14} />
                        </button>
                        <button type="button" className="fat-fin-action-icon-btn" onClick={() => void downloadBankSlip(item)} disabled={!bankSlipLink || downloadingId === item.id} title="Baixar boleto">
                          <Download size={14} />
                        </button>
                        <button type="button" className="fat-fin-action-icon-btn" onClick={() => openChargePage(item)} disabled={!link} title="Abrir página">
                          <ExternalLink size={14} />
                        </button>
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
        <div className="fat-fin-pagination">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>Anterior</button>
          <span>Página {currentPage} de {totalPages}</span>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Próxima</button>
        </div>
      )}
    </div>
  );
};

/* ---- Subcomponents ---- */

const KpiCard = ({ icon, iconColor, title, value, valueColor, subtitle }: {
  icon: React.ReactNode; iconColor: string; title: string; value: string; valueColor?: string; subtitle: string;
}) => (
  <div className="fat-fin-kpi-card">
    <div className={`fat-fin-kpi-icon ${iconColor}`}>{icon}</div>
    <div className="fat-fin-kpi-content">
      <span className="fat-fin-kpi-title">{title}</span>
      <strong className={`fat-fin-kpi-value ${valueColor || ''}`}>{value}</strong>
      <span className="fat-fin-kpi-subtitle">{subtitle}</span>
    </div>
  </div>
);

const PillButton = ({ label, count, active, onClick, countClass }: {
  label: string; count: number; active: boolean; onClick: () => void; countClass?: string;
}) => (
  <button className={`fat-fin-pill-btn ${active ? 'active' : ''}`} onClick={onClick}>
    {label} <span className={`fat-fin-pill-count ${countClass || ''}`}>{count}</span>
  </button>
);

const WalletSvg = ({ size }: { size: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
  </svg>
);
