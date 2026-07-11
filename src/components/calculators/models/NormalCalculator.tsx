import React, { useEffect } from 'react';
import { Copy, Delete, RotateCcw } from 'lucide-react';
import { useFloatingCalculator } from '../../../hooks/useFloatingCalculator';
import { calculatorService } from '../services/calculatorService';
import './ModelStyles.css';

export const NormalCalculator: React.FC = () => {
  const {
    normalMemory,
    updateNormalMemory,
    history,
    addHistory,
    clearHistory
  } = useFloatingCalculator();

  const { display, equation, prevVal, operation, resetOnNextInput } = normalMemory;

  const formatResult = (result: number) => Number.isFinite(result)
    ? Number(result.toFixed(8)).toString()
    : 'Erro';

  const shouldIgnoreKeyboard = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    const element = target;

    return Boolean(
      element.closest('input, textarea, select')
      || element.isContentEditable
    );
  };

  const handleNumber = (num: string) => {
    let nextDisplay = display;
    if (display === '0' || display === 'Erro' || resetOnNextInput) {
      nextDisplay = num === '.' ? '0.' : num;
    } else {
      if (num === '.' && display.includes('.')) return;
      nextDisplay = display + num;
    }

    updateNormalMemory({
      display: nextDisplay,
      resetOnNextInput: false
    });
  };

  const handleOperation = (op: string) => {
    const currentVal = parseFloat(display);
    if (isNaN(currentVal)) return;

    if (prevVal !== null && operation) {
      // Calcular intermediário
      const prev = parseFloat(prevVal);
      const result = calculatorService.calcularNormal(operation, prev, currentVal);
      const formattedResult = formatResult(result);
      if (formattedResult === 'Erro') {
        updateNormalMemory({
          prevVal: null,
          display: 'Erro',
          operation: null,
          equation: '',
          resetOnNextInput: true
        });
        return;
      }

      updateNormalMemory({
        prevVal: formattedResult,
        display: formattedResult,
        operation: op,
        equation: `${formattedResult} ${op} `,
        resetOnNextInput: true
      });
    } else {
      updateNormalMemory({
        prevVal: display,
        operation: op,
        equation: `${display} ${op} `,
        resetOnNextInput: true
      });
    }
  };

  const handleEquals = () => {
    if (prevVal === null || !operation) return;

    const currentVal = parseFloat(display);
    const prev = parseFloat(prevVal);
    if (isNaN(currentVal) || isNaN(prev)) return;

    const result = calculatorService.calcularNormal(operation, prev, currentVal);
    const formattedResult = formatResult(result);
    if (formattedResult === 'Erro') {
      updateNormalMemory({
        display: 'Erro',
        equation: '',
        prevVal: null,
        operation: null,
        resetOnNextInput: true
      });
      return;
    }

    const calcString = `${prevVal} ${operation} ${display} = ${formattedResult}`;

    addHistory(calcString);

    updateNormalMemory({
      display: formattedResult,
      equation: '',
      prevVal: null,
      operation: null,
      resetOnNextInput: true
    });
  };

  const handleClear = () => {
    updateNormalMemory({
      display: '0',
      equation: '',
      prevVal: null,
      operation: null,
      resetOnNextInput: false
    });
  };

  const handleBackspace = () => {
    if (resetOnNextInput) return;
    let nextDisplay = display.slice(0, -1);
    if (nextDisplay === '' || nextDisplay === '-') {
      nextDisplay = '0';
    }
    updateNormalMemory({ display: nextDisplay });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(display);
    // Visual feedback temporário
    const btn = document.getElementById('calc-copy-btn');
    if (btn) {
      btn.style.color = '#4caf50';
      setTimeout(() => {
        btn.style.color = '';
      }, 1000);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const calculatorWindow = document.querySelector('[aria-label="Calculadora contábil"]');
      if (
        calculatorWindow
        && document.activeElement
        && !calculatorWindow.contains(document.activeElement)
      ) {
        return;
      }

      if (shouldIgnoreKeyboard(event.target)) return;

      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        handleNumber(event.key);
        return;
      }

      if (event.key === '.' || event.key === ',') {
        event.preventDefault();
        handleNumber('.');
        return;
      }

      if (['+', '-', '*', '/', '%'].includes(event.key)) {
        event.preventDefault();
        handleOperation(event.key);
        return;
      }

      if (event.key === 'Enter' || event.key === '=') {
        event.preventDefault();
        handleEquals();
        return;
      }

      if (event.key === 'Backspace') {
        event.preventDefault();
        handleBackspace();
        return;
      }

      if (event.key === 'Escape' || event.key === 'Delete') {
        event.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <div className="normal-calculator-wrapper" tabIndex={0} aria-label="Calculadora normal">
      <div className="calc-display-section">
        <div className="calc-equation">{equation || '\u00A0'}</div>
        <div className="calc-display-row">
          <button
            type="button"
            id="calc-copy-btn"
            className="calc-icon-btn"
            title="Copiar resultado"
            onClick={handleCopy}
          >
            <Copy size={14} />
          </button>
          <span className="calc-main-display">{display}</span>
        </div>
      </div>

      <div className="calc-keyboard-and-history">
        {/* Teclado */}
        <div className="calc-grid">
          <button type="button" className="calc-btn btn-special" onClick={handleClear}>C</button>
          <button type="button" className="calc-btn btn-special" onClick={handleBackspace} title="Apagar último"><Delete size={14} /></button>
          <button type="button" className="calc-btn btn-op" onClick={() => handleOperation('%')}>%</button>
          <button type="button" className="calc-btn btn-op" onClick={() => handleOperation('/')}>/</button>

          <button type="button" className="calc-btn" onClick={() => handleNumber('7')}>7</button>
          <button type="button" className="calc-btn" onClick={() => handleNumber('8')}>8</button>
          <button type="button" className="calc-btn" onClick={() => handleNumber('9')}>9</button>
          <button type="button" className="calc-btn btn-op" onClick={() => handleOperation('*')}>*</button>

          <button type="button" className="calc-btn" onClick={() => handleNumber('4')}>4</button>
          <button type="button" className="calc-btn" onClick={() => handleNumber('5')}>5</button>
          <button type="button" className="calc-btn" onClick={() => handleNumber('6')}>6</button>
          <button type="button" className="calc-btn btn-op" onClick={() => handleOperation('-')}>-</button>

          <button type="button" className="calc-btn" onClick={() => handleNumber('1')}>1</button>
          <button type="button" className="calc-btn" onClick={() => handleNumber('2')}>2</button>
          <button type="button" className="calc-btn" onClick={() => handleNumber('3')}>3</button>
          <button type="button" className="calc-btn btn-op" onClick={() => handleOperation('+')}>+</button>

          <button type="button" className="calc-btn btn-double" onClick={() => handleNumber('0')}>0</button>
          <button type="button" className="calc-btn" onClick={() => handleNumber('.')}>.</button>
          <button type="button" className="calc-btn btn-equals" onClick={handleEquals}>=</button>
        </div>

        {/* Histórico */}
        <div className="calc-history-section">
          <div className="history-header">
            <span>Histórico</span>
            {history.length > 0 && (
              <button type="button" className="history-clear-btn" onClick={clearHistory} title="Limpar histórico">
                <RotateCcw size={12} />
              </button>
            )}
          </div>
          <div className="history-list">
            {history.length === 0 ? (
              <div className="history-empty">Nenhum cálculo recente</div>
            ) : (
              history.map((item, idx) => (
                <div
                  key={idx}
                  className="history-item"
                  onClick={() => {
                    const parts = item.split(' = ');
                    if (parts.length === 2) {
                      updateNormalMemory({ display: parts[1], resetOnNextInput: true });
                    }
                  }}
                  title="Clique para usar o resultado"
                >
                  {item}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
