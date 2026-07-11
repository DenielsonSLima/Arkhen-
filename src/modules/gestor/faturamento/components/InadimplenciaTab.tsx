
import { useState } from 'react';
import { MessageCircle, RefreshCw, X } from 'lucide-react';
import { useFaturamentoInadimplenciaQuery } from '../queries/useFaturamentoQueries';

export const InadimplenciaTab = () => {
  const [search, setSearch] = useState('');
  const [minDias, setMinDias] = useState(0);
  const inadimplenciaQuery = useFaturamentoInadimplenciaQuery({ minDias, search });
  const items = inadimplenciaQuery.data || [];
  const formatCurrency = (value: number) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (value: string) => {
    const parts = value.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="faturamento-card" style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', padding: '16px' }}>
          <div className="faturamento-form-group" style={{ flex: '1', minWidth: '200px' }}>
            <label>Buscar Parceiro</label>
            <input type="text" placeholder="Nome do parceiro..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="faturamento-form-group" style={{ width: '150px' }}>
            <label>Atraso</label>
            <select value={minDias} onChange={(event) => setMinDias(Number(event.target.value))}>
              <option value={0}>Todos</option>
              <option value={5}>Mais de 5 dias</option>
              <option value={15}>Mais de 15 dias</option>
              <option value={30}>Mais de 30 dias</option>
            </select>
          </div>
          <button className="faturamento-btn-primary" disabled={inadimplenciaQuery.isFetching}>
            {inadimplenciaQuery.isFetching ? 'Filtrando...' : 'Filtrar'}
          </button>
      </div>

      <div className="faturamento-card" style={{ padding: 0 }}>
        <div className="faturamento-table-container">
          <table className="faturamento-table">
            <thead>
              <tr>
                <th>Parceiro</th>
                <th>Valor em Atraso</th>
                <th>Vencimento</th>
                <th>Dias</th>
                <th>Último Contato</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 500, color: '#0f172a' }}>{item.parceiro}</td>
                  <td style={{ fontWeight: 600, color: '#ef4444' }}>{formatCurrency(item.valor)}</td>
                  <td>{formatDate(item.vencimento)}</td>
                  <td style={{ fontWeight: 600, color: '#ef4444' }}>{item.dias} dias</td>
                  <td style={{ color: '#64748b' }}>{item.ultimoContato}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981' }} title="Registrar Contato"><MessageCircle size={16} /></button>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6' }} title="Reenviar Link"><RefreshCw size={16} /></button>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="Cancelar Cobrança"><X size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!inadimplenciaQuery.isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>
                    Nenhuma cobrança em atraso encontrada.
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
