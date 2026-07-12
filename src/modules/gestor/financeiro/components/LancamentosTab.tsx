import React, { useMemo, useState, useEffect } from 'react';
import { Search, ShieldAlert, CheckCircle, ArrowUpCircle, ArrowDownCircle, RefreshCw, PlusCircle, MinusCircle, Plus, ChevronDown } from 'lucide-react';
import type { LancamentoFinanceiro } from '../services/financeiroService';
import './LancamentosTab.css';
import { AddOutrosCreditosModal } from './AddOutrosCreditosModal';
import { AddOutrosDebitosModal } from './AddOutrosDebitosModal';
import { AddTransferenciaModal } from './AddTransferenciaModal';

type FiltroTipo = 'todos' | 'creditos' | 'debitos' | 'transferencias';

type LancamentosTabProps = {
  initialFilter?: string;
  lancamentos: LancamentoFinanceiro[];
  onCreateLancamento: (dados: Pick<
    LancamentoFinanceiro,
    'tipo' | 'origem' | 'descricao' | 'categoria' | 'valor' | 'dataCompetencia' | 'status'
  > & Partial<Pick<LancamentoFinanceiro, 'contaBancariaId' | 'clienteEmpresaId' | 'dataPagamento' | 'referenciaId' | 'metadados'>>) => Promise<void>;
  onFormatCurrency: (value: number) => string;
  onFormatDate: (value: string) => string;
};

export const LancamentosTab: React.FC<LancamentosTabProps> = ({
  initialFilter,
  lancamentos,
  onCreateLancamento,
  onFormatCurrency,
  onFormatDate,
}) => {
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedType, setSelectedType] = useState<FiltroTipo>('todos');
  const [showCreditoModal, setShowCreditoModal] = useState(false);
  const [showDebitoModal, setShowDebitoModal] = useState(false);
  const [showTransferenciaModal, setShowTransferenciaModal] = useState(false);
  const [showDropdownAction, setShowDropdownAction] = useState(false);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);

  // Sync initial filter from sidebar selection
  useEffect(() => {
    if (initialFilter) {
      if (initialFilter === 'transferencias' || initialFilter === 'transferencia') {
        setSelectedType('transferencias');
      } else if (initialFilter === 'creditos' || initialFilter === 'credito') {
        setSelectedType('creditos');
      } else if (initialFilter === 'debitos' || initialFilter === 'debito') {
        setSelectedType('debitos');
      } else {
        setSelectedType('todos');
      }
    }
  }, [initialFilter]);

  // Dynamic calculations for totals
  const stats = useMemo(() => {
    // We only compute stats for "Lançamentos avulsos/ajustes" (creditos, debitos, transferencias)
    const validLancamentos = lancamentos.filter(i => 
      i.origem === 'outro_credito' || i.origem === 'outro_debito' || i.origem === 'transferencia'
    );

    const totalCredito = validLancamentos
      .filter(i => i.tipo === 'receita')
      .reduce((acc, i) => acc + i.valor, 0);

    const totalDebito = validLancamentos
      .filter(i => i.tipo === 'despesa')
      .reduce((acc, i) => acc + i.valor, 0);

    return {
      credito: totalCredito,
      debito: totalDebito,
      saldo: totalCredito - totalDebito,
      totalQty: validLancamentos.length,
    };
  }, [lancamentos]);



  // Filter core entries
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    // Only display out-of-billing adjustments, manual entries, and transfers (no regular client invoices/bills)
    const baseList = lancamentos.filter(i => 
      i.origem === 'outro_credito' || i.origem === 'outro_debito' || i.origem === 'transferencia' || i.origem === 'manual'
    );

    return baseList.filter((item) => {
      // 1. Search term match
      const desc = item.descricao?.toLowerCase() || '';
      const cat = item.categoria?.toLowerCase() || '';
      const valStr = String(item.valor);
      const meta = item.metadados || {};
      const bankOrig = String(meta.bancoOrigem || meta.banco_origem || '').toLowerCase();
      const bankDest = String(meta.bancoDestino || meta.banco_destino || '').toLowerCase();

      const matchesSearch =
        !term ||
        desc.includes(term) ||
        cat.includes(term) ||
        valStr.includes(term) ||
        bankOrig.includes(term) ||
        bankDest.includes(term);

      // 2. Date filters
      const isAfterStart = !startDate || item.dataCompetencia >= startDate;
      const isBeforeEnd = !endDate || item.dataCompetencia <= endDate;

      // 3. Type filters
      let matchesType = true;
      if (selectedType === 'creditos') {
        matchesType = item.tipo === 'receita';
      } else if (selectedType === 'debitos') {
        matchesType = item.tipo === 'despesa';
      } else if (selectedType === 'transferencias') {
        matchesType = item.origem === 'transferencia';
      }

      return matchesSearch && isAfterStart && isBeforeEnd && matchesType;
    });
  }, [lancamentos, search, startDate, endDate, selectedType]);

  // Type badge helper
  const getEntryBadge = (item: LancamentoFinanceiro) => {
    if (item.origem === 'transferencia') {
      return { label: 'Transferência', className: 'badge-transfer', icon: <RefreshCw size={12} /> };
    }
    if (item.tipo === 'receita') {
      return { label: 'Crédito', className: 'badge-credit', icon: <ArrowUpCircle size={12} /> };
    }
    return { label: 'Débito', className: 'badge-debit', icon: <ArrowDownCircle size={12} /> };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* KPI Cards for adjustments/manual ledger */}
      <div className="financeiro-kpi-grid">
        <div className="financeiro-kpi-card hover-grow">
          <div className="kpi-icon-wrapper green">
            <PlusCircle size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-title">Ajustes de Crédito</span>
            <strong className="kpi-value green-text">{onFormatCurrency(stats.credito)}</strong>
          </div>
        </div>

        <div className="financeiro-kpi-card hover-grow">
          <div className="kpi-icon-wrapper red">
            <MinusCircle size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-title">Ajustes de Débito</span>
            <strong className="kpi-value red-text">{onFormatCurrency(stats.debito)}</strong>
          </div>
        </div>

        <div className="financeiro-kpi-card hover-grow">
          <div className="kpi-icon-wrapper blue">
            <CheckCircle size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-title">Saldo Consolidado</span>
            <strong className={`kpi-value ${stats.saldo >= 0 ? 'green-text' : 'red-text'}`}>
              {onFormatCurrency(stats.saldo)}
            </strong>
          </div>
        </div>
      </div>

      {/* Pill Filter Subtabs */}
      <div className="financeiro-pills-row">
        <button className={`pill-btn ${selectedType === 'todos' ? 'active' : ''}`} onClick={() => setSelectedType('todos')}>
          Todos os lançamentos
        </button>
        <button className={`pill-btn ${selectedType === 'creditos' ? 'active' : ''}`} onClick={() => setSelectedType('creditos')}>
          Créditos avulsos
        </button>
        <button className={`pill-btn ${selectedType === 'debitos' ? 'active' : ''}`} onClick={() => setSelectedType('debitos')}>
          Débitos avulsos
        </button>
        <button className={`pill-btn ${selectedType === 'transferencias' ? 'active' : ''}`} onClick={() => setSelectedType('transferencias')}>
          Transferências
        </button>
      </div>

      {/* Modern Control & Filter Bar */}
      <div className="financeiro-controls-bar">
        <div className="financeiro-filters-group">
          <label className="financeiro-search-wrapper" style={{ flex: 1.5 }}>
            <Search size={15} className="financeiro-search-icon" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar descrição, banco ou valor..."
            />
          </label>

          <div className="financeiro-date-range-group">
            <div className="date-group-inputs">
              <input value={startDate} onChange={(event) => setStartDate(event.target.value)} type="date" />
              <span className="date-separator">-</span>
              <input value={endDate} onChange={(event) => setEndDate(event.target.value)} type="date" />
            </div>
          </div>

          {/* Quick Actions Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="financeiro-dropdown-btn"
              onClick={() => setShowDropdownAction((prev) => !prev)}
            >
              <Plus size={15} />
              <span>Novo lançamento</span>
              <ChevronDown size={14} />
            </button>

            {showDropdownAction && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setShowDropdownAction(false)} />
                <div className="financeiro-action-dropdown animate-fade-in">
                  <button
                    onClick={() => {
                      setShowCreditoModal(true);
                      setShowDropdownAction(false);
                    }}
                  >
                    <PlusCircle size={14} style={{ color: '#10b981' }} />
                    <span>Novo crédito (Receita)</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowDebitoModal(true);
                      setShowDropdownAction(false);
                    }}
                  >
                    <MinusCircle size={14} style={{ color: '#ef4444' }} />
                    <span>Novo débito (Despesa)</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowTransferenciaModal(true);
                      setShowDropdownAction(false);
                    }}
                  >
                    <RefreshCw size={14} style={{ color: '#c59235' }} />
                    <span>Transferência entre contas</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modals for launching entries */}
      <AddOutrosCreditosModal
        isOpen={showCreditoModal}
        onClose={() => setShowCreditoModal(false)}
        isLoading={isSubmitLoading}
        onSubmit={async (data) => {
          setIsSubmitLoading(true);
          try {
            await onCreateLancamento({
              tipo: 'receita',
              origem: 'outro_credito',
              descricao: data.descricao,
              categoria: data.categoria,
              valor: data.valor,
              dataCompetencia: data.data,
              dataPagamento: data.data,
              status: 'Pago',
              contaBancariaId: data.contaBancariaId,
            });
            setShowCreditoModal(false);
          } catch (err) {
            console.error(err);
          } finally {
            setIsSubmitLoading(false);
          }
        }}
      />

      <AddOutrosDebitosModal
        isOpen={showDebitoModal}
        onClose={() => setShowDebitoModal(false)}
        isLoading={isSubmitLoading}
        onSubmit={async (data) => {
          setIsSubmitLoading(true);
          try {
            await onCreateLancamento({
              tipo: 'despesa',
              origem: 'outro_debito',
              descricao: data.descricao,
              categoria: data.categoria,
              valor: data.valor,
              dataCompetencia: data.data,
              dataPagamento: data.data,
              status: 'Pago',
              contaBancariaId: data.contaBancariaId,
            });
            setShowDebitoModal(false);
          } catch (err) {
            console.error(err);
          } finally {
            setIsSubmitLoading(false);
          }
        }}
      />

      <AddTransferenciaModal
        isOpen={showTransferenciaModal}
        onClose={() => setShowTransferenciaModal(false)}
        isLoading={isSubmitLoading}
        onSubmit={async (data) => {
          setIsSubmitLoading(true);
          try {
            // 1. Transfer out from origin account
            await onCreateLancamento({
              tipo: 'transferencia_saida',
              origem: 'transferencia',
              descricao: `${data.descricao} (Para ${data.nomeContaDestino})`,
              categoria: 'Transferência',
              valor: data.valor,
              dataCompetencia: data.data,
              dataPagamento: data.data,
              status: 'Pago',
              contaBancariaId: data.contaOrigemId,
            });

            // 2. Transfer in to destination account
            await onCreateLancamento({
              tipo: 'transferencia_entrada',
              origem: 'transferencia',
              descricao: `${data.descricao} (De ${data.nomeContaOrigem})`,
              categoria: 'Transferência',
              valor: data.valor,
              dataCompetencia: data.data,
              dataPagamento: data.data,
              status: 'Pago',
              contaBancariaId: data.contaDestinoId,
            });

            setShowTransferenciaModal(false);
          } catch (err) {
            console.error(err);
          } finally {
            setIsSubmitLoading(false);
          }
        }}
      />

      {/* Table View */}
      {filtered.length === 0 ? (
        <div className="financeiro-empty-state-box">
          <ShieldAlert size={36} style={{ color: '#94a3b8', marginBottom: '8px' }} />
          <strong>Nenhum lançamento encontrado</strong>
          <span>Faça um novo lançamento ou ajuste a busca.</span>
        </div>
      ) : (
        <div className="financeiro-table-container animate-fade-in">
          <table className="financeiro-table">
            <thead>
              <tr>
                <th style={{ width: '140px' }}>Tipo</th>
                <th>Descrição</th>
                <th style={{ width: '130px' }}>Categoria</th>
                <th style={{ width: '150px', textAlign: 'right' }}>Valor</th>
                <th style={{ width: '130px' }}>Competência</th>
                <th>Conta / Bancos</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const badge = getEntryBadge(item);
                const meta = item.metadados || {};
                const bankInfo = item.origem === 'transferencia'
                  ? `${meta.bancoOrigem || meta.banco_origem || 'Origem'} ➔ ${meta.bancoDestino || meta.banco_destino || 'Destino'}`
                  : (meta.banco || meta.banco_origem || 'Carteira padrão');

                return (
                  <tr key={item.id} className={item.tipo === 'despesa' ? 'row-expense' : 'row-income'}>
                    <td>
                      <span className={`status-badge-pill ${badge.className}`}>
                        {badge.icon}
                        <span>{badge.label}</span>
                      </span>
                    </td>
                    <td>
                      <span className="table-cell-desc bold">{item.descricao}</span>
                    </td>
                    <td>
                      <span className="table-cell-category">{item.categoria || 'Ajuste'}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong className={`table-cell-value ${item.tipo === 'despesa' ? 'overdue' : 'paid'}`}>
                        {item.tipo === 'despesa' ? '-' : '+'}{onFormatCurrency(item.valor)}
                      </strong>
                    </td>
                    <td>
                      <span className="table-cell-date">{onFormatDate(item.dataCompetencia)}</span>
                    </td>
                    <td>
                      <span className="table-cell-bank" title={String(bankInfo)}>{String(bankInfo)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
