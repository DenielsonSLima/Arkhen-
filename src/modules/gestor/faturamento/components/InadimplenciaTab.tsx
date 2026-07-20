
import { useState } from 'react';
import { MessageCircle, RefreshCw, X } from 'lucide-react';
import { useFaturamentoInadimplenciaQuery } from '../queries/useFaturamentoQueries';

export const InadimplenciaTab = () => {
  const [search, setSearch] = useState('');
  const [minDias, setMinDias] = useState(0);
  const [appliedFilters, setAppliedFilters] = useState({ minDias: 0, search: '' });
  const inadimplenciaQuery = useFaturamentoInadimplenciaQuery(appliedFilters);
  const items = inadimplenciaQuery.data || [];
  const formatCurrency = (value: number) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (value: string) => {
    const parts = value.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <form
        className="faturamento-card"
        style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', padding: '16px' }}
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedFilters({ minDias, search: search.trim() });
        }}
      >
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
          <button type="submit" className="faturamento-btn-primary" disabled={inadimplenciaQuery.isFetching}>
            {inadimplenciaQuery.isFetching ? 'Filtrando...' : 'Filtrar'}
          </button>
      </form>

      {inadimplenciaQuery.isError && (
        <div className="faturamento-card" role="alert" style={{ padding: 16, color: '#991b1b', background: '#fef2f2' }}>
          Não foi possível carregar as cobranças em atraso.{' '}
          <button type="button" className="faturamento-btn-secondary" onClick={() => void inadimplenciaQuery.refetch()}>
            Tentar novamente
          </button>
        </div>
      )}

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
                      <button type="button" disabled style={{ background: 'none', border: 'none', cursor: 'not-allowed', color: '#94a3b8' }} title="Indisponível: registro de contato ainda não possui serviço de persistência"><MessageCircle size={16} /></button>
                      <button type="button" disabled style={{ background: 'none', border: 'none', cursor: 'not-allowed', color: '#94a3b8' }} title="Indisponível: reenvio ainda não possui integração configurada"><RefreshCw size={16} /></button>
                      <button type="button" disabled style={{ background: 'none', border: 'none', cursor: 'not-allowed', color: '#94a3b8' }} title="Indisponível nesta tela: cancelamento exige confirmação e serviço específico"><X size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!inadimplenciaQuery.isLoading && !inadimplenciaQuery.isError && items.length === 0 && (
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
