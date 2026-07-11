import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { LancamentoFinanceiro } from '../services/financeiroService';
import { TransferenciaEntreContasCard } from './TransferenciaEntreContasCard';

type FiltroStatus = 'mesAtual' | 'todos';
type TransferenciaEntreContasItem = {
  id: string;
  data: string;
  bancoOrigem: string;
  origem: string;
  bancoDestino: string;
  destino: string;
  valor: number;
  status: 'Concluída' | 'Pendente';
};

type TransferenciaEntreContasTabProps = {
  dados: LancamentoFinanceiro[];
  onFormatCurrency: (value: number) => string;
  onFormatDate: (value: string) => string;
};

const SUBTABS: { id: FiltroStatus; label: string }[] = [
  { id: 'mesAtual', label: 'Mês atual' },
  { id: 'todos', label: 'Todos' },
];

export const TransferenciaEntreContasTab: React.FC<TransferenciaEntreContasTabProps> = ({
  dados,
  onFormatCurrency,
  onFormatDate,
}) => {
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedBanco, setSelectedBanco] = useState('Todos os bancos');
  const [activeSubTab, setActiveSubTab] = useState<FiltroStatus>('mesAtual');
  
  const transferencias = useMemo<TransferenciaEntreContasItem[]>(() => {
    return dados.map((item) => {
      const meta = item.metadados || {};
      const bancoOrigem = String(meta.bancoOrigem || meta.banco_origem || 'Conta origem');
      const bancoDestino = String(meta.bancoDestino || meta.banco_destino || 'Conta destino');
      return {
        id: item.id,
        data: item.dataCompetencia,
        bancoOrigem,
        origem: String(meta.origem || bancoOrigem),
        bancoDestino,
        destino: String(meta.destino || bancoDestino),
        valor: item.valor,
        status: item.status === 'Pendente' ? 'Pendente' : 'Concluída',
      };
    });
  }, [dados]);

  const bancos = useMemo(() => {
    const values = new Set<string>();
    transferencias.forEach((item) => {
      values.add(item.bancoOrigem);
      values.add(item.bancoDestino);
    });
    return ['Todos os bancos', ...Array.from(values).sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  }, [transferencias]);

  const baseFiltrado = useMemo(() => {
    const term = search.trim().toLowerCase();

    return transferencias.filter((item) => {
      const matchesSearch =
        !term ||
        item.id.toLowerCase().includes(term) ||
        item.origem.toLowerCase().includes(term) ||
        item.destino.toLowerCase().includes(term) ||
        item.bancoOrigem.toLowerCase().includes(term) ||
        item.bancoDestino.toLowerCase().includes(term) ||
        String(item.valor).includes(term) ||
        onFormatDate(item.data).toLowerCase().includes(term);

      const isAfterStart = !startDate || item.data >= startDate;
      const isBeforeEnd = !endDate || item.data <= endDate;
      const matchesBanco =
        selectedBanco === 'Todos os bancos' || item.bancoOrigem === selectedBanco || item.bancoDestino === selectedBanco;

      return matchesSearch && isAfterStart && isBeforeEnd && matchesBanco;
    });
  }, [transferencias, search, startDate, endDate, selectedBanco, onFormatDate]);

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

  const renderCards = () => {
    if (filtered.length === 0) {
      return (
        <div className="financeiro-empty-state">
          Nenhuma transferência localizada para os filtros selecionados.
        </div>
      );
    }

    return (
      <div className="financeiro-mes-grupo animate-slide-up" style={{ marginTop: 16 }}>
        <div className="financeiro-mes-titulo">
          {activeSubTab === 'mesAtual' ? 'Mês atual' : 'Todas'}
        </div>
        <div className="cobrancas-cards-grid">
          {filtered.map((item) => (
            <TransferenciaEntreContasCard
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
              placeholder="Buscar origem, destino, banco ou ID..."
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
            value={selectedBanco}
            onChange={(event) => setSelectedBanco(event.target.value)}
          >
            {bancos.map((banco) => (
              <option key={banco} value={banco}>
                {banco}
              </option>
            ))}
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
          Nenhuma transferência localizada para os filtros selecionados.
        </div>
      ) : renderCards()}
    </div>
  );
};
