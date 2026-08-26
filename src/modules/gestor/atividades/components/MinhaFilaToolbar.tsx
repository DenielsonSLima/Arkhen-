import React from 'react';
import { Plus } from 'lucide-react';
import { MINHA_FILA_FILTROS, type MinhaFilaFiltro } from './minhaFilaFilters';

interface MinhaFilaToolbarProps {
  activeFilter: MinhaFilaFiltro;
  counts: Record<MinhaFilaFiltro, number>;
  onFilterChange: (filter: MinhaFilaFiltro) => void;
  onCreateTask: () => void;
}

export const MinhaFilaToolbar: React.FC<MinhaFilaToolbarProps> = ({
  activeFilter,
  counts,
  onFilterChange,
  onCreateTask,
}) => (
  <section style={toolbarStyle}>
    <div style={filterGroupStyle}>
      {MINHA_FILA_FILTROS.map((filter) => (
        <button
          key={filter.id}
          type="button"
          onClick={() => onFilterChange(filter.id)}
          style={activeFilter === filter.id ? activeFilterBtnStyle : filterBtnStyle}
        >
          {filter.label}
          <strong>{counts[filter.id]}</strong>
        </button>
      ))}
    </div>
    <button type="button" onClick={onCreateTask} style={primaryBtnStyle}>
      <Plus size={15} /> Nova tarefa
    </button>
  </section>
);

const toolbarStyle = { display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' as const };
const filterGroupStyle = { display: 'flex', gap: '8px', flexWrap: 'wrap' as const };
const filterBtnBaseStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '9px 12px',
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
  fontWeight: 700,
  cursor: 'pointer',
};
const filterBtnStyle = { ...filterBtnBaseStyle, background: '#ffffff', color: '#64748b' };
const activeFilterBtnStyle = { ...filterBtnBaseStyle, background: '#1f2937', color: '#ffffff', borderColor: '#c59235' };
const primaryBtnStyle = {
  background: 'linear-gradient(135deg, #c59235 0%, #aa7c28 100%)',
  border: 'none',
  borderRadius: '8px',
  padding: '9px 14px',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};
