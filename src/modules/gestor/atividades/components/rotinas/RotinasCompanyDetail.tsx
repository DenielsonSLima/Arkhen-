import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, CalendarClock, CheckSquare2, Edit3, Layers3, Link2,
  Plus, Repeat2, Trash2, UsersRound, X,
} from 'lucide-react';
import type { ClienteEmpresa } from '../../services/atividadesService';
import type { UsuarioAtividade } from '../../services/rotinasAtividadesService';
import {
  getRotinaFrequenciaLabel,
  groupRotinasByCategory,
  type RotinaCompanyGroup,
  type RotinaWorkspaceItem,
} from '../../utils/rotinasWorkspace';
import { CompanyCardIdentity } from '../../por-empresa/CompanyCardIdentity';
import './RotinasCompanyDetail.css';

interface RotinasCompanyDetailProps {
  group: RotinaCompanyGroup<ClienteEmpresa>;
  canCreateRoutine: boolean;
  usuarios: UsuarioAtividade[];
  activeModelIds: Set<string>;
  selectedIds: Set<string>;
  batchResponsibleId: string;
  isSaving: boolean;
  onBack: () => void;
  onCreate: () => void;
  onEdit: (rotina: RotinaWorkspaceItem) => void;
  onDelete: (rotina: RotinaWorkspaceItem) => void;
  onAssign: (rotina: RotinaWorkspaceItem, responsibleId: string) => Promise<void>;
  onToggleSelected: (id: string) => void;
  onSetSelected: (ids: string[], selected: boolean) => void;
  onClearSelected: () => void;
  onBatchResponsibleChange: (responsibleId: string) => void;
  onApplyBatch: () => void;
}

interface SelectionCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  disabled?: boolean;
  onChange: () => void;
}

const SelectionCheckbox = ({
  checked,
  indeterminate = false,
  label,
  disabled = false,
  onChange,
}: SelectionCheckboxProps) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      aria-label={label}
    />
  );
};

const formatDate = (value?: string) => (
  value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : 'Não agendada'
);

export const RotinasCompanyDetail: React.FC<RotinasCompanyDetailProps> = ({
  group,
  canCreateRoutine,
  usuarios,
  activeModelIds,
  selectedIds,
  batchResponsibleId,
  isSaving,
  onBack,
  onCreate,
  onEdit,
  onDelete,
  onAssign,
  onToggleSelected,
  onSetSelected,
  onClearSelected,
  onBatchResponsibleChange,
  onApplyBatch,
}) => {
  const [assigningId, setAssigningId] = useState('');
  const categoryGroups = useMemo(() => groupRotinasByCategory(group.rotinas), [group.rotinas]);
  const allIds = group.rotinas.map((rotina) => rotina.id);
  const selectedCount = allIds.filter((id) => selectedIds.has(id)).length;
  const allSelected = allIds.length > 0 && selectedCount === allIds.length;

  const handleAssign = async (rotina: RotinaWorkspaceItem, responsibleId: string) => {
    if (!responsibleId || responsibleId === rotina.responsavelConfigUsuarioId) return;
    setAssigningId(rotina.id);
    try {
      await onAssign(rotina, responsibleId);
    } finally {
      setAssigningId('');
    }
  };

  return (
    <section className="rotinas-detail">
      <header className="rotinas-detail__header">
        <div className="rotinas-detail__identity">
          <button type="button" className="rotinas-back-button" onClick={onBack} aria-label="Voltar para empresas">
            <ArrowLeft size={18} />
          </button>
          <CompanyCardIdentity
            name={group.cliente.nome}
            cnpj={group.cliente.cnpj}
            regime={group.cliente.regime}
            tipoEstabelecimento={group.cliente.tipoEstabelecimento}
            partnerType={group.cliente.tipoParceiroNome}
            logo={group.cliente.logo}
          />
        </div>

        {canCreateRoutine ? <div className="rotinas-detail__actions">
          <button type="button" className="rotinas-button rotinas-button--primary" onClick={onCreate} disabled={isSaving}>
            <Plus size={16} /> Nova rotina
          </button>
        </div> : null}
      </header>

      {group.rotinas.length === 0 ? (
        <div className="rotinas-empty" style={{ border: 0, borderRadius: 0 }}>
          <Repeat2 size={34} />
          <h3>Esta empresa ainda não possui rotinas</h3>
          <p>
            {canCreateRoutine
              ? 'Configure as obrigações no cadastro do parceiro ou crie uma rotina recorrente manual.'
              : 'Rotinas contábeis ficam disponíveis somente para parceiros do tipo Cliente Contábil.'}
          </p>
          {canCreateRoutine ? <button type="button" className="rotinas-button rotinas-button--primary" onClick={onCreate}>
            <Plus size={15} /> Criar primeira rotina
          </button> : null}
        </div>
      ) : (
        <>
          <div className="rotinas-company-bulk" aria-label="Seleção e atribuição em lote">
            <div className="rotinas-company-bulk__selection">
              <button
                type="button"
                className="rotinas-button rotinas-button--secondary"
                onClick={() => onSetSelected(allIds, !allSelected)}
                disabled={isSaving}
              >
                <CheckSquare2 size={15} /> {allSelected ? 'Desmarcar todas' : 'Selecionar todas'}
              </button>
              <span>{selectedCount} de {group.rotinas.length} selecionadas</span>
              {selectedCount > 0 ? (
                <button type="button" className="rotinas-company-bulk__clear" onClick={onClearSelected}>
                  <X size={13} /> Limpar
                </button>
              ) : null}
            </div>
            <div className="rotinas-company-bulk__assign">
              <UsersRound size={16} aria-hidden="true" />
              <select
                className="rotinas-select"
                value={batchResponsibleId}
                onChange={(event) => onBatchResponsibleChange(event.target.value)}
                disabled={selectedCount === 0 || isSaving}
                aria-label="Novo responsável das rotinas selecionadas da empresa"
              >
                <option value="">Selecione o novo responsável</option>
                {usuarios.map((usuario) => (
                  <option key={usuario.configUsuarioId} value={usuario.configUsuarioId}>{usuario.nome}</option>
                ))}
              </select>
              <button
                type="button"
                className="rotinas-button rotinas-button--primary"
                disabled={!batchResponsibleId || selectedCount === 0 || isSaving}
                onClick={onApplyBatch}
              >
                {isSaving ? 'Aplicando...' : 'Definir responsável'}
              </button>
            </div>
          </div>

          <div className="rotinas-category-list">
            {categoryGroups.map((categoryGroup) => {
              const categoryIds = categoryGroup.rotinas.map((rotina) => rotina.id);
              const categorySelectedCount = categoryIds.filter((id) => selectedIds.has(id)).length;
              const categorySelected = categorySelectedCount === categoryIds.length;
              return (
                <section className="rotinas-category" key={categoryGroup.category}>
                  <header className="rotinas-category__header">
                    <SelectionCheckbox
                      checked={categorySelected}
                      indeterminate={categorySelectedCount > 0 && !categorySelected}
                      disabled={isSaving}
                      onChange={() => onSetSelected(categoryIds, !categorySelected)}
                      label={`Selecionar setor ${categoryGroup.label}`}
                    />
                    <span className="rotinas-category__icon"><Layers3 size={16} /></span>
                    <div>
                      <h3>{categoryGroup.label}</h3>
                      <span>{categoryGroup.rotinas.length} {categoryGroup.rotinas.length === 1 ? 'rotina' : 'rotinas'}</span>
                    </div>
                    {categorySelectedCount > 0 ? (
                      <strong>{categorySelectedCount} selecionada{categorySelectedCount === 1 ? '' : 's'}</strong>
                    ) : null}
                  </header>

                  <div className="rotinas-list">
                    <div className="rotinas-category__columns" aria-hidden="true">
                      <span /><span>Rotina</span><span>Frequência</span><span>Responsável</span>
                      <span>Próxima execução</span><span>Ações</span>
                    </div>

                    {categoryGroup.rotinas.map((rotina) => {
                      const isProtocolRoutine = Boolean(rotina.protocoloCodigo);
                      const hasActiveModel = Boolean(rotina.modeloId && activeModelIds.has(rotina.modeloId));
                      const hasInactiveModel = Boolean(rotina.modeloId && !hasActiveModel);
                      return (
                        <div className="rotinas-category__row" key={rotina.id}>
                          <SelectionCheckbox
                            checked={selectedIds.has(rotina.id)}
                            disabled={isSaving}
                            onChange={() => onToggleSelected(rotina.id)}
                            label={`Selecionar ${rotina.nome}`}
                          />
                          <div className="rotinas-routine-name">
                            <strong>{rotina.nome}</strong>
                            <span>Prioridade {rotina.prioridade.toLocaleLowerCase('pt-BR')}</span>
                            {isProtocolRoutine ? (
                              <span className="rotinas-badge rotinas-badge--source"><Link2 size={11} /> Configurada no parceiro</span>
                            ) : null}
                            {!isProtocolRoutine && hasInactiveModel ? (
                              <span className="rotinas-badge rotinas-badge--warning">Checklist desvinculado</span>
                            ) : null}
                          </div>
                          <span className="rotinas-badge"><Repeat2 size={11} /> {getRotinaFrequenciaLabel(rotina)}</span>
                          <select
                            className="rotinas-select"
                            value={rotina.responsavelConfigUsuarioId || ''}
                            onChange={(event) => { void handleAssign(rotina, event.target.value); }}
                            disabled={assigningId === rotina.id || isSaving}
                            aria-label={`Responsável por ${rotina.nome}`}
                          >
                            <option value="" disabled>Sem responsável — selecione um usuário</option>
                            {usuarios.map((usuario) => (
                              <option key={usuario.configUsuarioId} value={usuario.configUsuarioId}>{usuario.nome}</option>
                            ))}
                          </select>
                          <span><CalendarClock size={13} /> {formatDate(rotina.proximaExecucao)}</span>
                          <div className="rotinas-row-actions">
                            {!isProtocolRoutine ? (
                              <>
                                <button type="button" className="rotinas-icon-button" onClick={() => onEdit(rotina)} disabled={isSaving} aria-label={`Editar ${rotina.nome}`}>
                                  <Edit3 size={14} />
                                </button>
                                <button type="button" className="rotinas-icon-button rotinas-icon-button--danger" onClick={() => onDelete(rotina)} disabled={isSaving} aria-label={`Desativar ${rotina.nome}`}>
                                  <Trash2 size={14} />
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
};
