import React from 'react';
import { Landmark, Calculator, AlertCircle } from 'lucide-react';
import { type ResultadoComparativoRegime, formatCurrency } from '../services/calculosNovas.service';
import { CurrencyInput } from '../../shared/CurrencyInput';

interface Props {
  faturamentoAnual: string;
  setFaturamentoAnual: (v: string) => void;
  comprasInsumosAnual: string;
  setComprasInsumosAnual: (v: string) => void;
  folhaAnual: string;
  setFolhaAnual: (v: string) => void;
  margemLucro: string;
  setMargemLucro: (v: string) => void;
  tipoEmpresa: string;
  setTipoEmpresa: (v: string) => void;
  naturezaJuridica: string;
  setNaturezaJuridica: (v: string) => void;
  tiposEmpresaOptions: { id: string; nome: string; descricao: string }[];
  naturezasJuridicasOptions: { id: string; nome: string; descricao: string }[];
  resultado: ResultadoComparativoRegime;
}

export const SimuladorComparativoRegime: React.FC<Props> = ({
  faturamentoAnual, setFaturamentoAnual,
  comprasInsumosAnual, setComprasInsumosAnual,
  folhaAnual, setFolhaAnual,
  margemLucro, setMargemLucro,
  tipoEmpresa, setTipoEmpresa,
  naturezaJuridica, setNaturezaJuridica,
  tiposEmpresaOptions,
  naturezasJuridicasOptions,
  resultado
}) => (
  <div className="calc-layout">
    <div className="calc-form-card">
      <h3><Landmark size={18} color="#c59235" /> Parâmetros do Negócio (Anual)</h3>

      <div className="calc-field">
        <label>Faturamento Bruto Anual Projetado (R$)</label>
        <CurrencyInput
          value={faturamentoAnual}
          onValueChange={setFaturamentoAnual}
          placeholder="R$ 1.200.000,00"
        />
      </div>

      <div className="calc-field">
        <label>Compras de Insumos / Custos Dedutíveis (R$)</label>
        <CurrencyInput
          value={comprasInsumosAnual}
          onValueChange={setComprasInsumosAnual}
          placeholder="R$ 300.000,00"
        />
      </div>

      <div className="calc-field">
        <label>Folha de Pagamento Anual (Salário + Provisões) (R$)</label>
        <CurrencyInput
          value={folhaAnual}
          onValueChange={setFolhaAnual}
          placeholder="R$ 250.000,00"
        />
      </div>

      <div className="calc-field">
        <label>Margem de Lucro Esperada (%)</label>
        <input
          type="number"
          min="1"
          max="100"
          value={margemLucro}
          onChange={(e) => setMargemLucro(e.target.value)}
        />
      </div>

      <div className="calc-field">
        <label>Tipo de Empresa (Enquadramento de Porte)</label>
        <select
          value={tipoEmpresa}
          onChange={(e) => setTipoEmpresa(e.target.value)}
          style={{
            backgroundColor: '#ffffff',
            color: '#111827',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '8px 12px',
            width: '100%',
            fontSize: '0.875rem'
          }}
        >
          {tiposEmpresaOptions.map((opt) => (
            <option key={opt.id} value={opt.nome}>{opt.nome}</option>
          ))}
        </select>
      </div>

      <div className="calc-field">
        <label>Natureza Jurídica</label>
        <select
          value={naturezaJuridica}
          onChange={(e) => setNaturezaJuridica(e.target.value)}
          style={{
            backgroundColor: '#ffffff',
            color: '#111827',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '8px 12px',
            width: '100%',
            fontSize: '0.875rem'
          }}
        >
          {naturezasJuridicasOptions.map((opt) => (
            <option key={opt.id} value={opt.nome}>{opt.nome}</option>
          ))}
        </select>
      </div>
    </div>

    <div className="resultado-card">
      <h3><Calculator size={18} color="#c59235" /> Triagem de Cenários Tributários</h3>

      <div className="resultado-row">
        <span className="r-label">Simples Nacional (cenário genérico)</span>
        <span className="r-valor" style={{ color: resultado.melhorOpcao === 'Simples Nacional' ? '#10b981' : '#0f172a' }}>
          {formatCurrency(resultado.simplesNacional)}
        </span>
      </div>

      <div className="resultado-row">
        <span className="r-label">Lucro Presumido (cenário genérico)</span>
        <span className="r-valor" style={{ color: resultado.melhorOpcao === 'Lucro Presumido' ? '#10b981' : '#0f172a' }}>
          {formatCurrency(resultado.lucroPresumido)}
        </span>
      </div>

      <div className="resultado-row">
        <span className="r-label">Lucro Real (cenário genérico)</span>
        <span className="r-valor" style={{ color: resultado.melhorOpcao === 'Lucro Real' ? '#10b981' : '#0f172a' }}>
          {formatCurrency(resultado.lucroReal)}
        </span>
      </div>

      <div className="resultado-row destaque verde" style={{ marginTop: '16px', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#10b981', fontSize: '0.85rem' }}>
          <AlertCircle size={15} /> Limite desta triagem
        </div>
        <div style={{ fontSize: '0.8rem', color: '#334155', fontWeight: 500, lineHeight: '1.4' }}>
          {resultado.melhorOpcaoDesc}
        </div>
      </div>

      {resultado.alertas && resultado.alertas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
          {resultado.alertas.map((alerta, i) => (
            <div
              key={i}
              style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fef3c7',
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#b45309', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase' }}>
                <AlertCircle size={14} /> Regra Parametrizada ({tipoEmpresa} / {naturezaJuridica})
              </span>
              <span style={{ fontSize: '0.78rem', color: '#78350f', lineHeight: '1.4', fontWeight: 500 }}>
                {alerta}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);
