
import { useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { useFaturamentoNfseQuery } from '../queries/useFaturamentoQueries';

export const HistoricoFinanceiroTab = () => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('Todas');
  const historicoQuery = useFaturamentoNfseQuery({ status, search });
  const items = historicoQuery.data || [];
  const formatCurrency = (value: number) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="faturamento-card" style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', padding: '16px' }}>
          <div className="faturamento-form-group" style={{ flex: '1', minWidth: '200px' }}>
            <label>Buscar</label>
            <input type="text" placeholder="Parceiro, descrição..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="faturamento-form-group" style={{ width: '150px' }}>
            <label>Tipo</label>
            <select disabled>
              <option>Todos</option>
              <option>NFS-e</option>
              <option>Mensalidade</option>
              <option>Avulso</option>
            </select>
          </div>
          <div className="faturamento-form-group" style={{ width: '150px' }}>
            <label>Status Pagamento</label>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="Todas">Todos</option>
              <option value="Emitida">Pago</option>
              <option value="A Emitir">Pendente</option>
              <option value="Cancelada">Cancelado</option>
            </select>
          </div>
          <button className="faturamento-btn-primary" disabled={historicoQuery.isFetching}>
            {historicoQuery.isFetching ? 'Filtrando...' : 'Filtrar'}
          </button>
      </div>

      <div className="faturamento-card" style={{ padding: 0 }}>
        <div className="faturamento-table-container">
          <table className="faturamento-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Parceiro</th>
                <th>Descrição</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.emissao}</td>
                  <td style={{ fontWeight: 500, color: '#0f172a' }}>{item.parceiro}</td>
                  <td>{item.numero === '-' ? 'Cobrança' : `NFS-e ${item.numero}`}</td>
                  <td>{item.tipo}</td>
                  <td style={{ fontWeight: 500 }}>{formatCurrency(item.valor)}</td>
                  <td>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: item.status === 'Cancelada' ? '#fef2f2' : item.status === 'Emitida' ? '#ecfdf5' : '#eff6ff',
                      color: item.status === 'Cancelada' ? '#ef4444' : item.status === 'Emitida' ? '#10b981' : '#3b82f6'
                    }}>
                      {item.status === 'Emitida' ? 'Pago' : item.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }} title="Baixar"><Download size={16} /></button>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6' }} title="Abrir Link"><ExternalLink size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!historicoQuery.isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>
                    Nenhum histórico financeiro encontrado.
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
