import React, { useMemo } from 'react';
import { CalendarClock, Search, SlidersHorizontal, UsersRound, X } from 'lucide-react';
import type { ClienteEmpresa } from '../../services/atividadesService';
import {
  ROTINAS_BATCH_LIMIT,
  type UsuarioAtividade,
} from '../../services/rotinasAtividadesService';
import {
  getRotinaFrequenciaLabel,
  type RotinasFilterState,
  type RotinaWorkspaceFrequency,
  type RotinaWorkspaceItem,
} from '../../utils/rotinasWorkspace';

interface RotinasConsultaProps {
  rotinas: RotinaWorkspaceItem[];
  allRotinas: RotinaWorkspaceItem[];
  clientes: ClienteEmpresa[];
  usuarios: UsuarioAtividade[];
  filters: RotinasFilterState;
  selectedIds: Set<string>;
  batchResponsibleId: string;
  isSaving: boolean;
  onFiltersChange: (filters: RotinasFilterState) => void;
  onToggleSelected: (id: string) => void;
  onSelectVisible: (ids: string[]) => void;
  onClearSelected: () => void;
  onBatchResponsibleChange: (responsibleId: string) => void;
  onApplyBatch: () => void;
}

const FREQUENCIES: RotinaWorkspaceFrequency[] = [
  'Diária',
  'Semanal',
  'Quinzenal',
  'Mensal',
  'Bimestral',
  'Trimestral',
  'Semestral',
  'Anual',
  'Personalizada',
];

const formatDate = (value?: string) => (
  value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : 'Não agendada'
);

export const RotinasConsulta: React.FC<RotinasConsultaProps> = ({
  rotinas,
  allRotinas,
  clientes,
  usuarios,
  filters,
  selectedIds,
  batchResponsibleId,
  isSaving,
  onFiltersChange,
  onToggleSelected,
  onSelectVisible,
  onClearSelected,
  onBatchResponsibleChange,
  onApplyBatch,
}) => {
  const clientesById = useMemo(() => new Map(clientes.map((cliente) => [cliente.id, cliente])), [clientes]);
  const responsibleFilterOptions = useMemo(() => {
    const options = new Map(usuarios.map((usuario) => [
      usuario.configUsuarioId,
      { id: usuario.configUsuarioId, label: usuario.nome },
    ]));
    allRotinas.forEach((rotina) => {
      const id = rotina.responsavelConfigUsuarioId;
      if (id && !options.has(id)) {
        options.set(id, { id, label: `${rotina.responsavel || 'Usuário inativo'} (inativo)` });
      }
    });
    return [...options.values()];
  }, [allRotinas, usuarios]);
  const visibleIds = rotinas.map((rotina) => rotina.id);
  const selectableVisibleIds = visibleIds.slice(0, ROTINAS_BATCH_LIMIT);
  const allVisibleSelected = selectableVisibleIds.length > 0
    && selectableVisibleIds.every((id) => selectedIds.has(id));

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      visibleIds.forEach((id) => {
        if (selectedIds.has(id)) onToggleSelected(id);
      });
      return;
    }
    onSelectVisible(selectableVisibleIds);
  };

  return (
    <section className="rotinas-workspace" aria-label="Consulta de rotinas">
      <div className="rotinas-consulta__filters">
        <div className="rotinas-search-wrap">
          <Search size={16} />
          <input
            className="rotinas-filter"
            value={filters.search || ''}
            onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            placeholder="Buscar empresa, CNPJ ou rotina"
            aria-label="Buscar rotinas"
          />
        </div>

        <select
          className="rotinas-filter"
          value={filters.companyId || ''}
          onChange={(event) => onFiltersChange({ ...filters, companyId: event.target.value })}
          aria-label="Filtrar por empresa"
        >
          <option value="">Todas as empresas</option>
          {clientes.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>
              {cliente.nome}{cliente.cnpj ? ` · ${cliente.cnpj}` : ''}
            </option>
          ))}
        </select>

        <select
          className="rotinas-filter"
          value={filters.frequency || ''}
          onChange={(event) => onFiltersChange({
            ...filters,
            frequency: event.target.value as RotinasFilterState['frequency'],
          })}
          aria-label="Filtrar por frequência"
        >
          <option value="">Todas as frequências</option>
          {FREQUENCIES.map((frequency) => <option key={frequency} value={frequency}>{frequency}</option>)}
        </select>

        <select
          className="rotinas-filter"
          value={filters.responsibleId || ''}
          onChange={(event) => onFiltersChange({ ...filters, responsibleId: event.target.value })}
          aria-label="Filtrar por responsável"
        >
          <option value="">Todos os responsáveis</option>
          <option value="sem-responsavel">Sem responsável</option>
          {responsibleFilterOptions.map((usuario) => (
            <option key={usuario.id} value={usuario.id}>{usuario.label}</option>
          ))}
        </select>
      </div>

      <div className="rotinas-workspace__toolbar">
        <span className="rotinas-eyebrow"><SlidersHorizontal size={14} /> {rotinas.length} rotinas encontradas</span>
        {rotinas.length > ROTINAS_BATCH_LIMIT ? (
          <span>Seleção em lote limitada a {ROTINAS_BATCH_LIMIT} rotinas por vez.</span>
        ) : null}
        {(filters.search || filters.companyId || filters.frequency || filters.responsibleId) ? (
          <button type="button" className="rotinas-button rotinas-button--secondary" onClick={() => onFiltersChange({})}>
            <X size={14} /> Limpar filtros
          </button>
        ) : null}
      </div>

      {rotinas.length === 0 ? (
        <div className="rotinas-empty">
          <Search size={34} />
          <h3>Nenhuma rotina encontrada</h3>
          <p>
            {(filters.search || filters.companyId || filters.frequency || filters.responsibleId)
              ? 'Ajuste os filtros para consultar outras empresas, frequências ou responsáveis.'
              : 'Cadastre ou configure uma rotina para começar o acompanhamento.'}
          </p>
        </div>
      ) : (
        <div className="rotinas-table-shell">
          <table className="rotinas-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    aria-label={`Selecionar até ${ROTINAS_BATCH_LIMIT} rotinas visíveis`}
                  />
                </th>
                <th>Empresa</th>
                <th>Rotina</th>
                <th>Frequência</th>
                <th>Responsável</th>
                <th>Próxima execução</th>
              </tr>
            </thead>
            <tbody>
              {rotinas.map((rotina) => {
                const cliente = rotina.clienteId ? clientesById.get(rotina.clienteId) : undefined;
                return (
                  <tr key={rotina.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(rotina.id)}
                        onChange={() => onToggleSelected(rotina.id)}
                        aria-label={`Selecionar ${rotina.nome} de ${cliente?.nome || rotina.cliente || 'empresa não vinculada'}`}
                      />
                    </td>
                    <td>
                      <div className="rotinas-table__company" title={cliente?.nome || rotina.cliente}>
                        {cliente?.nome || rotina.cliente || 'Não vinculada'}
                      </div>
                    </td>
                    <td>
                      <div className="rotinas-routine-name">
                        <strong>{rotina.nome}</strong>
                        <span>{rotina.categoria}</span>
                      </div>
                    </td>
                    <td><span className="rotinas-badge">{getRotinaFrequenciaLabel(rotina)}</span></td>
                    <td>{rotina.responsavel || 'Sem responsável'}</td>
                    <td><CalendarClock size={13} /> {formatDate(rotina.proximaExecucao)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedIds.size > 0 ? (
        <div className="rotinas-bulk-bar" role="region" aria-label="Alteração em lote">
          <strong><UsersRound size={15} /> {selectedIds.size} rotinas selecionadas</strong>
          <select
            className="rotinas-select"
            value={batchResponsibleId}
            onChange={(event) => onBatchResponsibleChange(event.target.value)}
            aria-label="Novo responsável das rotinas selecionadas"
          >
            <option value="">Selecione o novo responsável</option>
            {usuarios.map((usuario) => (
              <option key={usuario.configUsuarioId} value={usuario.configUsuarioId}>{usuario.nome}</option>
            ))}
          </select>
          <button
            type="button"
            className="rotinas-button rotinas-button--primary"
            disabled={!batchResponsibleId || isSaving}
            onClick={onApplyBatch}
          >
            {isSaving ? 'Aplicando...' : 'Alterar responsável'}
          </button>
          <button type="button" className="rotinas-button rotinas-button--secondary" onClick={onClearSelected}>
            Limpar seleção
          </button>
        </div>
      ) : null}
    </section>
  );
};
