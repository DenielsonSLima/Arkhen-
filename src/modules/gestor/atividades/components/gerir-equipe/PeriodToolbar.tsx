import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateBR } from '../../services/rotinasAtividadesService';
import type { PeriodoFiltro } from './types';
import { getMonday } from './utils';
import { styles } from './styles';

interface PeriodToolbarProps {
  dataBase: string;
  onChangePeriodo: (periodo: PeriodoFiltro) => void;
  onShiftDate: (amount: number) => void;
  periodo: PeriodoFiltro;
}

const periodos: PeriodoFiltro[] = ['dia', 'semana', 'mes', 'empresas'];

export const PeriodToolbar: React.FC<PeriodToolbarProps> = ({
  dataBase,
  onChangePeriodo,
  onShiftDate,
  periodo,
}) => (
  <div style={styles.toolbar}>
    <div style={styles.segmented}>
      {periodos.map((item) => (
        <button
          key={item}
          className={periodo === item ? 'active' : ''}
          style={{
            ...styles.segmentedItem,
            backgroundColor: periodo === item ? 'var(--color-gold-primary)' : 'transparent',
            color: periodo === item ? '#ffffff' : '#64748b',
          }}
          onClick={() => onChangePeriodo(item)}
          type="button"
        >
          {item === 'dia' ? 'Dia' : item === 'semana' ? 'Semana' : item === 'mes' ? 'Mês' : 'Empresas'}
        </button>
      ))}
    </div>

    {periodo !== 'empresas' && (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button onClick={() => onShiftDate(-1)} style={navBtnStyle} type="button">
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>
          {periodo === 'dia' && formatDateBR(dataBase)}
          {periodo === 'semana' && `Semana de ${formatDateBR(getMonday(dataBase))}`}
          {periodo === 'mes' && new Date(`${dataBase}T00:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}
        </span>
        <button onClick={() => onShiftDate(1)} style={navBtnStyle} type="button">
          <ChevronRight size={16} />
        </button>
      </div>
    )}
  </div>
);

const navBtnStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: '#f1f5f9',
  border: 'none',
  borderRadius: '4px',
  color: '#0f172a',
  cursor: 'pointer',
  display: 'flex',
  height: '28px',
  justifyContent: 'center',
  width: '28px',
};
