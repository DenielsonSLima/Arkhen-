import React from 'react';
import { FileText, Calculator } from 'lucide-react';
import { type ResultadoPisCofins, formatCurrency, formatPercent } from '../services/calculos.service';
import { CurrencyInput } from '../../shared/CurrencyInput';
import type { RegimePisCofinsParametro } from '../../parametrizacao/parametros-calculo/services/parametrosCalculoService';

interface Params { faturamento: string; regime: string; creditosEntrada: string; }
interface Props {
  params: Params;
  setParams: (p: Params) => void;
  resultado: ResultadoPisCofins;
  regimesPisCofins: RegimePisCofinsParametro[];
}

export const SimuladorPisCofins: React.FC<Props> = ({ params, setParams, resultado, regimesPisCofins }) => {
  const set = (key: keyof Params) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setParams({ ...params, [key]: e.target.value });

  const selectedRegime = regimesPisCofins.find((regime) => regime.id === params.regime);

  return (
    <div className="calc-layout">
      <div className="calc-form-card">
        <h3><FileText size={18} color="#c59235" />PIS / COFINS</h3>
        <div className="calc-field">
          <label>Regime de Apuração</label>
          <select value={params.regime} onChange={set('regime')}>
            {regimesPisCofins.map((regime) => (
              <option key={regime.id} value={regime.id}>
                {regime.label} - PIS {formatPercent(regime.aliquotaPis)} / COFINS {formatPercent(regime.aliquotaCofins)}
              </option>
            ))}
          </select>
        </div>
        <div className="calc-field">
          <label>Faturamento do Mês (R$)</label>
          <CurrencyInput
            value={params.faturamento}
            onValueChange={(value) => setParams({ ...params, faturamento: value })}
          />
        </div>
        {selectedRegime?.permiteCreditoEntrada && (
          <div className="calc-field">
            <label>Compras / Entradas com Crédito (R$)</label>
            <CurrencyInput
              value={params.creditosEntrada}
              onValueChange={(value) => setParams({ ...params, creditosEntrada: value })}
            />
          </div>
        )}
      </div>

      <div className="resultado-card">
        <h3><Calculator size={18} color="#c59235" />Apuração PIS / COFINS</h3>
        <div className="resultado-row">
          <span className="r-label">Débito PIS</span>
          <span className="r-valor perigo">{formatCurrency(resultado.debitoPIS)}</span>
        </div>
        <div className="resultado-row">
          <span className="r-label">Débito COFINS</span>
          <span className="r-valor perigo">{formatCurrency(resultado.debitoCOFINS)}</span>
        </div>
        {resultado.creditosApurados > 0 && (
          <div className="resultado-row verde">
            <span className="r-label">Créditos Apurados</span>
            <span className="r-valor">- {formatCurrency(resultado.creditosApurados)}</span>
          </div>
        )}
        <div className="resultado-row">
          <span className="r-label">Saldo PIS</span>
          <span className="r-valor">{formatCurrency(resultado.saldoPIS)}</span>
        </div>
        <div className="resultado-row">
          <span className="r-label">Saldo COFINS</span>
          <span className="r-valor">{formatCurrency(resultado.saldoCOFINS)}</span>
        </div>
        <div className="resultado-row destaque">
          <span className="r-label">Total a Recolher</span>
          <span className="r-valor">{formatCurrency(resultado.totalPagar)}</span>
        </div>
        <div style={{ marginTop: 12, fontSize: '0.75rem', color: '#94a3b8' }}>
          Alíquota efetiva sobre faturamento:{' '}
          <strong>{formatPercent(resultado.faturamento > 0 ? (resultado.totalPagar / resultado.faturamento) * 100 : 0)}</strong>
        </div>
      </div>
    </div>
  );
};
