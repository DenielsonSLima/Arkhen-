
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, XCircle, CheckCircle, FilePlus, AlertCircle, DollarSign, Activity, TrendingUp } from 'lucide-react';
import { useFaturamentoDashboardQuery } from '../queries/useFaturamentoQueries';
import { gestaoEmpresarialService } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { BillingClientSelect } from './billingFormUtils';
import { formatLocalISODate } from '../utils/dateUtils';

export const DashboardMesTab = () => {
  const { firstDay, lastDay } = React.useMemo(() => {
    const today = new Date();
    const firstDay = formatLocalISODate(new Date(today.getFullYear(), today.getMonth(), 1));
    const lastDay = formatLocalISODate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
    return { firstDay, lastDay };
  }, []);
  const [dataInicial, setDataInicial] = React.useState(firstDay);
  const [dataFinal, setDataFinal] = React.useState(lastDay);
  const [status, setStatus] = React.useState('Todos');
  const [clienteEmpresaId, setClienteEmpresaId] = React.useState('');
  const [appliedFilters, setAppliedFilters] = React.useState({
    dataInicial: firstDay,
    dataFinal: lastDay,
    status: 'Todos',
    clienteEmpresaId: null as string | null,
  });
  const dashboardQuery = useFaturamentoDashboardQuery(appliedFilters);
  const clientesQuery = useQuery({
    queryKey: ['gestao-empresarial', 'companies'],
    queryFn: gestaoEmpresarialService.getCompanies,
    staleTime: 60_000,
  });
  const data = dashboardQuery.data;

  const formatCurrency = (value = 0) => value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const stats = [
    { label: 'NFS-e a emitir', value: String(data?.nfseAEmitir || 0), icon: FilePlus, color: '#3b82f6', bg: '#eff6ff' },
    { label: 'NFS-e emitidas', value: String(data?.nfseEmitidas || 0), icon: CheckCircle, color: '#10b981', bg: '#ecfdf5' },
    { label: 'NFS-e canceladas', value: String(data?.nfseCanceladas || 0), icon: XCircle, color: '#f43f5e', bg: '#fff1f2' },
    { label: 'Cobranças geradas', value: String(data?.cobrancasGeradas || 0), icon: FileText, color: '#6366f1', bg: '#eef2ff' },
    { label: 'Contas a receber', value: String(data?.contasReceber || 0), icon: DollarSign, color: '#f59e0b', bg: '#fffbeb' },
    { label: 'Total previsto', value: formatCurrency(data?.totalPrevisto), icon: Activity, color: '#06b6d4', bg: '#ecfeff' },
    { label: 'Total recebido', value: formatCurrency(data?.totalRecebido), icon: TrendingUp, color: '#10b981', bg: '#ecfdf5' },
    { label: 'Total em aberto', value: formatCurrency(data?.totalAberto), icon: DollarSign, color: '#3b82f6', bg: '#eff6ff' },
    { label: 'Total em atraso', value: formatCurrency(data?.totalAtraso), icon: AlertCircle, color: '#f43f5e', bg: '#fff1f2' },
  ];

  return (
    <div className="space-y-6">
      <form
        className="faturamento-card"
        style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', padding: '16px' }}
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedFilters({ dataInicial, dataFinal, status, clienteEmpresaId: clienteEmpresaId || null });
        }}
      >
          <div className="faturamento-form-group" style={{ flex: '1', minWidth: '150px' }}>
            <label>Data Inicial</label>
            <input type="date" value={dataInicial} onChange={(event) => setDataInicial(event.target.value)} />
          </div>
          <div className="faturamento-form-group" style={{ flex: '1', minWidth: '150px' }}>
            <label>Data Final</label>
            <input type="date" value={dataFinal} onChange={(event) => setDataFinal(event.target.value)} />
          </div>
          <div className="faturamento-form-group" style={{ flex: '2', minWidth: '200px' }}>
            <label>Parceiro/Empresa</label>
            <BillingClientSelect
              clientes={clientesQuery.data || []}
              value={clienteEmpresaId}
              onChange={setClienteEmpresaId}
              isLoading={clientesQuery.isLoading}
            />
          </div>
          <div className="faturamento-form-group" style={{ width: '150px' }}>
            <label>Status Pagamento</label>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option>Todos</option>
              <option value="Pago">Pagos</option>
              <option value="Pendente">Em Aberto</option>
              <option value="Vencido">Em Atraso</option>
              <option value="Cancelado">Cancelados</option>
            </select>
          </div>
          <button type="submit" className="faturamento-btn-primary" disabled={dashboardQuery.isFetching}>
            {dashboardQuery.isFetching ? 'Filtrando...' : 'Filtrar'}
          </button>
      </form>

      <div className="faturamento-card" style={{ padding: '12px 16px', color: '#92400e', background: '#fffbeb', borderColor: '#fde68a' }}>
        A emissão integrada de NFS-e depende da disponibilidade e da homologação do provedor de cada prefeitura.
        “A emitir” considera apenas clientes com configuração fiscal municipal ativa; notas já emitidas continuam no histórico.
      </div>

      {dashboardQuery.isError && (
        <div className="faturamento-card" role="alert" style={{ padding: 16, color: '#991b1b', background: '#fef2f2' }}>
          Não foi possível carregar o resumo de faturamento.{' '}
          <button type="button" className="faturamento-btn-secondary" onClick={() => void dashboardQuery.refetch()}>
            Tentar novamente
          </button>
        </div>
      )}

      <div className="faturamento-stats-grid">
        {stats.map((stat, idx) => (
          <div key={idx} className="faturamento-stat-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: stat.bg }}>
                <stat.icon size={20} color={stat.color} />
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>{stat.label}</span>
            </div>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
