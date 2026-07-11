import React, { useState, useEffect } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { useFloatingCalculator } from '../../../hooks/useFloatingCalculator';
import { calculatorService } from '../services/calculatorService';
import './ModelStyles.css';

export const AccountingCalculator: React.FC = () => {
  const {
    accountingMemory,
    updateAccountingMemory,
    addHistory
  } = useFloatingCalculator();

  const [subTab, setSubTab] = useState<'acrescimo_desconto' | 'regra_tres' | 'prorata' | 'juros_multa' | 'liquido_bruto'>('acrescimo_desconto');
  const [result, setResult] = useState<string>('0,00');

  const {
    adValor, adPercentual,
    rtA, rtB, rtC,
    prValorMensal, prDiasTotais, prDiasTrabalhados,
    jsCapital, jsTaxaMensal, jsTempoMeses,
    msValor, msTaxaMulta,
    lbValor, lbTaxaDesconto, lbIsBrutoParaLiquido
  } = accountingMemory;

  // Realizar cálculos em tempo real conforme os inputs mudam
  useEffect(() => {
    let calcResult = 0;

    if (subTab === 'acrescimo_desconto') {
      const v = parseFloat(adValor) || 0;
      const p = parseFloat(adPercentual) || 0;
      const acrescimo = calculatorService.calcularAcrescimoPercentual(v, p);
      const desconto = calculatorService.calcularDescontoPercentual(v, p);
      setResult(`Acréscimo: R$ ${acrescimo.toFixed(2)}\nDesconto: R$ ${desconto.toFixed(2)}`);
      return;
    }

    if (subTab === 'regra_tres') {
      const a = parseFloat(rtA) || 0;
      const b = parseFloat(rtB) || 0;
      const c = parseFloat(rtC) || 0;
      if (a !== 0) {
        calcResult = calculatorService.calcularRegraDeTres(a, b, c);
        setResult(`X = ${calcResult.toFixed(2)}`);
      } else {
        setResult('Digite A diferente de 0');
      }
      return;
    }

    if (subTab === 'prorata') {
      const valor = parseFloat(prValorMensal) || 0;
      const diasT = parseInt(prDiasTotais) || 30;
      const diasTr = parseInt(prDiasTrabalhados) || 0;
      if (diasT > 0) {
        calcResult = calculatorService.calcularProRata({ valorMensal: valor, diasTotais: diasT, diasTrabalhados: diasTr });
        setResult(`Pro-rata: R$ ${calcResult.toFixed(2)}`);
      } else {
        setResult('Dias Totais deve ser > 0');
      }
      return;
    }

    if (subTab === 'juros_multa') {
      const cap = parseFloat(jsCapital) || 0;
      const tx = parseFloat(jsTaxaMensal) || 0;
      const t = parseFloat(jsTempoMeses) || 0;
      const valM = parseFloat(msValor) || 0;
      const txM = parseFloat(msTaxaMulta) || 0;

      const js = calculatorService.calcularJurosSimples({ capital: cap, taxaMensal: tx, tempoMeses: t });
      const ms = calculatorService.calcularMultaSimples({ valor: valM, taxaMulta: txM });

      setResult(`Juros: R$ ${js.juros.toFixed(2)} (Total: R$ ${js.total.toFixed(2)})\nMulta: R$ ${ms.toFixed(2)}`);
      return;
    }

    if (subTab === 'liquido_bruto') {
      const val = parseFloat(lbValor) || 0;
      const tx = parseFloat(lbTaxaDesconto) || 0;
      calcResult = calculatorService.calcularLiquidoBruto({ valor: val, taxaDesconto: tx, isBrutoParaLiquido: lbIsBrutoParaLiquido });
      setResult(`${lbIsBrutoParaLiquido ? 'Líquido' : 'Bruto'}: R$ ${calcResult.toFixed(2)}`);
      return;
    }
  }, [subTab, adValor, adPercentual, rtA, rtB, rtC, prValorMensal, prDiasTotais, prDiasTrabalhados, jsCapital, jsTaxaMensal, jsTempoMeses, msValor, msTaxaMulta, lbValor, lbTaxaDesconto, lbIsBrutoParaLiquido]);

  const handleCopy = () => {
    // Copiar apenas o resultado numérico final ou texto formatado
    navigator.clipboard.writeText(result);
    const btn = document.getElementById('acc-copy-btn');
    if (btn) {
      btn.style.color = '#4caf50';
      setTimeout(() => {
        btn.style.color = '';
      }, 1000);
    }
  };

  const handleSaveToHistory = () => {
    let logStr = '';
    if (subTab === 'acrescimo_desconto') {
      logStr = `Val: R$ ${adValor} | %: ${adPercentual}% => ${result.replace('\n', ' / ')}`;
    } else if (subTab === 'regra_tres') {
      logStr = `Regra de 3: ${rtA} -> ${rtB} | ${rtC} -> ${result}`;
    } else if (subTab === 'prorata') {
      logStr = `Pro-rata: R$ ${prValorMensal} / ${prDiasTotais} dias * ${prDiasTrabalhados} d => ${result}`;
    } else if (subTab === 'juros_multa') {
      logStr = `Juros: Cap R$ ${jsCapital} | Taxa: ${jsTaxaMensal}% | Tempo: ${jsTempoMeses}m / Multa: Val R$ ${msValor} | Taxa: ${msTaxaMulta}%`;
    } else if (subTab === 'liquido_bruto') {
      logStr = `${lbIsBrutoParaLiquido ? 'Bruto' : 'Líquido'} R$ ${lbValor} | Desc ${lbTaxaDesconto}% => ${result}`;
    }

    if (logStr) {
      addHistory(logStr);
    }
  };

  return (
    <div className="accounting-calculator-wrapper">
      {/* Sub menu de ferramentas */}
      <div className="acc-submenu">
        <button type="button" className={`acc-sub-btn ${subTab === 'acrescimo_desconto' ? 'active' : ''}`} onClick={() => setSubTab('acrescimo_desconto')}>% Acr/Desc</button>
        <button type="button" className={`acc-sub-btn ${subTab === 'regra_tres' ? 'active' : ''}`} onClick={() => setSubTab('regra_tres')}>Regra de 3</button>
        <button type="button" className={`acc-sub-btn ${subTab === 'prorata' ? 'active' : ''}`} onClick={() => setSubTab('prorata')}>Pró-Rata</button>
        <button type="button" className={`acc-sub-btn ${subTab === 'juros_multa' ? 'active' : ''}`} onClick={() => setSubTab('juros_multa')}>Juros/Multa</button>
        <button type="button" className={`acc-sub-btn ${subTab === 'liquido_bruto' ? 'active' : ''}`} onClick={() => setSubTab('liquido_bruto')}>Líq/Bruto</button>
      </div>

      {/* Formulários por Sub-Aba */}
      <div className="acc-form-viewport">
        {subTab === 'acrescimo_desconto' && (
          <div className="acc-form-grid">
            <div className="input-group">
              <label>Valor Principal (R$)</label>
              <input
                type="number"
                placeholder="0.00"
                value={adValor}
                onChange={(e) => updateAccountingMemory({ adValor: e.target.value })}
              />
            </div>
            <div className="input-group">
              <label>Percentual (%)</label>
              <input
                type="number"
                placeholder="0"
                value={adPercentual}
                onChange={(e) => updateAccountingMemory({ adPercentual: e.target.value })}
              />
            </div>
          </div>
        )}

        {subTab === 'regra_tres' && (
          <div className="acc-form-grid">
            <div className="regra-tres-row">
              <div className="input-group">
                <label>A</label>
                <input type="number" placeholder="ex: 100" value={rtA} onChange={(e) => updateAccountingMemory({ rtA: e.target.value })} />
              </div>
              <span className="rt-arrow">➔</span>
              <div className="input-group">
                <label>B</label>
                <input type="number" placeholder="ex: 50" value={rtB} onChange={(e) => updateAccountingMemory({ rtB: e.target.value })} />
              </div>
            </div>
            <div className="regra-tres-row">
              <div className="input-group">
                <label>C</label>
                <input type="number" placeholder="ex: 200" value={rtC} onChange={(e) => updateAccountingMemory({ rtC: e.target.value })} />
              </div>
              <span className="rt-arrow">➔</span>
              <div className="input-group">
                <label>X (Resultado)</label>
                <input type="text" readOnly disabled placeholder="Automático" value={result.replace('X = ', '')} />
              </div>
            </div>
          </div>
        )}

        {subTab === 'prorata' && (
          <div className="acc-form-grid">
            <div className="input-group">
              <label>Valor Mensal Cheio (R$)</label>
              <input type="number" placeholder="0.00" value={prValorMensal} onChange={(e) => updateAccountingMemory({ prValorMensal: e.target.value })} />
            </div>
            <div className="input-group-row">
              <div className="input-group">
                <label>Dias no Mês</label>
                <input type="number" placeholder="30" value={prDiasTotais} onChange={(e) => updateAccountingMemory({ prDiasTotais: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Dias Trabalhados</label>
                <input type="number" placeholder="15" value={prDiasTrabalhados} onChange={(e) => updateAccountingMemory({ prDiasTrabalhados: e.target.value })} />
              </div>
            </div>
          </div>
        )}

        {subTab === 'juros_multa' && (
          <div className="acc-form-double">
            <div className="acc-column">
              <div className="section-title">Juros Simples</div>
              <div className="input-group">
                <label>Capital (R$)</label>
                <input type="number" placeholder="0.00" value={jsCapital} onChange={(e) => updateAccountingMemory({ jsCapital: e.target.value })} />
              </div>
              <div className="input-group-row">
                <div className="input-group">
                  <label>Taxa Mês (%)</label>
                  <input type="number" placeholder="0" value={jsTaxaMensal} onChange={(e) => updateAccountingMemory({ jsTaxaMensal: e.target.value })} />
                </div>
                <div className="input-group">
                  <label>Tempo (Meses)</label>
                  <input type="number" placeholder="0" value={jsTempoMeses} onChange={(e) => updateAccountingMemory({ jsTempoMeses: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="acc-column divider-left">
              <div className="section-title">Multa Simples</div>
              <div className="input-group">
                <label>Valor Base (R$)</label>
                <input type="number" placeholder="0.00" value={msValor} onChange={(e) => updateAccountingMemory({ msValor: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Taxa Multa (%)</label>
                <input type="number" placeholder="2" value={msTaxaMulta} onChange={(e) => updateAccountingMemory({ msTaxaMulta: e.target.value })} />
              </div>
            </div>
          </div>
        )}

        {subTab === 'liquido_bruto' && (
          <div className="acc-form-grid">
            <div className="input-group-row" style={{ gridColumn: 'span 2', display: 'flex', gap: '16px' }}>
              <label className="radio-label">
                <input
                  type="radio"
                  name="lb_type"
                  checked={lbIsBrutoParaLiquido}
                  onChange={() => updateAccountingMemory({ lbIsBrutoParaLiquido: true })}
                />
                Calcular Líquido (Bruto ➔ Líquido)
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="lb_type"
                  checked={!lbIsBrutoParaLiquido}
                  onChange={() => updateAccountingMemory({ lbIsBrutoParaLiquido: false })}
                />
                Calcular Bruto (Líquido ➔ Bruto)
              </label>
            </div>
            <div className="input-group">
              <label>Valor de Entrada (R$)</label>
              <input type="number" placeholder="0.00" value={lbValor} onChange={(e) => updateAccountingMemory({ lbValor: e.target.value })} />
            </div>
            <div className="input-group">
              <label>Taxa de Desconto / Retenção (%)</label>
              <input type="number" placeholder="0" value={lbTaxaDesconto} onChange={(e) => updateAccountingMemory({ lbTaxaDesconto: e.target.value })} />
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
          <button type="button" id="acc-copy-btn" className="result-action-btn" onClick={handleCopy} title="Copiar resultado">
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
