import React from 'react';
import { Calendar, Calculator } from 'lucide-react';
import { type ResultadoFerias, formatCurrency } from '../services/calculosNovas.service';
import { CurrencyInput } from '../../shared/CurrencyInput';

interface Props {
  salarioBruto: string;
  setSalarioBruto: (v: string) => void;
  diasFerias: string;
  setDiasFerias: (v: string) => void;
  abonoPecuniario: boolean;
  setAbonoPecuniario: (v: boolean) => void;
  adiantamento13: boolean;
  setAdiantamento13: (v: boolean) => void;
  dependentes: string;
  setDependentes: (v: string) => void;
  resultado: ResultadoFerias;
}

export const SimuladorFerias: React.FC<Props> = ({
  salarioBruto, setSalarioBruto,
  diasFerias, setDiasFerias,
  abonoPecuniario, setAbonoPecuniario,
  adiantamento13, setAdiantamento13,
  dependentes, setDependentes,
  resultado
}) => (
  <div className="calc-layout">
    <div className="calc-form-card">
      <h3><Calendar size={18} color="#c59235" /> Parâmetros de Férias</h3>
      
      <div className="calc-field">
        <label>Salário Bruto Base (R$)</label>
        <CurrencyInput
          value={salarioBruto}
          onValueChange={setSalarioBruto}
          placeholder="R$ 3.500,00"
        />
      </div>

      <div className="calc-field">
        <label>Dias de Férias a Gozar</label>
        <select value={diasFerias} onChange={(e) => setDiasFerias(e.target.value)}>
          <option value="30">30 dias</option>
          <option value="20">20 dias</option>
          <option value="15">15 dias</option>
          <option value="10">10 dias</option>
        </select>
      </div>

      <div className="calc-field">
        <label>Dependentes (IRRF)</label>
        <input
          type="number"
          min="0"
          value={dependentes}
          onChange={(e) => setDependentes(e.target.value)}
        />
      </div>

      <div className="calc-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
        <input
          type="checkbox"
          id="chk-abono"
          checked={abonoPecuniario}
          onChange={(e) => setAbonoPecuniario(e.target.checked)}
          style={{ width: '16px', height: '16px', accentColor: '#c59235' }}
        />
        <label htmlFor="chk-abono" style={{ cursor: 'pointer', userSelect: 'none' }}>Abono Pecuniário (Vender 1/3 das Férias)</label>
      </div>

      <div className="calc-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
        <input
          type="checkbox"
          id="chk-13"
          checked={adiantamento13}
          onChange={(e) => setAdiantamento13(e.target.checked)}
          style={{ width: '16px', height: '16px', accentColor: '#c59235' }}
        />
        <label htmlFor="chk-13" style={{ cursor: 'pointer', userSelect: 'none' }}>Adiantar 1ª Parcela do 13º Salário</label>
      </div>
    </div>

    <div className="resultado-card">
      <h3><Calculator size={18} color="#c59235" /> Resultado da Simulação</h3>
      
      <div className="resultado-row">
        <span className="r-label">Valor das Férias Proporcional</span>
        <span className="r-valor">{formatCurrency(resultado.valorFerias)}</span>
      </div>

      <div className="resultado-row">
        <span className="r-label">(+) 1/3 Constitucional sobre Férias</span>
        <span className="r-valor">{formatCurrency(resultado.tercoConstitucional)}</span>
      </div>

      {resultado.abonoPecuniario > 0 && (
        <>
          <div className="resultado-row">
            <span className="r-label">(+) Valor do Abono Pecuniário (Isento)</span>
            <span className="r-valor">{formatCurrency(resultado.abonoPecuniario)}</span>
          </div>
          <div className="resultado-row">
            <span className="r-label">(+) 1/3 Constitucional sobre Abono (Isento)</span>
            <span className="r-valor">{formatCurrency(resultado.tercoAbono)}</span>
          </div>
        </>
      )}

      {resultado.adiantamento13 > 0 && (
        <div className="resultado-row">
          <span className="r-label">(+) Adiantamento de 13º Salário</span>
          <span className="r-valor">{formatCurrency(resultado.adiantamento13)}</span>
        </div>
      )}

      <div className="resultado-row perigo">
        <span className="r-label">(-) Desconto INSS Férias</span>
        <span className="r-valor">- {formatCurrency(resultado.inss)}</span>
      </div>

      <div className="resultado-row perigo">
        <span className="r-label">(-) Desconto IRRF Férias</span>
        <span className="r-valor">- {formatCurrency(resultado.irrf)}</span>
      </div>

      <div className="resultado-row destaque verde" style={{ marginTop: '16px' }}>
        <span className="r-label">Valor Líquido a Receber</span>
        <span className="r-valor">{formatCurrency(resultado.totalLiquido)}</span>
      </div>

      <div className="resultado-row destaque azul" style={{ marginTop: '8px' }}>
        <span className="r-label">Custo Total para o Empregador</span>
        <span className="r-valor">{formatCurrency(resultado.custoEmpresa)}</span>
      </div>
    </div>
  </div>
);
