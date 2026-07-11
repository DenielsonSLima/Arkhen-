import React, { useState, useEffect } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { useFloatingCalculator } from '../../../hooks/useFloatingCalculator';
import { calculatorService } from '../services/calculatorService';
import './ModelStyles.css';

export const TaxCalculator: React.FC = () => {
  const {
    taxMemory,
    updateTaxMemory,
    addHistory
  } = useFloatingCalculator();

  const [subTab, setSubTab] = useState<'imposto_base' | 'retencoes' | 'atraso'>('imposto_base');
  const [result, setResult] = useState<string>('0,00');

  const {
    caBaseCalculo, caAliquota,
    bcValorComImposto, bcAliquota,
    retValorBruto, retTipo, retAliquotaCustom,
    vaValorOriginal, vaDiasAtraso
  } = taxMemory;

  useEffect(() => {
    if (subTab === 'imposto_base') {
      const base = parseFloat(caBaseCalculo) || 0;
      const aliq = parseFloat(caAliquota) || 0;
      const resVal = calculatorService.calcularImpostoPorAliquota({ baseCalculo: base, aliquota: aliq });

      const valC = parseFloat(bcValorComImposto) || 0;
      const aliqC = parseFloat(bcAliquota) || 0;
      const baseCalculada = calculatorService.calcularBaseDeCalculo(valC, aliqC);
      const impostoCalculado = valC - baseCalculada;

      setResult(
        `Por Alíquota:\n  Imposto: R$ ${resVal.imposto.toFixed(2)}\n  Total: R$ ${resVal.total.toFixed(2)}\n\n` +
        `Base de Cálculo Reversa:\n  Base: R$ ${baseCalculada.toFixed(2)}\n  Imposto embutido: R$ ${impostoCalculado.toFixed(2)}`
      );
      return;
    }

    if (subTab === 'retencoes') {
      const bruto = parseFloat(retValorBruto) || 0;
      const aliqCustom = parseFloat(retAliquotaCustom) || 0;
      const ret = calculatorService.calcularRetencao(bruto, retTipo, aliqCustom);

      setResult(
        `Alíquota Aplicada: ${ret.aliquota.toFixed(2)}%\n` +
        `Valor Retido: R$ ${ret.valorRetido.toFixed(2)}\n` +
        `Valor Líquido: R$ ${ret.valorLiquido.toFixed(2)}`
      );
      return;
    }

    if (subTab === 'atraso') {
      const orig = parseFloat(vaValorOriginal) || 0;
      const dias = parseInt(vaDiasAtraso) || 0;
      const atraso = calculatorService.calcularAtraso({ valorOriginal: orig, diasAtraso: dias });

      setResult(
        `Dias de Atraso: ${dias} dias\n` +
        `Multa (0.33%/dia, lim. 20%): R$ ${atraso.multa.toFixed(2)}\n` +
        `Juros (1%/mês proporc.): R$ ${atraso.juros.toFixed(2)}\n` +
        `Total a Recolher: R$ ${atraso.total.toFixed(2)}`
      );
      return;
    }
  }, [subTab, caBaseCalculo, caAliquota, bcValorComImposto, bcAliquota, retValorBruto, retTipo, retAliquotaCustom, vaValorOriginal, vaDiasAtraso]);

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    const btn = document.getElementById('tax-copy-btn');
    if (btn) {
      btn.style.color = '#4caf50';
      setTimeout(() => {
        btn.style.color = '';
      }, 1000);
    }
  };

  const handleSaveToHistory = () => {
    let logStr = '';
    if (subTab === 'imposto_base') {
      logStr = `Tributário Base R$ ${caBaseCalculo} | Alíq ${caAliquota}% => Imposto R$ ${(parseFloat(caBaseCalculo)*parseFloat(caAliquota)/100 || 0).toFixed(2)}`;
    } else if (subTab === 'retencoes') {
      logStr = `Retenção ${retTipo.toUpperCase()} | Bruto R$ ${retValorBruto} => Retido R$ ${(parseFloat(result.match(/Valor Retido: R\$ ([\d,.]+)/)?.[1] || '0') || 0)}`;
    } else if (subTab === 'atraso') {
      logStr = `Atraso R$ ${vaValorOriginal} | Dias: ${vaDiasAtraso} => Final R$ ${(parseFloat(result.match(/Total a Recolher: R\$ ([\d,.]+)/)?.[1] || '0') || 0)}`;
    }

    if (logStr) {
      addHistory(logStr);
    }
  };

  return (
    <div className="tax-calculator-wrapper">
      {/* Sub menu de ferramentas */}
      <div className="acc-submenu">
        <button type="button" className={`acc-sub-btn ${subTab === 'imposto_base' ? 'active' : ''}`} onClick={() => setSubTab('imposto_base')}>Imposto/Base</button>
        <button type="button" className={`acc-sub-btn ${subTab === 'retencoes' ? 'active' : ''}`} onClick={() => setSubTab('retencoes')}>Retenções</button>
        <button type="button" className={`acc-sub-btn ${subTab === 'atraso' ? 'active' : ''}`} onClick={() => setSubTab('atraso')}>Guia em Atraso</button>
      </div>

      {/* Formulários por Sub-Aba */}
      <div className="acc-form-viewport">
        {subTab === 'imposto_base' && (
          <div className="acc-form-double">
            <div className="acc-column">
              <div className="section-title">Cálculo de Imposto</div>
              <div className="input-group">
                <label>Base de Cálculo (R$)</label>
                <input type="number" placeholder="0.00" value={caBaseCalculo} onChange={(e) => updateTaxMemory({ caBaseCalculo: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Alíquota (%)</label>
                <input type="number" placeholder="0" value={caAliquota} onChange={(e) => updateTaxMemory({ caAliquota: e.target.value })} />
              </div>
            </div>
            <div className="acc-column divider-left">
              <div className="section-title">Base Reversa (Por Fora)</div>
              <div className="input-group">
                <label>Valor Total com Imposto (R$)</label>
                <input type="number" placeholder="0.00" value={bcValorComImposto} onChange={(e) => updateTaxMemory({ bcValorComImposto: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Alíquota (%)</label>
                <input type="number" placeholder="0" value={bcAliquota} onChange={(e) => updateTaxMemory({ bcAliquota: e.target.value })} />
              </div>
            </div>
          </div>
        )}

        {subTab === 'retencoes' && (
          <div className="acc-form-grid">
            <div className="input-group">
              <label>Valor Bruto da NF (R$)</label>
              <input type="number" placeholder="0.00" value={retValorBruto} onChange={(e) => updateTaxMemory({ retValorBruto: e.target.value })} />
            </div>
            <div className="input-group">
              <label>Tipo de Retenção</label>
              <select value={retTipo} onChange={(e: any) => updateTaxMemory({ retTipo: e.target.value })}>
                <option value="csrf">CSRF (4.65% - PIS/COFINS/CSLL)</option>
                <option value="irrf">IRRF (1.5% - Serviços Profes.)</option>
                <option value="iss">ISS (5.0% - Municipal)</option>
                <option value="inss">INSS (11.0% - Contribuinte)</option>
                <option value="custom">Alíquota Customizada...</option>
              </select>
            </div>
            {retTipo === 'custom' && (
              <div className="input-group" style={{ gridColumn: 'span 2' }}>
                <label>Alíquota Customizada (%)</label>
                <input type="number" placeholder="0.00" value={retAliquotaCustom} onChange={(e) => updateTaxMemory({ retAliquotaCustom: e.target.value })} />
              </div>
            )}
          </div>
        )}

        {subTab === 'atraso' && (
          <div className="acc-form-grid">
            <div className="input-group">
              <label>Valor Original da Guia (R$)</label>
              <input type="number" placeholder="0.00" value={vaValorOriginal} onChange={(e) => updateTaxMemory({ vaValorOriginal: e.target.value })} />
            </div>
            <div className="input-group">
              <label>Dias de Atraso</label>
              <input type="number" placeholder="0" value={vaDiasAtraso} onChange={(e) => updateTaxMemory({ vaDiasAtraso: e.target.value })} />
            </div>
          </div>
        )}
      </div>

      {/* Resultados e Ações */}
      <div className="acc-result-section">
        <div className="acc-result-box">
          <pre>{result}</pre>
        </div>
        <div className="acc-result-actions">
          <button type="button" id="tax-copy-btn" className="result-action-btn" onClick={handleCopy} title="Copiar resultado">
            <Copy size={16} /> Copiar
          </button>
          <button type="button" className="result-action-btn primary-btn" onClick={handleSaveToHistory} title="Salvar no histórico global">
            <RefreshCw size={14} /> Registrar
          </button>
        </div>
      </div>
    </div>
  );
};
