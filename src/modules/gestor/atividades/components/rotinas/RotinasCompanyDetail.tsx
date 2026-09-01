import React, { useState } from 'react';
import { ArrowLeft, CalendarClock, Edit3, Link2, Plus, Repeat2, Trash2 } from 'lucide-react';
import type { ClienteEmpresa } from '../../services/atividadesService';
import type { UsuarioAtividade } from '../../services/rotinasAtividadesService';
import {
  getRotinaFrequenciaLabel,
  type RotinaCompanyGroup,
  type RotinaWorkspaceItem,
} from '../../utils/rotinasWorkspace';
import { CompanyCardIdentity } from '../../por-empresa/CompanyCardIdentity';

interface RotinasCompanyDetailProps {
  group: RotinaCompanyGroup<ClienteEmpresa>;
  usuarios: UsuarioAtividade[];
  activeModelIds: Set<string>;
  isSaving: boolean;
  onBack: () => void;
  onCreate: () => void;
  onEdit: (rotina: RotinaWorkspaceItem) => void;
  onDelete: (rotina: RotinaWorkspaceItem) => void;
  onAssign: (rotina: RotinaWorkspaceItem, responsibleId: string) => Promise<void>;
}

const formatDate = (value?: string) => {
  if (!value) return 'Não agendada';
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');
};

export const RotinasCompanyDetail: React.FC<RotinasCompanyDetailProps> = ({
  group,
  usuarios,
  activeModelIds,
  isSaving,
  onBack,
  onCreate,
  onEdit,
  onDelete,
  onAssign,
}) => {
  const [assigningId, setAssigningId] = useState('');

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
            logo={group.cliente.logo}
          />
        </div>

        <div className="rotinas-detail__actions">
          <button
            type="button"
            className="rotinas-button rotinas-button--primary"
            onClick={onCreate}
            disabled={isSaving}
            title="Criar uma rotina recorrente"
          >
            <Plus size={16} /> Nova rotina
          </button>
        </div>
      </header>

      {group.rotinas.length === 0 ? (
        <div className="rotinas-empty" style={{ border: 0, borderRadius: 0 }}>
          <Repeat2 size={34} />
          <h3>Esta empresa ainda não possui rotinas</h3>
          <p>
            Configure as obrigações no cadastro do parceiro ou crie uma rotina recorrente manual.
          </p>
          <button type="button" className="rotinas-button rotinas-button--primary" onClick={onCreate}>
            <Plus size={15} /> Criar primeira rotina
          </button>
        </div>
      ) : (
        <div className="rotinas-list">
          <div className="rotinas-list__head" aria-hidden="true">
            <span>Rotina</span>
            <span>Frequência</span>
            <span>Responsável</span>
            <span>Próxima execução</span>
            <span>Ações</span>
          </div>

          {group.rotinas.map((rotina) => {
            const isProtocolRoutine = Boolean(rotina.protocoloCodigo);
            const hasActiveModel = Boolean(rotina.modeloId && activeModelIds.has(rotina.modeloId));
            const hasInactiveModel = Boolean(rotina.modeloId && !hasActiveModel);
            const canEditManual = !isProtocolRoutine;
            const canAssign = true;
            return (
              <div className="rotinas-list__row" key={rotina.id}>
                <div className="rotinas-routine-name">
                  <strong>{rotina.nome}</strong>
                  <span>{rotina.categoria} · prioridade {rotina.prioridade.toLocaleLowerCase('pt-BR')}</span>
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
                  disabled={!canAssign || assigningId === rotina.id || isSaving}
                  title="Alterar responsável padrão"
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
                      <button
                        type="button"
                        className="rotinas-icon-button"
                        onClick={() => onEdit(rotina)}
                        disabled={!canEditManual || isSaving}
                        title="Editar rotina"
                        aria-label={`Editar ${rotina.nome}`}
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        className="rotinas-icon-button rotinas-icon-button--danger"
                        onClick={() => onDelete(rotina)}
                        disabled={isSaving}
                        title="Desativar rotina"
                        aria-label={`Desativar ${rotina.nome}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
