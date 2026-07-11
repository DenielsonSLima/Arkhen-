import React from 'react';
import { UserCheck, Calculator } from 'lucide-react';
import { type ResultadoContratacao, formatCurrency } from '../services/calculosNovas.service';
import { CurrencyInput } from '../../shared/CurrencyInput';

interface Props {
  salarioProposto: string;
  setSalarioProposto: (v: string) => void;
  valeTransporte: string;
  setValeTransporte: (v: string) => void;
  valeAlimentacao: string;
  setValeAlimentacao: (v: string) => void;
  planoSaude: string;
  setPlanoSaude: (v: string) => void;
  resultado: ResultadoContratacao;
}

export const SimuladorContratacao: React.FC<Props> = ({
  salarioProposto, setSalarioProposto,
  valeTransporte, setValeTransporte,
  valeAlimentacao, setValeAlimentacao,
  planoSaude, setPlanoSaude,
  resultado
}) => (
  <div className="calc-layout">
    <div className="calc-form-card">
      <h3><UserCheck size={18} color="#c59235" /> Parâmetros de Contratação</h3>

      <div className="calc-field">
        <label>Remuneração / Bolsa Proposta (R$)</label>
        <CurrencyInput
          value={salarioProposto}
          onValueChange={setSalarioProposto}
          placeholder="R$ 3.500,00"
        />
      </div>

      <div className="calc-field">
        <label>Vale Transporte Mensal (R$)</label>
        <CurrencyInput
          value={valeTransporte}
          onValueChange={setValeTransporte}
          placeholder="R$ 200,00"
        />
      </div>

      <div className="calc-field">
        <label>Vale Alimentação / Refeição (R$)</label>
        <CurrencyInput
          value={valeAlimentacao}
          onValueChange={setValeAlimentacao}
          placeholder="R$ 500,00"
        />
      </div>

      <div className="calc-field">
        <label>Plano de Saúde (Custo da Empresa) (R$)</label>
        <CurrencyInput
          value={planoSaude}
          onValueChange={setPlanoSaude}
          placeholder="R$ 300,00"
        />
      </div>
    </div>

    <div className="resultado-card">
      <h3><Calculator size={18} color="#c59235" /> Comparativo de Contratação</h3>

      <div className="table-responsive" style={{ marginTop: 0 }}>
        <table className="config-table" style={{ fontSize: '0.8rem', width: '100%' }}>
          <thead>
            <tr>
              <th>Modalidade</th>
              <th style={{ textAlign: 'right' }}>Custo Mensal (Empresa)</th>
              <th style={{ textAlign: 'right' }}>Custo Anual (Empresa)</th>
              <th style={{ textAlign: 'right' }}>Líquido Estimado (Profissional)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>CLT</strong></td>
              <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{formatCurrency(resultado.custoCltMensal)}</td>
              <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{formatCurrency(resultado.custoCltAnual)}</td>
              <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{formatCurrency(resultado.liquidoClt)}</td>
            </tr>
            <tr>
              <td><strong>PJ (Simples Nacional)</strong></td>
              <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{formatCurrency(resultado.custoPjMensal)}</td>
              <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{formatCurrency(resultado.custoPjAnual)}</td>
              <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{formatCurrency(resultado.liquidoPj)}</td>
            </tr>
            <tr>
              <td><strong>Estagiário</strong></td>
              <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{formatCurrency(resultado.custoEstagioMensal)}</td>
              <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{formatCurrency(resultado.custoEstagioAnual)}</td>
              <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{formatCurrency(resultado.liquidoEstagio)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{
        marginTop: 16,
        background: 'rgba(197,146,53,0.06)',
        border: '1px solid rgba(197,146,53,0.15)',
        borderRadius: 8,
        padding: '12px 14px',
        fontSize: '0.78rem',
        color: '#aa7c28',
        lineHeight: 1.5,
      }}>
        <strong>💡 Dica do Consultor:</strong>
        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
          <li>A contratação CLT engloba todos os direitos (13º, férias, 1/3, INSS, FGTS), sendo a modalidade mais estável mas com maior custo indireto.</li>
          <li>PJ é ideal para serviços especializados, com recolhimento reduzido pelo Simples Nacional (Anexo III).</li>
          <li>Estagiários são isentos de encargos de folha (INSS, FGTS, aviso prévio), exigindo apenas bolsa-auxílio, seguro e benefícios de locomoção.</li>
        </ul>
      </div>
    </div>
  </div>
);
