import React from 'react';
import { Percent, Calculator } from 'lucide-react';
import { type ResultadoSimulacaoImposto, formatCurrency } from '../services/calculosNovas.service';
import { CurrencyInput } from '../../shared/CurrencyInput';

interface Props {
  faturamentoMensal: string;
  setFaturamentoMensal: (v: string) => void;
  tipoAtividade: string;
  setTipoAtividade: (v: string) => void;
  aliquotaEstimada: string;
  setAliquotaEstimada: (v: string) => void;
  resultado: ResultadoSimulacaoImposto;
}

export const SimuladorImposto: React.FC<Props> = ({
  faturamentoMensal, setFaturamentoMensal,
  tipoAtividade, setTipoAtividade,
  aliquotaEstimada, setAliquotaEstimada,
  resultado
}) => (
  <div className="calc-layout">
    <div className="calc-form-card">
      <h3><Percent size={18} color="#c59235" /> Parâmetros de Simulação de Impostos</h3>

      <div className="calc-field">
        <label>Faturamento Mensal Estimado (R$)</label>
        <CurrencyInput
          value={faturamentoMensal}
          onValueChange={setFaturamentoMensal}
          placeholder="R$ 50.000,00"
        />
      </div>

      <div className="calc-field">
        <label>Segmento de Atividade</label>
        <select value={tipoAtividade} onChange={(e) => setTipoAtividade(e.target.value)}>
          <option value="servico">Serviços</option>
          <option value="comercio">Comércio</option>
          <option value="industria">Indústria</option>
        </select>
      </div>

      <div className="calc-field">
        <label>Alíquota de Imposto Estimada / Alvo (%)</label>
        <input
          type="number"
          step="0.01"
          min="0.1"
          max="50"
          value={aliquotaEstimada}
          onChange={(e) => setAliquotaEstimada(e.target.value)}
        />
      </div>
    </div>

    <div className="resultado-card">
      <h3><Calculator size={18} color="#c59235" /> Simulação de Impostos Devidos</h3>

      <div className="resultado-row destaque" style={{ marginTop: 0, marginBottom: 12 }}>
        <span className="r-label">Total de Impostos a Recolher</span>
        <span className="r-valor">{formatCurrency(resultado.impostoTotal)}</span>
      </div>

      <div className="resultado-row">
        <span className="r-label">Alíquota Efetiva Final</span>
        <span className="r-valor">{resultado.aliquotaEfetiva.toFixed(2)}%</span>
      </div>

      <div style={{ marginTop: '16px' }}>
        <strong style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
          Detalhamento Estimado de Guias
        </strong>
        {resultado.detalheImpostos.map((imposto) => (
          <div key={imposto.nome} className="resultado-row" style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span className="r-label">{imposto.nome} (Proporção)</span>
            <span className="r-valor">
              {formatCurrency(imposto.valor)} <small style={{ color: '#64748b', fontWeight: 500, marginLeft: '4px' }}>({imposto.percentual.toFixed(2)}%)</small>
            </span>
          </div>
        ))}
      </div>
    </div>
  </div>
);
