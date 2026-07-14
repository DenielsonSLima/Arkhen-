import React from 'react';
import type { HistoricoPlanejamento } from '../services/planejamento.types';
import { formatCurrency } from '../services/planejamento.service';
import { History } from 'lucide-react';

interface Props {
  historico: HistoricoPlanejamento[];
}

export const HistoricoPlanejamentos: React.FC<Props> = ({ historico }) => {
  if (historico.length === 0) {
    return (
      <div className="planejamento-tab-content">
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
          <History size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>Nenhuma simulação registrada ainda.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="planejamento-tab-content">
      <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 20 }}>
        Histórico de comparativos e análises tributárias realizadas para as empresas clientes.
      </p>
      <div className="historico-list">
        {historico.map((h) => {
          const dataFormatada = new Date(h.dataSimulacao).toLocaleDateString('pt-BR');
          const mudou = h.regimeAnalisado !== h.regimeSugerido;
          return (
            <div key={h.id} className="historico-item">
              <div className="historico-data">{dataFormatada}</div>
              <div className="historico-empresa">
                <strong>{h.clienteNome}</strong>
                <span>
                  {h.regimeAnalisado}
                  {mudou && (
                    <span style={{ color: '#c59235', margin: '0 4px' }}>→</span>
                  )}
                  {mudou && h.regimeSugerido}
                </span>
                {h.observacao && (
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginTop: 2 }}>
                    {h.observacao}
                  </span>
                )}
              </div>
              <div className="historico-economia">
                <div className="valor">
                  {h.economiaEstimada > 0 ? `+${formatCurrency(h.economiaEstimada)}` : '—'}
                </div>
                <div className="label">economia/ano</div>
              </div>
              <div>
                <span className="historico-regime-badge">{h.regimeSugerido}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
