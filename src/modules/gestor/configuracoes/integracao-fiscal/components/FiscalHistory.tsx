import React from 'react';
import type { NfsHistoryItem } from '../services/fiscalIntegrationService';

interface FiscalHistoryProps {
  filteredHistory: NfsHistoryItem[];
  filterPeriodoInicio: string;
  setFilterPeriodoInicio: (val: string) => void;
  filterPeriodoFim: string;
  setFilterPeriodoFim: (val: string) => void;
  filterStatus: string;
  setFilterStatus: (val: string) => void;
  filterOperacao: string;
  setFilterOperacao: (val: string) => void;
  filterNotaNum: string;
  setFilterNotaNum: (val: string) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
}

export const FiscalHistory: React.FC<FiscalHistoryProps> = ({
  filteredHistory,
  filterPeriodoInicio,
  setFilterPeriodoInicio,
  filterPeriodoFim,
  setFilterPeriodoFim,
  filterStatus,
  setFilterStatus,
  filterOperacao,
  setFilterOperacao,
  filterNotaNum,
  setFilterNotaNum,
  searchQuery,
  setSearchQuery,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Filters Panel */}
      <div className="fiscal-filter-panel animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        <div className="form-item-group">
          <label>Data Início</label>
          <input
            type="date"
            value={filterPeriodoInicio}
            onChange={(e) => setFilterPeriodoInicio(e.target.value)}
            style={{ padding: '8px', fontSize: '0.82rem' }}
          />
        </div>
        <div className="form-item-group">
          <label>Data Fim</label>
          <input
            type="date"
            value={filterPeriodoFim}
            onChange={(e) => setFilterPeriodoFim(e.target.value)}
            style={{ padding: '8px', fontSize: '0.82rem' }}
          />
        </div>
        <div className="form-item-group">
          <label>Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: '8px', fontSize: '0.82rem' }}
          >
            <option value="Todos">Todos</option>
            <option value="Sucesso">Sucesso</option>
            <option value="Erro">Erro</option>
            <option value="Pendente">Pendente</option>
          </select>
        </div>
        <div className="form-item-group">
          <label>Operação</label>
          <select
            value={filterOperacao}
            onChange={(e) => setFilterOperacao(e.target.value)}
            style={{ padding: '8px', fontSize: '0.82rem' }}
          >
            <option value="Todos">Todos Operations</option>
            <option value="Emissão">Emissão</option>
            <option value="Cancelamento">Cancelamento</option>
            <option value="Consulta">Consulta</option>
            <option value="Sincronização">Sincronização</option>
          </select>
        </div>
        <div className="form-item-group">
          <label>Número Nota</label>
          <input
            type="text"
            value={filterNotaNum}
            onChange={(e) => setFilterNotaNum(e.target.value)}
            placeholder="Ex: 1539"
            style={{ padding: '8px', fontSize: '0.82rem' }}
          />
        </div>
      </div>

      {/* Global Text Search */}
      <div className="form-item-group">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar protocolo, usuário ou mensagem do serviço fiscal..."
            style={{ width: '100%' }}
        />
      </div>

      {/* Audit Logs Table */}
      <div className="table-responsive">
        <table className="config-table">
          <thead>
            <tr>
              <th>Data/Hora</th>
              <th>Operação</th>
              <th>NFS-e</th>
              <th>Protocolo</th>
              <th>Status</th>
              <th>Usuário</th>
              <th>Mensagem da Operação</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-dark-muted)' }}>
                  Nenhum registro encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              filteredHistory.map((item) => (
                <tr key={item.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {item.data} <span style={{ color: 'var(--color-text-dark-muted)', fontSize: '0.75rem', marginLeft: '4px' }}>{item.hora}</span>
                  </td>
                  <td><strong>{item.operacao}</strong></td>
                  <td style={{ fontWeight: 600 }}>{item.numeroNfse !== '-' ? item.numeroNfse : '-'}</td>
                  <td><span className="ip-code">{item.protocolo}</span></td>
                  <td>
                    <span className={`table-badge ${item.status === 'Sucesso' ? 'badge-green' : 'badge-orange'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td>{item.usuario}</td>
                  <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.mensagemPrefeitura}>
                    {item.mensagemPrefeitura}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
