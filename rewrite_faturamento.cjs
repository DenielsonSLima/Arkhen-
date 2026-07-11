const fs = require('fs');

let content = fs.readFileSync('src/modules/gestor/faturamento/FaturamentoPage.tsx', 'utf-8');

// 1. Change FaturamentoTab type
content = content.replace(
  "export type FaturamentoTab = 'mensalidades' | 'cobrancas' | 'boletos' | 'nfse' | 'inadimplencia';",
  "export type FaturamentoTab = 'mensalidades' | 'cobrancas';"
);

// 2. Change FATURAMENTO_TABS array
content = content.replace(
  /const FATURAMENTO_TABS[\s\S]*?\];/,
  `const FATURAMENTO_TABS: { id: FaturamentoTab; label: string; icon: React.ReactNode }[] = [
  { id: 'cobrancas', label: 'Histórico e Cobranças', icon: <Send size={16} /> },
  { id: 'mensalidades', label: 'Mensalidades e Contratos', icon: <Receipt size={16} /> },
];`
);

// 3. Update the KPI Cards styling to use modern inline style like Caixa
const oldStatsRegex = /<div className="financeiro-stats-grid">[\s\S]*?<\/div>\s*<\/div>\s*<div className="financeiro-controls-bar">/m;
const newStats = `
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{
          background: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #e6edf5', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', display: 'flex', alignItems: 'center', gap: '16px'
        }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#6366f1' }}>
            <Receipt size={24} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8a97aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Faturado</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827' }}>{formatCurrency(stats.totalFaturado)}</span>
          </div>
        </div>

        <div style={{
          background: '#10b981', borderRadius: '12px', padding: '20px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', display: 'flex', alignItems: 'center', gap: '16px'
        }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.2)', color: '#ffffff' }}>
            <CheckCircle2 size={24} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recebido</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>{formatCurrency(stats.totalRecebido)}</span>
          </div>
        </div>

        <div style={{
          background: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #e6edf5', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', display: 'flex', alignItems: 'center', gap: '16px'
        }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#f59e0b' }}>
            <Clock size={24} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8a97aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>A Receber</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827' }}>{formatCurrency(stats.totalPendente)}</span>
          </div>
        </div>

        <div style={{
          background: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #e6edf5', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', display: 'flex', alignItems: 'center', gap: '16px'
        }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', color: '#ef4444' }}>
            <AlertTriangle size={24} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8a97aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inadimplência</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444' }}>{stats.taxaInadimplencia.toFixed(1)}%</span>
          </div>
        </div>
      </div>
      <div className="financeiro-controls-bar">`;
content = content.replace(oldStatsRegex, newStats);

// 4. Update the Visible Cobrancas Logic (remove the extra tabs filtering logic)
const oldVisibleLogic = `  const visibleCobranças = activeTab === 'inadimplencia'
    ? filteredCobranças.filter((cob) => cob.status === 'Vencido')
    : activeTab === 'nfse'
    ? filteredCobranças.filter((cob) => cob.status !== 'Cancelado')
    : filteredCobranças;`;
const newVisibleLogic = `  const visibleCobranças = filteredCobranças;`;
content = content.replace(oldVisibleLogic, newVisibleLogic);

fs.writeFileSync('src/modules/gestor/faturamento/FaturamentoPage.tsx', content);
