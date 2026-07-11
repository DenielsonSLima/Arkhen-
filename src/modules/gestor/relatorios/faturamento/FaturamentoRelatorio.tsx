import React from 'react';
import type { FaturamentoReportData } from '../services/relatoriosService';

interface FaturamentoRelatorioProps {
  data: FaturamentoReportData;
  formatCurrency: (val: number) => string;
}

export const FaturamentoRelatorio: React.FC<FaturamentoRelatorioProps> = ({ data, formatCurrency }) => {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Mini Stats */}
      <div className="financeiro-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="financeiro-stat-card" style={{ padding: '12px' }}>
          <div className="financeiro-stat-data">
            <span className="financeiro-stat-label">Total Faturado</span>
            <span className="financeiro-stat-number" style={{ fontSize: '1.25rem' }}>{formatCurrency(data.totalFaturado)}</span>
          </div>
        </div>
        <div className="financeiro-stat-card" style={{ padding: '12px' }}>
          <div className="financeiro-stat-data">
            <span className="financeiro-stat-label">Total Recebido</span>
            <span className="financeiro-stat-number" style={{ fontSize: '1.25rem', color: '#059669' }}>{formatCurrency(data.totalRecebido)}</span>
          </div>
        </div>
        <div className="financeiro-stat-card" style={{ padding: '12px' }}>
          <div className="financeiro-stat-data">
            <span className="financeiro-stat-label">Inadimplência</span>
            <span className="financeiro-stat-number" style={{ fontSize: '1.25rem', color: '#ef4444' }}>{data.taxaInadimplencia.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Gráfico de Faturamento por Mês */}
      <div style={{ marginTop: '12px' }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: '16px' }}>Evolução de Faturamento Mensal</h4>
        {data.historicoMensal.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Sem histórico de faturamento para o período.</p>
        ) : (
          <div className="relatorio-bar-chart">
            {data.historicoMensal.map((h) => {
              const maxVal = Math.max(...data.historicoMensal.map(item => item.faturado)) || 1;
              const pct = (h.faturado / maxVal) * 100;
              return (
                <div key={h.mes} className="relatorio-bar-row">
                  <span className="relatorio-bar-label">{h.mes}</span>
                  <div className="relatorio-bar-container">
                    <div className="relatorio-bar-fill" style={{ width: `${pct}%` }}></div>
                  </div>
                  <span className="relatorio-bar-value">{formatCurrency(h.faturado)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tabela dos 5 Maiores Clientes */}
      <div style={{ marginTop: '20px' }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: '12px' }}>Top 5 Clientes por Faturamento</h4>
        <div className="table-responsive">
          <table className="config-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th style={{ textAlign: 'right' }}>Total Faturado</th>
              </tr>
            </thead>
            <tbody>
              {data.clientesMaisFaturados.length === 0 ? (
                <tr>
                  <td colSpan={2} style={{ textAlign: 'center', padding: '16px', color: 'var(--color-text-muted)' }}>Nenhum faturamento registrado.</td>
                </tr>
              ) : (
                data.clientesMaisFaturados.map((c, i) => (
                  <tr key={i}>
                    <td><strong>{c.nome}</strong></td>
                    <td style={{ textAlign: 'right' }}><strong>{formatCurrency(c.valor)}</strong></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
