
import React from 'react';
import { FileText, XCircle, CheckCircle, FilePlus, AlertCircle, DollarSign, Activity, TrendingUp } from 'lucide-react';

export const DashboardMesTab = () => {
  const { firstDay, lastDay } = React.useMemo(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    return { firstDay, lastDay };
  }, []);

  const stats = [
    { label: 'NFS-e a emitir', value: '45', icon: FilePlus, color: '#3b82f6', bg: '#eff6ff' },
    { label: 'NFS-e emitidas', value: '128', icon: CheckCircle, color: '#10b981', bg: '#ecfdf5' },
    { label: 'NFS-e canceladas', value: '3', icon: XCircle, color: '#f43f5e', bg: '#fff1f2' },
    { label: 'Cobranças geradas', value: '156', icon: FileText, color: '#6366f1', bg: '#eef2ff' },
    { label: 'Contas a receber', value: '89', icon: DollarSign, color: '#f59e0b', bg: '#fffbeb' },
    { label: 'Total previsto', value: 'R$ 145.000', icon: Activity, color: '#06b6d4', bg: '#ecfeff' },
    { label: 'Total recebido', value: 'R$ 98.500', icon: TrendingUp, color: '#10b981', bg: '#ecfdf5' },
    { label: 'Total em aberto', value: 'R$ 46.500', icon: DollarSign, color: '#3b82f6', bg: '#eff6ff' },
    { label: 'Total em atraso', value: 'R$ 12.300', icon: AlertCircle, color: '#f43f5e', bg: '#fff1f2' },
  ];

  return (
    <div className="space-y-6">
      <div className="faturamento-card" style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', padding: '16px' }}>
          <div className="faturamento-form-group" style={{ flex: '1', minWidth: '150px' }}>
            <label>Data Inicial</label>
            <input type="date" defaultValue={firstDay} />
          </div>
          <div className="faturamento-form-group" style={{ flex: '1', minWidth: '150px' }}>
            <label>Data Final</label>
            <input type="date" defaultValue={lastDay} />
          </div>
          <div className="faturamento-form-group" style={{ flex: '2', minWidth: '200px' }}>
            <label>Parceiro/Empresa</label>
            <input type="text" placeholder="Buscar parceiro..." />
          </div>
          <div className="faturamento-form-group" style={{ width: '150px' }}>
            <label>Status Pagamento</label>
            <select>
              <option>Todos</option>
              <option>Pagos</option>
              <option>Em Aberto</option>
              <option>Em Atraso</option>
            </select>
          </div>
          <button className="faturamento-btn-primary">
            Filtrar
          </button>
      </div>

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
