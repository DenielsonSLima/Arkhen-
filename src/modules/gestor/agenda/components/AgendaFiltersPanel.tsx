import React from 'react';
import { Building2, CalendarRange, ChevronDown, Palette, Settings2, Tags, UserRound, X } from 'lucide-react';
import type { CategoriaEventoConfig, TipoEventoConfig } from '../services/agenda.service';

interface FilterOption {
  id: string;
  nome: string;
}

interface AgendaFiltersPanelProps {
  filtro: string[];
  categoriaFiltro: string[];
  funcionarioFiltro: string;
  empresaFiltro: string;
  tiposDisponiveis: TipoEventoConfig[];
  categoriasDisponiveis: CategoriaEventoConfig[];
  funcionariosFiltro: FilterOption[];
  empresasFiltro: FilterOption[];
  nomeTiposSelecionados: string;
  nomeCategoriasSelecionadas: string;
  filtroTipoAberto: boolean;
  filtroCategoriaAberto: boolean;
  onSetFiltro: React.Dispatch<React.SetStateAction<string[]>>;
  onSetCategoriaFiltro: React.Dispatch<React.SetStateAction<string[]>>;
  onSetFuncionarioFiltro: (value: string) => void;
  onSetEmpresaFiltro: (value: string) => void;
  onSetFiltroTipoAberto: React.Dispatch<React.SetStateAction<boolean>>;
  onSetFiltroCategoriaAberto: React.Dispatch<React.SetStateAction<boolean>>;
  onLimparTodosFiltros: () => void;
  onLimparFiltroTipo: () => void;
  onLimparFiltroCategoria: () => void;
  onAlternarTipoFiltro: (tipoId: string) => void;
  onAlternarCategoriaFiltro: (categoriaId: string) => void;
  onGerenciarTipos: () => void;
  onGerenciarCategorias: () => void;
  onGerenciarCores: () => void;
  podeGerenciar: boolean;
}

export const AgendaFiltersPanel: React.FC<AgendaFiltersPanelProps> = ({
  filtro,
  categoriaFiltro,
  funcionarioFiltro,
  empresaFiltro,
  tiposDisponiveis,
  categoriasDisponiveis,
  funcionariosFiltro,
  empresasFiltro,
  nomeTiposSelecionados,
  nomeCategoriasSelecionadas,
  filtroTipoAberto,
  filtroCategoriaAberto,
  onSetFiltro,
  onSetCategoriaFiltro,
  onSetFuncionarioFiltro,
  onSetEmpresaFiltro,
  onSetFiltroTipoAberto,
  onSetFiltroCategoriaAberto,
  onLimparTodosFiltros,
  onLimparFiltroTipo,
  onLimparFiltroCategoria,
  onAlternarTipoFiltro,
  onAlternarCategoriaFiltro,
  onGerenciarTipos,
  onGerenciarCategorias,
  onGerenciarCores,
  podeGerenciar,
}) => {
  const hasFiltrosAtivos = filtro.length > 0
    || categoriaFiltro.length > 0
    || funcionarioFiltro !== 'todos'
    || empresaFiltro !== 'todas';

  return (
    <>
      <div className="agenda-filter-active-row">
        {hasFiltrosAtivos ? (
          <>
            <div className="agenda-filter-chips">
              {filtro.map((tipoId) => {
                const item = tiposDisponiveis.find((tipo) => tipo.id === tipoId);
                return (
                  <button type="button" key={tipoId} className="agenda-filter-chip" onClick={() => onSetFiltro((atual) => atual.filter((id) => id !== tipoId))}>
                    Tipo: {item?.label || tipoId}
                    <X size={12} />
                  </button>
                );
              })}
              {categoriaFiltro.map((categoriaId) => {
                const item = categoriasDisponiveis.find((categoria) => categoria.id === categoriaId);
                return (
                  <button type="button" key={categoriaId} className="agenda-filter-chip" onClick={() => onSetCategoriaFiltro((atual) => atual.filter((id) => id !== categoriaId))}>
                    Categoria: {item?.label || categoriaId}
                    <X size={12} />
                  </button>
                );
              })}
              {funcionarioFiltro !== 'todos' && (
                <button type="button" className="agenda-filter-chip" onClick={() => onSetFuncionarioFiltro('todos')}>
                  Funcionário: {funcionariosFiltro.find((item) => item.id === funcionarioFiltro)?.nome || 'Selecionado'}
                  <X size={12} />
                </button>
              )}
              {empresaFiltro !== 'todas' && (
                <button type="button" className="agenda-filter-chip" onClick={() => onSetEmpresaFiltro('todas')}>
                  Empresa: {empresasFiltro.find((item) => item.id === empresaFiltro)?.nome || 'Sem empresa'}
                  <X size={12} />
                </button>
              )}
            </div>
            <button type="button" className="agenda-filter-clear-btn" onClick={onLimparTodosFiltros}>
              <X size={14} />
              Limpar filtros
            </button>
          </>
        ) : null}
      </div>

      <div className="agenda-filter-panel">
        <FilterSelect label="Empresa" icon={<Building2 size={14} />} value={empresaFiltro} onChange={onSetEmpresaFiltro}>
          <option value="todas">Todas</option>
          <option value="sem-empresa">Sem empresa</option>
          {empresasFiltro.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nome}</option>)}
        </FilterSelect>

        <FilterSelect
          label="Funcionário"
          icon={<UserRound size={14} />}
          value={funcionarioFiltro}
          onChange={onSetFuncionarioFiltro}
          action={podeGerenciar ? <button type="button" className="agenda-filter-inline-btn" onClick={onGerenciarCores}><Palette size={12} /> Cores</button> : undefined}
        >
          <option value="todos">Todos</option>
          {funcionariosFiltro.map((funcionario) => <option key={funcionario.id} value={funcionario.id}>{funcionario.nome}</option>)}
        </FilterSelect>

        <FilterDropdown
          label="Tipo"
          icon={<CalendarRange size={14} />}
          actionLabel={podeGerenciar ? 'Gerenciar' : undefined}
          open={filtroTipoAberto}
          selectedLabel={nomeTiposSelecionados}
          onAction={podeGerenciar ? onGerenciarTipos : undefined}
          onToggle={() => onSetFiltroTipoAberto((aberto) => !aberto)}
        >
          <DropdownItem checked={filtro.length === 0} label="Todos" color="#64748b" onChange={onLimparFiltroTipo} />
          {tiposDisponiveis.map((item) => (
            <DropdownItem
              key={item.id}
              checked={filtro.includes(item.id)}
              label={item.label}
              color={item.cor}
              onChange={() => onAlternarTipoFiltro(item.id)}
            />
          ))}
        </FilterDropdown>

        <FilterDropdown
          label="Categorias"
          icon={<Tags size={14} />}
          actionLabel={podeGerenciar ? 'Gerenciar' : undefined}
          open={filtroCategoriaAberto}
          selectedLabel={nomeCategoriasSelecionadas}
          onAction={podeGerenciar ? onGerenciarCategorias : undefined}
          onToggle={() => onSetFiltroCategoriaAberto((aberto) => !aberto)}
          className="agenda-filter-group-categorias"
        >
          <DropdownItem checked={categoriaFiltro.length === 0} label="Todas" color="#64748b" onChange={onLimparFiltroCategoria} />
          {categoriasDisponiveis.map((item) => (
            <DropdownItem
              key={item.id}
              checked={categoriaFiltro.includes(item.id)}
              label={item.label}
              color={item.cor}
              onChange={() => onAlternarCategoriaFiltro(item.id)}
            />
          ))}
        </FilterDropdown>
      </div>
    </>
  );
};

interface FilterSelectProps {
  label: string;
  icon: React.ReactNode;
  value: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  onChange: (value: string) => void;
}

const FilterSelect: React.FC<FilterSelectProps> = ({ label, icon, value, children, action, onChange }) => (
  <div className="agenda-filter-group">
    <div className="agenda-filter-header-row">
      <span className="agenda-filter-label">{icon}{label}</span>
      {action || <span className="agenda-filter-action-spacer" />}
    </div>
    <select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
  </div>
);

interface FilterDropdownProps {
  label: string;
  icon: React.ReactNode;
  actionLabel?: string;
  selectedLabel: string;
  open: boolean;
  children: React.ReactNode;
  className?: string;
  onAction?: () => void;
  onToggle: () => void;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({
  label,
  icon,
  actionLabel,
  selectedLabel,
  open,
  children,
  className = '',
  onAction,
  onToggle,
}) => (
  <div className={`agenda-filter-group ${className}`}>
    <div className="agenda-filter-header-row">
      <span className="agenda-filter-label">{icon}{label}</span>
      {onAction && actionLabel
        ? <button type="button" className="agenda-filter-inline-btn" onClick={onAction}><Settings2 size={12} /> {actionLabel}</button>
        : <span className="agenda-filter-action-spacer" />}
    </div>
    <div className="agenda-filter-list">
      <button type="button" className={`agenda-filter-list-toggle ${open ? 'open' : ''}`} onClick={onToggle}>
        <span>{selectedLabel}</span>
        <ChevronDown size={14} />
      </button>
      {open && <div className="agenda-filter-list-dropdown">{children}</div>}
    </div>
  </div>
);

interface DropdownItemProps {
  checked: boolean;
  label: string;
  color: string;
  onChange: () => void;
}

const DropdownItem: React.FC<DropdownItemProps> = ({ checked, label, color, onChange }) => (
  <label className={`agenda-filter-list-item ${checked ? 'selected' : ''}`}>
    <input type="checkbox" checked={checked} onChange={onChange} />
    <span className="filtro-dot" style={{ backgroundColor: color }} />
    <span>{label}</span>
  </label>
);
