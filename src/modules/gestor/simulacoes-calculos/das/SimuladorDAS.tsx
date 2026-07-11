import React from 'react';
import { Receipt, Calculator } from 'lucide-react';
import { type ResultadoDAS, formatCurrency, formatPercent } from '../services/calculos.service';
import { CurrencyInput } from '../../shared/CurrencyInput';
import type { AnexoDasParametro } from '../../parametrizacao/parametros-calculo/services/parametrosCalculoService';

interface Params { faturamentoMensal: string; faturamento12Meses: string; anexo: string; }
interface Props {
  params: Params;
  setParams: (p: Params) => void;
  resultado: ResultadoDAS;
  anexosDas: AnexoDasParametro[];
}

export const SimuladorDAS: React.FC<Props> = ({ params, setParams, resultado, anexosDas }) => {
  const set = (key: keyof Params) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setParams({ ...params, [key]: e.target.value });

  return (
    <div className="calc-layout">
      <div className="calc-form-card">
        <h3><Receipt size={18} color="#c59235" />DAS — Simples Nacional</h3>
        <div className="calc-field">
          <label>Faturamento do Mês (R$)</label>
          <CurrencyInput
            value={params.faturamentoMensal}
            onValueChange={(value) => setParams({ ...params, faturamentoMensal: value })}
          />
        </div>
        <div className="calc-field">
          <label>Faturamento Acumulado 12 Meses (R$)</label>
          <CurrencyInput
            value={params.faturamento12Meses}
            onValueChange={(value) => setParams({ ...params, faturamento12Meses: value })}
          />
        </div>
        <div className="calc-field">
          <label>Anexo</label>
          <select value={params.anexo} onChange={set('anexo')}>
            {anexosDas.map((anexo) => (
              <option key={anexo.id} value={anexo.id}>{anexo.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="resultado-card">
        <h3><Calculator size={18} color="#c59235" />DAS Calculado</h3>
        <div className="resultado-row">
          <span className="r-label">Faturamento 12 Meses (RBT12)</span>
          <span className="r-valor">{formatCurrency(resultado.faturamento12Meses)}</span>
        </div>
        <div className="resultado-row">
          <span className="r-label">Faixa na Tabela</span>
          <span className="r-valor">
            <span className="faixa-detalhe">{resultado.faixaNumero}ª faixa</span>
          </span>
        </div>
        <div className="resultado-row">
          <span className="r-label">Alíquota Nominal</span>
          <span className="r-valor">{formatPercent(resultado.aliquotaNominal)}</span>
        </div>
        <div className="resultado-row">
          <span className="r-label">Valor a Deduzir</span>
          <span className="r-valor">{formatCurrency(resultado.valorDeduzir)}</span>
        </div>
        <div className="resultado-row azul">
          <span className="r-label">Alíquota Efetiva</span>
          <span className="r-valor">{formatPercent(resultado.aliquotaEfetiva)}</span>
        </div>
        <div className="resultado-row destaque">
          <span className="r-label">Valor do DAS a Recolher</span>
          <span className="r-valor">{formatCurrency(resultado.valorDAS)}</span>
        </div>
      </div>
    </div>
  );
};
