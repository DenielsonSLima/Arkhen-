import React from 'react';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  UserRound,
} from 'lucide-react';
import {
  formatDateBR,
  type TarefaGestor,
} from '../../services/rotinasAtividadesService';
import {
  formatPersistedCompletionDateTime,
  getTarefaChecklistProgress,
  isTarefaFinalizada,
} from '../../utils/minhaFilaPresentation';
import './MinhaFilaTaskCard.css';

interface MinhaFilaTaskCardProps {
  task: TarefaGestor;
  isLate: boolean;
  isBlocked: boolean;
  onOpen: () => void;
}

const getCardStateClass = (task: TarefaGestor, isLate: boolean, isBlocked: boolean) => {
  if (task.status === 'Concluída') return 'is-completed';
  if (task.status === 'Cancelada') return 'is-cancelled';
  if (isLate) return 'is-late';
  if (isBlocked) return 'is-blocked';
  return 'is-pending';
};

export const MinhaFilaTaskCard: React.FC<MinhaFilaTaskCardProps> = ({
  task,
  isLate,
  isBlocked,
  onOpen,
}) => {
  const progress = getTarefaChecklistProgress(task);
  const showLate = isLate && !isTarefaFinalizada(task.status);
  const completionDateTime = task.status === 'Concluída'
    ? formatPersistedCompletionDateTime(task.dataHoraConclusao)
    : null;
  const titleId = `minha-fila-task-${task.id}-title`;
  const progressId = `minha-fila-task-${task.id}-progress`;

  return (
    <article
      className={`minha-fila-task-card ${getCardStateClass(task, showLate, isBlocked)}`}
      aria-labelledby={titleId}
    >
      <header className="minha-fila-task-card__header">
        <span className="minha-fila-task-card__status-icon" aria-hidden="true">
          {task.status === 'Concluída' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
        </span>
        <div className="minha-fila-task-card__heading">
          <span className="minha-fila-task-card__category">{task.categoria}</span>
          <h3 id={titleId}>{task.titulo}</h3>
        </div>
        <span className="minha-fila-task-card__status">{task.status}</span>
      </header>

      <p className="minha-fila-task-card__client">{task.cliente || 'Escritório'}</p>

      <div className="minha-fila-task-card__alerts" aria-label="Sinalizadores da tarefa">
        {showLate && <span className="minha-fila-task-card__chip is-danger">Atrasada</span>}
        {isBlocked && <span className="minha-fila-task-card__chip is-warning">Bloqueio</span>}
        <span className="minha-fila-task-card__chip">Prioridade {task.prioridade.toLowerCase()}</span>
      </div>

      <dl className="minha-fila-task-card__metadata">
        <div>
          <dt><CalendarDays size={14} aria-hidden="true" /> Prazo</dt>
          <dd>{formatDateBR(task.vencimento)}</dd>
        </div>
        <div>
          <dt><Clock3 size={14} aria-hidden="true" /> Frequência</dt>
          <dd>{task.frequencia}</dd>
        </div>
        <div className="minha-fila-task-card__responsible">
          <dt><UserRound size={14} aria-hidden="true" /> Responsável</dt>
          <dd>{task.responsavel || 'Sem responsável'}</dd>
        </div>
      </dl>

      <section className="minha-fila-task-card__progress" aria-labelledby={progressId}>
        <div className="minha-fila-task-card__progress-heading">
          <span id={progressId}>Progresso do checklist</span>
          <strong>{progress.percentage}%</strong>
        </div>
        <div
          className="minha-fila-task-card__progress-track"
          role="progressbar"
          aria-label={`Progresso de ${task.titulo}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percentage}
          aria-valuetext={`${progress.completed} de ${progress.total} etapas concluídas`}
        >
          <span style={{ width: `${progress.percentage}%` }} />
        </div>
        <span className="minha-fila-task-card__progress-count">
          {progress.completed}/{progress.total} concluídas
        </span>
      </section>

      {task.status === 'Concluída' && (
        <div className="minha-fila-task-card__completion">
          <CheckCircle2 size={15} aria-hidden="true" />
          {completionDateTime ? (
            <span>
              Concluída em <time dateTime={task.dataHoraConclusao}>{completionDateTime}</time>
            </span>
          ) : (
            <span>Horário de conclusão não registrado</span>
          )}
        </div>
      )}

      <footer className="minha-fila-task-card__footer">
        <button type="button" onClick={onOpen} aria-label={`Ver detalhes de ${task.titulo}`}>
          Ver detalhes <ArrowRight size={15} aria-hidden="true" />
        </button>
      </footer>
    </article>
  );
};
