import React from 'react';
import { formatCurrencyInputValue } from './currencyInputUtils';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'inputMode'> {
  value: string;
  onValueChange: (value: string) => void;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onValueChange,
  onBlur,
  placeholder = 'R$ 0,00',
  ...props
}) => (
  <input
    {...props}
    type="text"
    inputMode="decimal"
    value={value}
    placeholder={placeholder}
    onChange={(event) => onValueChange(event.target.value)}
    onBlur={(event) => {
      onValueChange(formatCurrencyInputValue(event.currentTarget.value));
      onBlur?.(event);
    }}
  />
);
