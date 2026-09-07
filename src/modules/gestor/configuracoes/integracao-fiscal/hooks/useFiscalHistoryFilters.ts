import { useMemo, useState } from 'react';
import type { NfsHistoryItem } from '../services/fiscalIntegrationTypes';

export function useFiscalHistoryFilters(history: NfsHistoryItem[]) {
  const [filterPeriodoInicio, setFilterPeriodoInicio] = useState('');
  const [filterPeriodoFim, setFilterPeriodoFim] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterNotaNum, setFilterNotaNum] = useState('');
  const [filterOperacao, setFilterOperacao] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const filteredHistory = useMemo(() => history.filter((item) => {
    if (filterPeriodoInicio && item.data < filterPeriodoInicio) return false;
    if (filterPeriodoFim && item.data > filterPeriodoFim) return false;
    if (filterStatus !== 'Todos' && item.status !== filterStatus) return false;
    if (filterOperacao !== 'Todos' && item.operacao !== filterOperacao) return false;
    if (filterNotaNum && !item.numeroNfse.includes(filterNotaNum)) return false;
    return !searchQuery || `${item.usuario} ${item.mensagemPrefeitura} ${item.protocolo} ${item.operacao}`.toLowerCase().includes(searchQuery.toLowerCase());
  }), [history, filterPeriodoInicio, filterPeriodoFim, filterStatus, filterOperacao, filterNotaNum, searchQuery]);
  return { filteredHistory, filterPeriodoInicio, setFilterPeriodoInicio, filterPeriodoFim, setFilterPeriodoFim,
    filterStatus, setFilterStatus, filterOperacao, setFilterOperacao, filterNotaNum, setFilterNotaNum, searchQuery, setSearchQuery };
}
