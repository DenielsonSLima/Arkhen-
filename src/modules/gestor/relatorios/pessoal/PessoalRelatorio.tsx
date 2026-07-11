import React from 'react';
import type { PessoalReportData } from '../services/relatoriosService';

interface PessoalRelatorioProps {
  data: PessoalReportData;
  formatCurrency: (val: number) => string;
}

export const PessoalRelatorio: React.FC<PessoalRelatorioProps> = ({ data, formatCurrency }) => {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Stats Cards */}
      <div className="financeiro-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="financeiro-stat-card" style={{ padding: '12px' }}>
          <div className="financeiro-stat-data">
            <span className="financeiro-stat-label">Total Funcionários</span>
            <span className="financeiro-stat-number" style={{ fontSize: '1.25rem' }}>{data.totalFuncionarios}</span>
          </div>
        </div>
        <div className="financeiro-stat-card" style={{ padding: '12px' }}>
          <div className="financeiro-stat-data">
            <span className="financeiro-stat-label">Funcionários Ativos</span>
            <span className="financeiro-stat-number" style={{ fontSize: '1.25rem', color: '#10b981' }}>{data.funcionariosAtivos}</span>
          </div>
        </div>
        <div className="financeiro-stat-card" style={{ padding: '12px' }}>
          <div className="financeiro-stat-data">
            <span className="financeiro-stat-label">Custo Mensal da Folha</span>
            <span className="financeiro-stat-number" style={{ fontSize: '1.25rem' }}>{formatCurrency(data.custoFolhaMensal)}</span>
          </div>
        </div>
        <div className="financeiro-stat-card" style={{ padding: '12px' }}>
          <div className="financeiro-stat-data">
            <span className="financeiro-stat-label">Média Salarial</span>
            <span className="financeiro-stat-number" style={{ fontSize: '1.25rem' }}>{formatCurrency(data.mediaSalarial)}</span>
          </div>
        </div>
      </div>

      {/* Docs Admissionais Pendentes */}
      {data.documentosPendentes > 0 && (
        <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.15)', padding: '16px', borderRadius: '10px' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#d97706', margin: 0 }}>
            ⚠️ Alerta de Conformidade: {data.documentosPendentes} Documento(s) Admissionais Pendentes
          </h4>
          <p style={{ fontSize: '0.78rem', color: '#b45309', marginTop: '4px', margin: 0 }}>
            Verifique o painel do Departamento Pessoal para identificar os colaboradores com pendências cadastrais.
          </p>
        </div>
      )}

      {/* Cargos Mais Comuns */}
      <div style={{ marginTop: '12px' }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: '16px' }}>Distribuição de Cargos (Top 5)</h4>
        {data.distribuicaoCargos.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Nenhum colaborador ativo cadastrado.</p>
        ) : (
          <div className="relatorio-bar-chart">
            {data.distribuicaoCargos.map((c) => {
              const maxVal = Math.max(...data.distribuicaoCargos.map(item => item.count)) || 1;
              const pct = (c.count / maxVal) * 100;
              return (
                <div key={c.cargo} className="relatorio-bar-row">
                  <span className="relatorio-bar-label">{c.cargo}</span>
                  <div className="relatorio-bar-container">
                    <div className="relatorio-bar-fill" style={{ width: `${pct}%` }}></div>
                  </div>
                  <span className="relatorio-bar-value">{c.count} {c.count === 1 ? 'colaborador' : 'colaboradores'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
