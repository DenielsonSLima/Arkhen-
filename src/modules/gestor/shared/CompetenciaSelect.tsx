import React, { useMemo } from 'react';
import './CompetenciaSelect.css';

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

interface CompetenciaSelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

const parseCompetencia = (value: string) => {
  const match = /^(\d{4})-(0[1-9]|1[0-2])/.exec(value);
  const now = new Date();
  return match
    ? { ano: match[1], mes: match[2] }
    : { ano: String(now.getFullYear()), mes: String(now.getMonth() + 1).padStart(2, '0') };
};

export const CompetenciaSelect: React.FC<CompetenciaSelectProps> = ({
  id,
  value,
  onChange,
  label = 'Competência',
  className = '',
}) => {
  const { ano, mes } = parseCompetencia(value);
  const anos = useMemo(() => {
    const atual = new Date().getFullYear();
    return Array.from(new Set([
      ...Array.from({ length: 9 }, (_, index) => String(atual - 5 + index)),
      ano,
    ])).sort((a, b) => Number(b) - Number(a));
  }, [ano]);

  return (
    <div className={`calc-field competencia-field ${className}`.trim()}>
      <span className="competencia-label">{label}</span>
      <div className="competencia-selects">
        <label className="sr-only" htmlFor={`${id}-mes`}>Mês da {label.toLowerCase()}</label>
        <select
          id={`${id}-mes`}
          aria-label={`Mês da ${label.toLowerCase()}`}
          value={mes}
          onChange={(event) => onChange(`${ano}-${event.target.value}`)}
        >
          {MESES.map((nome, index) => (
            <option key={nome} value={String(index + 1).padStart(2, '0')}>{nome}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor={`${id}-ano`}>Ano da {label.toLowerCase()}</label>
        <select
          id={`${id}-ano`}
          aria-label={`Ano da ${label.toLowerCase()}`}
          value={ano}
          onChange={(event) => onChange(`${event.target.value}-${mes}`)}
        >
          {anos.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
    </div>
  );
};

