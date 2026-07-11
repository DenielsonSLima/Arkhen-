import React from 'react';
import { Briefcase, Calculator } from 'lucide-react';
import { type ResultadoProLabore, formatCurrency } from '../services/calculos.service';
import { CurrencyInput } from '../../shared/CurrencyInput';

interface Props {
  valor: string;
  setValor: (v: string) => void;
  resultado: ResultadoProLabore;
}

export const SimuladorProLabore: React.FC<Props> = ({ valor, setValor, resultado }) => (
  <div className="calc-layout">
    <div className="calc-form-card">
      <h3><Briefcase size={18} color="#c59235" />Pró-Labore do Sócio</h3>
      <div className="calc-field">
        <label>Valor do Pró-Labore (R$)</label>
        <CurrencyInput
          value={valor}
          onValueChange={setValor}
          placeholder="R$ 5.000,00"
        />
      </div>
      <div
        style={{
          marginTop: 16,
          background: 'rgba(59,130,246,0.06)',
          border: '1px solid rgba(59,130,246,0.15)',
          borderRadius: 8,
          padding: '12px 14px',
          fontSize: '0.8rem',
          color: '#2563eb',
          lineHeight: 1.5,
        }}
      >
        <strong>ℹ️ Informação:</strong> O pró-labore é a remuneração do sócio-administrador.
        A alíquota de INSS é de 11% (contribuinte individual), com teto de R$ 908,86.
      </div>
    </div>

    <div className="resultado-card">
      <h3><Calculator size={18} color="#c59235" />Resultado</h3>
      <div className="resultado-row">
        <span className="r-label">Valor Bruto do Pró-Labore</span>
        <span className="r-valor">{formatCurrency(resultado.valorProLabore)}</span>
      </div>
      <div className="resultado-row perigo">
        <span className="r-label">(-) INSS Sócio (11%)</span>
        <span className="r-valor">- {formatCurrency(resultado.inss)}</span>
      </div>
      <div className="resultado-row perigo">
        <span className="r-label">(-) IRRF</span>
        <span className="r-valor">- {formatCurrency(resultado.irrf)}</span>
      </div>
      <div className="resultado-row destaque verde">
        <span className="r-label">Valor Líquido</span>
        <span className="r-valor">{formatCurrency(resultado.liquido)}</span>
      </div>
    </div>
  </div>
);
