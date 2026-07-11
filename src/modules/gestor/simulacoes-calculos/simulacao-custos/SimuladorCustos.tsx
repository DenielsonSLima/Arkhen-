import React from 'react';
import { DollarSign, Calculator } from 'lucide-react';
import { type ResultadoCustos, formatCurrency } from '../services/calculosNovas.service';
import { CurrencyInput } from '../../shared/CurrencyInput';

interface Props {
  custosFixos: string;
  setCustosFixos: (v: string) => void;
  custosVariaveisPercentual: string;
  setCustosVariaveisPercentual: (v: string) => void;
  markupDesejado: string;
  setMarkupDesejado: (v: string) => void;
  resultado: ResultadoCustos;
}

export const SimuladorCustos: React.FC<Props> = ({
  custosFixos, setCustosFixos,
  custosVariaveisPercentual, setCustosVariaveisPercentual,
  markupDesejado, setMarkupDesejado,
  resultado
}) => (
  <div className="calc-layout">
    <div className="calc-form-card">
      <h3><DollarSign size={18} color="#c59235" /> Parâmetros de Custos e Markup</h3>

      <div className="calc-field">
        <label>Custos Fixos Mensais (Aluguel, Folha, Pro-labore, etc.) (R$)</label>
        <CurrencyInput
          value={custosFixos}
          onValueChange={setCustosFixos}
          placeholder="R$ 15.000,00"
        />
      </div>

      <div className="calc-field">
        <label>Custos Variáveis (%) (Impostos + Insumos + Comissões)</label>
        <input
          type="number"
          min="0"
          max="95"
          value={custosVariaveisPercentual}
          onChange={(e) => setCustosVariaveisPercentual(e.target.value)}
        />
      </div>

      <div className="calc-field">
        <label>Margem de Lucro Desejada / Markup Alvo (%)</label>
        <input
          type="number"
          min="1"
          max="80"
          value={markupDesejado}
          onChange={(e) => setMarkupDesejado(e.target.value)}
        />
      </div>
    </div>

    <div className="resultado-card">
      <h3><Calculator size={18} color="#c59235" /> Análise de Viabilidade Financeira</h3>

      <div className="resultado-row">
        <span className="r-label">Margem de Contribuição (%)</span>
        <span className="r-valor" style={{ color: '#10b981' }}>{resultado.margemContribuicaoPercentual.toFixed(2)}%</span>
      </div>

      <div className="resultado-row destaque" style={{ marginTop: '8px' }}>
        <span className="r-label">Ponto de Equilíbrio Operacional (Break-even)</span>
        <span className="r-valor" style={{ color: '#ef4444' }}>{formatCurrency(resultado.pontoEquilibrio)}</span>
      </div>

      <div className="resultado-row">
        <span className="r-label">Faturamento Mínimo para Margem Desejada</span>
        <span className="r-valor">{formatCurrency(resultado.faturamentoAlvo)}</span>
      </div>

      <div className="resultado-row destaque verde" style={{ marginTop: '16px' }}>
        <span className="r-label">Lucro Mensal Estimado (com Faturamento Alvo)</span>
        <span className="r-valor">{formatCurrency(resultado.lucroEstimado)}</span>
      </div>

      <div style={{
        marginTop: 16,
        padding: '12px',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        fontSize: '0.75rem',
        color: '#64748b',
        lineHeight: '1.4'
      }}>
        💡 <strong>Entendendo os resultados:</strong> O ponto de equilíbrio é o faturamento necessário para cobrir todos os custos fixos e variáveis, resultando em lucro zero. Qualquer receita acima do ponto de equilíbrio contribui diretamente para a formação do lucro da empresa.
      </div>
    </div>
  </div>
);
