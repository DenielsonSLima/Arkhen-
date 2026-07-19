import React from 'react';
import { History, Calculator } from 'lucide-react';
import { type ResultadoTempoEmpresa, formatCurrency } from '../services/calculosNovas.service';
import { CurrencyInput } from '../../shared/CurrencyInput';

interface Props {
  dataAdmissao: string;
  setDataAdmissao: (v: string) => void;
  dataReferencia: string;
  setDataReferencia: (v: string) => void;
  salarioBase: string;
  setSalarioBase: (v: string) => void;
  resultado: ResultadoTempoEmpresa;
}

export const SimuladorTempoEmpresa: React.FC<Props> = ({
  dataAdmissao, setDataAdmissao,
  dataReferencia, setDataReferencia,
  salarioBase, setSalarioBase,
  resultado
}) => (
  <div className="calc-layout">
    <div className="calc-form-card">
      <h3><History size={18} color="#c59235" /> Parâmetros de Tempo de Empresa</h3>

      <div className="calc-field">
        <label>Salário Base (R$)</label>
        <CurrencyInput
          value={salarioBase}
          onValueChange={setSalarioBase}
          placeholder="R$ 3.500,00"
        />
      </div>

      <div className="calc-field">
        <label>Data de Admissão</label>
        <input
          type="date"
          value={dataAdmissao}
          onChange={(e) => setDataAdmissao(e.target.value)}
        />
      </div>

      <div className="calc-field">
        <label>Data de Referência / Demissão</label>
        <input
          type="date"
          value={dataReferencia}
          onChange={(e) => setDataReferencia(e.target.value)}
        />
      </div>
    </div>

    <div className="resultado-card">
      <h3><Calculator size={18} color="#c59235" /> Resultados do Vínculo</h3>

      <div className="resultado-row destaque" style={{ marginTop: 0, marginBottom: 12 }}>
        <span className="r-label">Tempo de Serviço</span>
        <span className="r-valor" style={{ fontSize: '0.95rem', color: '#0f172a' }}>
          {resultado.anos} anos, {resultado.meses} meses e {resultado.dias} dias
        </span>
      </div>

      <div className="resultado-row">
        <span className="r-label">Provisão de 13º Salário Proporcional</span>
        <span className="r-valor">{formatCurrency(resultado.provisao13)}</span>
      </div>

      <div className="resultado-row">
        <span className="r-label">Provisão de Férias Proporcionais</span>
        <span className="r-valor">{formatCurrency(resultado.provisaoFerias)}</span>
      </div>

      <div className="resultado-row">
        <span className="r-label">Provisão de 1/3 sobre Férias</span>
        <span className="r-valor">{formatCurrency(resultado.provisaoTerco)}</span>
      </div>

      <div className="resultado-row">
        <span className="r-label">FGTS histórico estimado (sem extrato)</span>
        <span className="r-valor">{formatCurrency(resultado.fgtsAcumulado)}</span>
      </div>

      <div className="resultado-row perigo">
        <span className="r-label">Multa Rescisória Projetada (40% FGTS)</span>
        <span className="r-valor">{formatCurrency(resultado.multaFgtsProjetada)}</span>
      </div>

      <div className="resultado-row destaque verde" style={{ marginTop: '16px' }}>
        <span className="r-label">Provisões correntes + FGTS estimado</span>
        <span className="r-valor">{formatCurrency(resultado.custoTotalAcumulado)}</span>
      </div>
    </div>
  </div>
);
