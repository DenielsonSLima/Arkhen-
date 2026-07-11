import React from 'react';
import { AlertTriangle, Calculator } from 'lucide-react';
import { type ResultadoMulta, formatCurrency, formatPercent } from '../services/calculos.service';
import { CurrencyInput } from '../../shared/CurrencyInput';

interface Params { valorOriginal: string; dataVencimento: string; dataPagamento: string; }
interface Props {
  params: Params;
  setParams: (p: Params) => void;
  resultado: ResultadoMulta;
}

export const SimuladorMultas: React.FC<Props> = ({ params, setParams, resultado }) => {
  const set = (key: keyof Params) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setParams({ ...params, [key]: e.target.value });

  return (
    <div className="calc-layout">
      <div className="calc-form-card">
        <h3><AlertTriangle size={18} color="#c59235" />Multas e Juros — DARF</h3>
        <div className="calc-field">
          <label>Valor Original do DARF (R$)</label>
          <CurrencyInput
            value={params.valorOriginal}
            onValueChange={(value) => setParams({ ...params, valorOriginal: value })}
          />
        </div>
        <div className="calc-field">
          <label>Data de Vencimento</label>
          <input type="date" value={params.dataVencimento} onChange={set('dataVencimento')} />
        </div>
        <div className="calc-field">
          <label>Data de Pagamento (estimada)</label>
          <input type="date" value={params.dataPagamento} onChange={set('dataPagamento')} />
        </div>
        <div
          style={{
            marginTop: 16,
            background: 'rgba(239,68,68,0.05)',
            border: '1px solid rgba(239,68,68,0.15)',
            borderRadius: 8,
            padding: '12px 14px',
            fontSize: '0.8rem',
            color: '#b91c1c',
            lineHeight: 1.5,
          }}
        >
          <strong>⚠️ Multa:</strong> 0,33% ao dia, limitada a 20% do valor original.
          <br />
          <strong>Juros:</strong> Taxa Selic acumulada (simulada em 10,75% a.a.).
        </div>
      </div>

      <div className="resultado-card">
        <h3><Calculator size={18} color="#c59235" />Acréscimos Calculados</h3>
        <div className="resultado-row">
          <span className="r-label">Valor Original</span>
          <span className="r-valor">{formatCurrency(resultado.valorOriginal)}</span>
        </div>
        <div className="resultado-row">
          <span className="r-label">Dias em Atraso</span>
          <span className="r-valor" style={{ color: resultado.diasAtraso > 0 ? '#ef4444' : '#10b981' }}>
            {resultado.diasAtraso} dias
          </span>
        </div>
        <div className="resultado-row perigo">
          <span className="r-label">
            Multa ({formatPercent(resultado.multaPercentual)})
          </span>
          <span className="r-valor">+ {formatCurrency(resultado.multaValor)}</span>
        </div>
        <div className="resultado-row perigo">
          <span className="r-label">
            Juros Selic ({formatPercent(resultado.jurosPercentual)})
          </span>
          <span className="r-valor">+ {formatCurrency(resultado.jurosValor)}</span>
        </div>
        <div className="resultado-row destaque">
          <span className="r-label">Total a Pagar</span>
          <span className="r-valor">{formatCurrency(resultado.totalPagar)}</span>
        </div>
        {resultado.diasAtraso === 0 && (
          <div
            style={{
              marginTop: 12,
              background: 'rgba(16,185,129,0.08)',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: '0.82rem',
              color: '#059669',
              fontWeight: 600,
            }}
          >
            ✅ Pagamento em dia — sem acréscimos.
          </div>
        )}
      </div>
    </div>
  );
};
