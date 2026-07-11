import React from 'react';
import { CheckCircle2, Trash2 } from 'lucide-react';
import {
  formatDateBR,
  todayKey,
  type StatusAtividadeGestor,
  type TarefaGestor,
} from '../services/rotinasAtividadesService';

interface TarefaGestorListProps {
  tarefas: TarefaGestor[];
  emptyText: string;
  onUpdate: (id: string, patch: Partial<TarefaGestor>) => void;
  onDelete?: (id: string) => void;
  onToggleChecklist?: (taskId: string, index: number, concluida: boolean) => void;
}

const statusClass = (tarefa: TarefaGestor) => {
  if (tarefa.status === 'Concluída') return 'done';
  if (tarefa.vencimento < todayKey()) return 'late';
  if (tarefa.status === 'Em andamento') return 'progress';
  return 'pending';
};

export const TarefaGestorList: React.FC<TarefaGestorListProps> = ({
  tarefas,
  emptyText,
  onUpdate,
  onDelete,
  onToggleChecklist,
}) => {
  if (tarefas.length === 0) {
    return (
      <div className="empty-state-card">
        <CheckCircle2 size={36} className="empty-state-icon" />
        <p>{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="gestor-task-list">
      {tarefas.map((tarefa) => (
        <article key={tarefa.id} className={`gestor-task-card ${statusClass(tarefa)}`}>
          <div className="gestor-task-main">
            <div>
              <strong>{tarefa.titulo}</strong>
              <span>{tarefa.cliente} • {tarefa.responsavel}</span>
            </div>
            <div className="gestor-task-badges">
              <b>{tarefa.frequencia}</b>
              <b>{tarefa.categoria}</b>
              <b>{formatDateBR(tarefa.vencimento)}</b>
            </div>
          </div>

          {tarefa.checklist.length > 0 && (
            <div className="gestor-task-checklist">
              {tarefa.checklist.map((item, index) => (
                <label key={`${tarefa.id}-${item.titulo}`}>
                  <input
                    type="checkbox"
                    checked={item.concluida}
                    onChange={(event) => onToggleChecklist?.(tarefa.id, index, event.target.checked)}
                  />
                  <span>{item.titulo}</span>
                </label>
              ))}
            </div>
          )}

          <div className="gestor-task-footer">
            <select
              value={tarefa.status}
              onChange={(event) => onUpdate(tarefa.id, { status: event.target.value as StatusAtividadeGestor })}
            >
              <option value="Pendente">Pendente</option>
              <option value="Em andamento">Em andamento</option>
              <option value="Concluída">Concluída</option>
            </select>
            <input
              value={tarefa.notas}
              onChange={(event) => onUpdate(tarefa.id, { notas: event.target.value })}
              placeholder="Anotação do que foi feito ou pendente"
            />
            {onDelete && (
              <button type="button" onClick={() => onDelete(tarefa.id)} title="Excluir tarefa">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
};
