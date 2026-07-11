import React from 'react';
import { useFloatingCalculator } from '../../hooks/useFloatingCalculator';
import type { CalculatorModel } from '../../stores/floatingCalculatorStore';
import './Calculator.css';

export const CalculatorSelector: React.FC = () => {
  const { activeModel, setModel } = useFloatingCalculator();

  const options: { id: CalculatorModel; label: string }[] = [
    { id: 'normal', label: 'Normal' },
    { id: 'accounting', label: 'Contábil' },
    { id: 'tax', label: 'Tributária' },
  ];

  return (
    <div className="calculator-selector">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`selector-btn ${activeModel === opt.id ? 'active' : ''}`}
          onClick={() => setModel(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};
