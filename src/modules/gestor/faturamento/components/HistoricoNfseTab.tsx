
import { useState } from 'react';
import { Eye, Download, XCircle, Play, Edit3, Trash2, RotateCcw } from 'lucide-react';
import { useFaturamentoNfseQuery } from '../queries/useFaturamentoQueries';
import type { FaturamentoNfseStatus } from '../services/faturamentoService';

type TabType = 'A Emitir' | 'Emitidas' | 'Canceladas' | 'Rejeitadas' | 'Todas';

export const HistoricoNfseTab = () => {
  const [activeTab, setActiveTab] = useState<TabType>('Todas');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todas');
  const [origemFilter, setOrigemFilter] = useState('Todas');
  const selectedStatus = statusFilter === 'Todos' ? 'Todas' : statusFilter;
  const queryStatus = activeTab === 'Emitidas'
    ? 'Emitida'
    : activeTab === 'Canceladas'
      ? 'Cancelada'
      : activeTab === 'Rejeitadas'
        ? 'Rejeitada'
        : activeTab === 'A Emitir'
          ? 'A Emitir'
          : selectedStatus;
  const nfseQuery = useFaturamentoNfseQuery({ status: queryStatus, search });
  const nfse = nfseQuery.data || [];
  const filteredNfse = origemFilter === 'Todas' ? nfse : nfse.filter((item) => item.tipo === origemFilter);

  const formatCurrency = (value: number) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const getStatusStyle = (status: FaturamentoNfseStatus) => {
    switch (status) {
      case 'Emitida': return { bg: '#ecfdf5', color: '#10b981' };
      case 'Cancelada': return { bg: '#fef2f2', color: '#ef4444' };
      case 'Rejeitada': return { bg: '#fff7ed', color: '#f97316' };
      case 'A Emitir': return { bg: '#eff6ff', color: '#3b82f6' };
      case 'Rascunho': return { bg: '#f1f5f9', color: '#64748b' };
      default: return { bg: '#f1f5f9', color: '#64748b' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Abas */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
        {(['Todas', 'A Emitir', 'Emitidas', 'Rejeitadas', 'Canceladas'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '6px 12px',
              border: 'none',
              background: activeTab === tab ? '#c59235' : 'transparent',
              color: activeTab === tab ? '#fff' : '#64748b',
              fontWeight: 600,
              fontSize: '0.85rem',
              borderRadius: '20px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="faturamento-card" style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', padding: '16px' }}>
          <div className="faturamento-form-group" style={{ flex: '1', minWidth: '200px' }}>
            <label>Buscar</label>
            <input type="text" placeholder="Número, parceiro..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="faturamento-form-group" style={{ width: '150px' }}>
            <label>Status</label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} disabled={activeTab !== 'Todas'}>
              <option value="Todas">Todos</option>
              <option>A Emitir</option>
              <option>Rascunho</option>
              <option>Emitida</option>
              <option>Rejeitada</option>
              <option>Cancelada</option>
            </select>
          </div>
          <div className="faturamento-form-group" style={{ width: '150px' }}>
            <label>Origem</label>
            <select value={origemFilter} onChange={(event) => setOrigemFilter(event.target.value)}>
              <option>Todas</option>
              <option>Automática</option>
              <option>Manual</option>
            </select>
          </div>
          <button className="faturamento-btn-primary" disabled={nfseQuery.isFetching}>
            {nfseQuery.isFetching ? 'Filtrando...' : 'Filtrar'}
          </button>
      </div>

      <div className="faturamento-card" style={{ padding: 0 }}>
        <div className="faturamento-table-container">
          <table className="faturamento-table">
            <thead>
              <tr>
                <th>NFS-e</th>
                <th>Parceiro</th>
                <th>Emissão (Prevista/Realizada)</th>
                <th>Origem</th>
                <th>Valor</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredNfse.map((nfse) => {
                const statusStyle = getStatusStyle(nfse.status);
                return (
                  <tr key={nfse.id}>
                    <td style={{ fontWeight: 500, color: '#0f172a' }}>{nfse.numero}</td>
                    <td>{nfse.parceiro}</td>
                    <td>{nfse.emissao}</td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', background: '#f8f9fa', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        {nfse.tipo}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{formatCurrency(nfse.valor)}</td>
                    <td>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '12px', 
                        fontSize: '0.75rem', 
                        fontWeight: 600,
                        backgroundColor: statusStyle.bg,
                        color: statusStyle.color
                      }}>
                        {nfse.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        {nfse.status === 'Emitida' && (
                          <>
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6' }} title="Visualizar NF"><Eye size={16} /></button>
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }} title="Baixar PDF/XML"><Download size={16} /></button>
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="Cancelar NFS-e"><XCircle size={16} /></button>
                          </>
                        )}
                        {nfse.status === 'A Emitir' && (
                          <>
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981' }} title="Emitir Agora"><Play size={16} /></button>
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="Cancelar Emissão"><XCircle size={16} /></button>
                          </>
                        )}
                        {nfse.status === 'Rascunho' && (
                          <>
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981' }} title="Emitir"><Play size={16} /></button>
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6' }} title="Editar"><Edit3 size={16} /></button>
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="Excluir"><Trash2 size={16} /></button>
                          </>
                        )}
                        {nfse.status === 'Rejeitada' && (
                          <>
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6' }} title="Corrigir e Reemitir"><RotateCcw size={16} /></button>
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }} title="Ver Motivo"><Eye size={16} /></button>
                          </>
                        )}
                        {nfse.status === 'Cancelada' && (
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }} title="Ver Detalhes"><Eye size={16} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!nfseQuery.isLoading && filteredNfse.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>
                    Nenhuma NFS-e encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
