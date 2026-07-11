import React from 'react';
import type { ConformidadeReportData } from '../services/relatoriosService';

interface AtividadesRelatorioProps {
  data: ConformidadeReportData;
}

export const AtividadesRelatorio: React.FC<AtividadesRelatorioProps> = ({ data }) => {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Stats Cards */}
      <div className="financeiro-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="financeiro-stat-card" style={{ padding: '12px' }}>
          <div className="financeiro-stat-data">
            <span className="financeiro-stat-label">Total Obrigações</span>
            <span className="financeiro-stat-number" style={{ fontSize: '1.25rem' }}>{data.totalObrigacoes}</span>
          </div>
        </div>
        <div className="financeiro-stat-card" style={{ padding: '12px' }}>
          <div className="financeiro-stat-data">
            <span className="financeiro-stat-label">Entregues</span>
            <span className="financeiro-stat-number" style={{ fontSize: '1.25rem', color: '#059669' }}>{data.concluidas}</span>
          </div>
        </div>
        <div className="financeiro-stat-card" style={{ padding: '12px' }}>
          <div className="financeiro-stat-data">
            <span className="financeiro-stat-label">Em Atraso</span>
            <span className="financeiro-stat-number" style={{ fontSize: '1.25rem', color: '#ef4444' }}>{data.atrasadas}</span>
          </div>
        </div>
        <div className="financeiro-stat-card" style={{ padding: '12px' }}>
          <div className="financeiro-stat-data">
            <span className="financeiro-stat-label">Conformidade (Compliance)</span>
            <span className="financeiro-stat-number" style={{ fontSize: '1.25rem', color: data.taxaConformidade >= 90 ? '#059669' : '#d97706' }}>
              {data.taxaConformidade.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Distribuição por Tipo de Guia/Obrigação */}
      <div style={{ marginTop: '12px' }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: '16px' }}>Conformidade por Tipo de Obrigação</h4>
        {data.distribuicaoObrigacoes.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Sem atividades de obrigações registradas.</p>
        ) : (
          <div className="relatorio-bar-chart">
            {data.distribuicaoObrigacoes.map((item) => {
              const complianceRate = item.total > 0 ? (item.concluidas / item.total) * 100 : 0;
              return (
                <div key={item.nome} className="relatorio-bar-row">
                  <span className="relatorio-bar-label">{item.nome}</span>
                  <div className="relatorio-bar-container">
                    <div 
                      className="relatorio-bar-fill" 
                      style={{ 
                        width: `${complianceRate}%`, 
                        background: complianceRate >= 80 ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' 
                      }}
                    ></div>
                  </div>
                  <span className="relatorio-bar-value">{complianceRate.toFixed(0)}% ({item.concluidas}/{item.total})</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
