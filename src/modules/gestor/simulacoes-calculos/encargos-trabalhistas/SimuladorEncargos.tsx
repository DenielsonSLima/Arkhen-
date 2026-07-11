import React from 'react';
import { Landmark, Calculator } from 'lucide-react';
import { type ResultadoEncargos, formatCurrency } from '../services/calculosNovas.service';
import { CurrencyInput } from '../../shared/CurrencyInput';

interface Props {
  salarioBruto: string;
  setSalarioBruto: (v: string) => void;
  regimeEmpresa: string;
  setRegimeEmpresa: (v: string) => void;
  rat: string;
  setRat: (v: string) => void;
  fap: string;
  setFap: (v: string) => void;
  terceiros: string;
  setTerceiros: (v: string) => void;
  resultado: ResultadoEncargos;
}

export const SimuladorEncargos: React.FC<Props> = ({
  salarioBruto, setSalarioBruto,
  regimeEmpresa, setRegimeEmpresa,
  rat, setRat,
  fap, setFap,
  terceiros, setTerceiros,
  resultado
}) => (
  <div className="calc-layout">
    <div className="calc-form-card">
      <h3><Landmark size={18} color="#c59235" /> Parâmetros de Encargos Trabalhistas</h3>

      <div className="calc-field">
        <label>Base da Folha / Salário Bruto (R$)</label>
        <CurrencyInput
          value={salarioBruto}
          onValueChange={setSalarioBruto}
          placeholder="R$ 10.000,00"
        />
      </div>

      <div className="calc-field">
        <label>Enquadramento da Empresa</label>
        <select value={regimeEmpresa} onChange={(e) => setRegimeEmpresa(e.target.value)}>
          <option value="simples_geral">Simples Nacional (Geral - Exceto Anexo IV)</option>
          <option value="simples_anexo_iv">Simples Nacional (Anexo IV)</option>
          <option value="lucro_presumido">Lucro Presumido</option>
          <option value="lucro_real">Lucro Real</option>
        </select>
      </div>

      <div className="rescisao-select-grid">
        <div className="calc-field">
          <label>Alíquota RAT (%)</label>
          <select value={rat} onChange={(e) => setRat(e.target.value)} disabled={regimeEmpresa === 'simples_geral'}>
            <option value="1">1% (Leve)</option>
            <option value="2">2% (Médio)</option>
            <option value="3">3% (Grave)</option>
          </select>
        </div>

        <div className="calc-field">
          <label>Fator FAP (0.5 a 2.0)</label>
          <input
            type="number"
            step="0.01"
            min="0.5"
            max="2"
            value={fap}
            onChange={(e) => setFap(e.target.value)}
            disabled={regimeEmpresa === 'simples_geral'}
          />
        </div>
      </div>

      <div className="calc-field">
        <label>Alíquota Outras Entidades / Terceiros (%)</label>
        <input
          type="number"
          step="0.1"
          min="0"
          max="10"
          value={terceiros}
          onChange={(e) => setTerceiros(e.target.value)}
          disabled={regimeEmpresa === 'simples_geral'}
        />
      </div>
    </div>

    <div className="resultado-card">
      <h3><Calculator size={18} color="#c59235" /> Detalhamento de Encargos</h3>

      <div className="resultado-row">
        <span className="r-label">INSS Patronal (20%)</span>
        <span className="r-valor">{formatCurrency(resultado.inssPatronal)}</span>
      </div>

      <div className="resultado-row">
        <span className="r-label">RAT Ajustado (RAT x FAP)</span>
        <span className="r-valor">{formatCurrency(resultado.ratAjustado)}</span>
      </div>

      <div className="resultado-row">
        <span className="r-label">Terceiros / Outras Entidades</span>
        <span className="r-valor">{formatCurrency(resultado.terceirosValor)}</span>
      </div>

      <div className="resultado-row">
        <span className="r-label">FGTS (8%)</span>
        <span className="r-valor">{formatCurrency(resultado.fgts)}</span>
      </div>

      <div className="resultado-row">
        <span className="r-label">Provisão Mensal (13º + Férias + 1/3)</span>
        <span className="r-valor">{formatCurrency(resultado.provisaoFerias13)}</span>
      </div>

      <div className="resultado-row destaque" style={{ marginTop: '16px' }}>
        <span className="r-label">Custo Total de Encargos</span>
        <span className="r-valor" style={{ color: '#0f172a' }}>{formatCurrency(resultado.totalEncargosValor)}</span>
      </div>

      <div className="resultado-row destaque verde" style={{ marginTop: '8px' }}>
        <span className="r-label">Percentual sobre a Folha</span>
        <span className="r-valor">{resultado.totalPercentual.toFixed(2)}%</span>
      </div>
    </div>
  </div>
);
