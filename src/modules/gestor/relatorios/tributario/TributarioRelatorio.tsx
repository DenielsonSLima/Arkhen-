import React from 'react';
import type { ComparativoRegimeData } from '../services/relatoriosService';

interface TributarioRelatorioProps {
  data: ComparativoRegimeData[];
  formatCurrency: (val: number) => string;
}

export const TributarioRelatorio: React.FC<TributarioRelatorioProps> = ({ data, formatCurrency }) => {
  const recomendado = data.find((r) => r.recomendado);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Box de recomendação do regime mais vantajoso */}
      {recomendado && (
        <div style={{ backgroundColor: 'rgba(197, 146, 53, 0.06)', border: '1px solid rgba(197, 146, 53, 0.15)', padding: '16px', borderRadius: '12px' }}>
          <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-gold-dark)', margin: 0 }}>
            💡 Regime Recomendado: {recomendado.regime}
          </h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-dark-muted)', marginTop: '4px', margin: 0 }}>
            De acordo com as simulações, o regime tributário mais econômico projetado é o <strong>{recomendado.regime}</strong>, proporcionando um custo anual total estimado de <strong>{formatCurrency(recomendado.custoTotal)}</strong>.
          </p>
        </div>
      )}

      {/* Tabela de Comparação Completa */}
      <div>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: '12px' }}>Quadro Comparativo Anual</h4>
        <div className="table-responsive">
          <table className="config-table">
            <thead>
              <tr>
                <th>Regime Tributário</th>
                <th>Alíquota Efetiva</th>
                <th style={{ textAlign: 'right' }}>Imposto Faturamento</th>
                <th style={{ textAlign: 'right' }}>CPP Patronal Folha</th>
                <th style={{ textAlign: 'right' }}>Custo Total Anual</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={i} style={r.recomendado ? { backgroundColor: 'rgba(16, 185, 129, 0.03)' } : {}}>
                  <td>
                    <strong>{r.regime}</strong>
                  </td>
                  <td>{r.aliquotaEfetiva.toFixed(2)}%</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(r.impostoTotal)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(r.custoPrevidenciario)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <strong style={r.recomendado ? { color: '#10b981' } : { color: 'var(--color-text-dark)' }}>{formatCurrency(r.custoTotal)}</strong>
                  </td>
                  <td>
                    <span 
                      className={`cobranca-badge ${r.recomendado ? 'pago' : 'cancelado'}`} 
                      style={{ fontSize: '0.68rem', fontWeight: 700 }}
                    >
                      {r.recomendado ? 'Recomendado' : 'Não recomendado'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
