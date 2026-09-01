import React, { useId } from 'react';
import { X } from 'lucide-react';
import {
  formatDateBR,
  type TarefaGestor,
  type TarefaProgressoPatch,
} from '../services/rotinasAtividadesService';
import {
  formatPersistedCompletionDateTime,
  getTarefaChecklistProgress,
} from '../utils/minhaFilaPresentation';
import { useTarefaChecklistAudit } from '../hooks/useTarefaChecklistAudit';
import { useTaskDetailsDrawer } from '../hooks/useTaskDetailsDrawer';
import { TaskObservationEditor } from './task-details/TaskObservationEditor';

interface TaskDetailsDrawerProps {
  selectedTask: TarefaGestor;
  onClose: () => void;
  updateTarefa: (id: string, updates: TarefaProgressoPatch) => Promise<unknown>;
  toggleChecklist: (
    id: string,
    idx: number,
    checked: boolean,
    evidencia?: string,
    justificativa?: string,
  ) => Promise<unknown>;
}

export const TaskDetailsDrawer: React.FC<TaskDetailsDrawerProps> = ({
  selectedTask,
  onClose,
  updateTarefa,
  toggleChecklist,
}) => {
  const {
    completed: completedItems,
    total: totalItems,
    percentage: checklistPct,
  } = getTarefaChecklistProgress(selectedTask);
  const remainingItems = totalItems - completedItems;
  const titleId = useId();
  const completionDateTime = selectedTask.status === 'Concluída'
    ? formatPersistedCompletionDateTime(selectedTask.dataHoraConclusao)
    : null;
  const checklistAudit = useTarefaChecklistAudit(selectedTask.id);
  const drawer = useTaskDetailsDrawer({
    selectedTask,
    remainingItems,
    onClose,
    updateTarefa,
    toggleChecklist,
  });

  return (
    <div style={drawerBackdropStyle} onClick={onClose}>
      <aside
        ref={drawer.dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={drawer.isSavingObservation || drawer.pendingChecklistIndex !== null}
        tabIndex={-1}
        style={drawerStyle}
        onClick={(event) => event.stopPropagation()}
      >
        
        {/* Back / Close button bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            ref={drawer.closeButtonRef}
            type="button"
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              alignSelf: 'flex-start',
              gap: '8px',
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 600,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <X size={14} /> Fechar Detalhes
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#64748b', marginTop: '6px' }}>
            <span>Fila de Tarefas</span>
            <span>/</span>
            <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedTask.cliente || 'Escritório'}</span>
          </div>
        </div>

        {/* Premium Header Banner */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #c59235 0%, #aa7c28 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '1rem',
              flexShrink: 0,
            }}>
              {(selectedTask.cliente || 'E').substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 id={titleId} style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
                {selectedTask.titulo}
              </h2>
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '0.68rem',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontWeight: 700,
                  background: selectedTask.prioridade === 'Alta' ? '#fee2e2' : selectedTask.prioridade === 'Média' ? '#fff7ed' : '#f1f5f9',
                  color: selectedTask.prioridade === 'Alta' ? '#b91c1c' : selectedTask.prioridade === 'Média' ? '#c2410c' : '#475569',
                  border: '1px solid rgba(0,0,0,0.03)',
                }}>
                  {selectedTask.prioridade}
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontWeight: 700,
                  background: selectedTask.status === 'Concluída' ? '#d1fae5' : selectedTask.status === 'Em andamento' ? '#fef3c7' : '#f1f5f9',
                  color: selectedTask.status === 'Concluída' ? '#065f46' : selectedTask.status === 'Em andamento' ? '#92400e' : '#374151',
                  border: '1px solid rgba(0,0,0,0.03)',
                }}>
                  {selectedTask.status}
                </span>
              </div>
            </div>
          </div>

          {totalItems > 0 && (
            <div style={{ marginTop: '14px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                <span>PROGRESSO DO CHECKLIST</span>
                <span style={{ color: 'var(--color-gold-dark, #aa7c28)' }}>{checklistPct}%</span>
              </div>
              <div
                style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}
                role="progressbar"
                aria-label={`Progresso de ${selectedTask.titulo}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={checklistPct}
                aria-valuetext={`${completedItems} de ${totalItems} etapas concluídas`}
              >
                <div style={{ width: `${checklistPct}%`, height: '100%', background: 'linear-gradient(90deg, #c59235 0%, #aa7c28 100%)', transition: 'width 0.3s ease' }} />
              </div>
            </div>
          )}
        </div>

        {selectedTask.status === 'Concluída' && (
          <div
            style={{
              alignItems: 'center',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '10px',
              color: '#047857',
              display: 'flex',
              fontSize: '0.8rem',
              fontWeight: 700,
              gap: '8px',
              padding: '11px 12px',
            }}
          >
            <span aria-hidden="true">✓</span>
            {completionDateTime ? (
              <span>
                Concluída em{' '}
                <time dateTime={selectedTask.dataHoraConclusao}>{completionDateTime}</time>
              </span>
            ) : (
              <span>Horário de conclusão não registrado</span>
            )}
          </div>
        )}

        {/* Metadata Details Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '14px',
          fontSize: '0.8rem',
          color: '#475569',
        }}>
          <div>
            <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Empresa / Cliente</span>
            <strong style={{ color: '#0f172a' }}>{selectedTask.cliente || 'Escritório'}</strong>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Prazo / Vencimento</span>
            <strong style={{ color: '#0f172a' }}>{formatDateBR(selectedTask.vencimento)}</strong>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Frequência</span>
            <strong style={{ color: '#0f172a' }}>{selectedTask.frequencia}</strong>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Responsável</span>
            <strong style={{ color: '#0f172a' }}>{selectedTask.responsavel || 'Sem responsável'}</strong>
          </div>
        </div>

        {/* Observações / Bloqueio com persistência explícita e serializada. */}
        <TaskObservationEditor
          status={selectedTask.status}
          isReadOnly={drawer.isReadOnly}
          actionError={drawer.actionError}
          observationDraft={drawer.observationDraft}
          observationDirty={drawer.observationDirty}
          isSaving={drawer.isSavingObservation}
          onChange={drawer.changeObservation}
          onSave={drawer.saveObservation}
        />

        {/* Checklist Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
          <strong style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>Checklist de Etapas</strong>
          {drawer.pendingChecklistIndex !== null && (
            <span role="status" style={{ color: '#64748b', fontSize: '0.76rem', fontWeight: 700 }}>
              Salvando alteração do checklist...
            </span>
          )}
          {remainingItems === 1 && !drawer.isReadOnly && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
              Evidência ou justificativa da conclusão
              <textarea
                value={drawer.completionNote}
                onChange={(event) => drawer.changeCompletionNote(event.target.value)}
                disabled={drawer.pendingChecklistIndex !== null}
                rows={3}
                maxLength={4000}
                placeholder="Ex.: documentos conferidos e protocolo validado."
                aria-describedby={drawer.completionError ? 'task-completion-error' : undefined}
                style={{
                  border: drawer.completionError ? '1px solid #ef4444' : '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '10px',
                  font: 'inherit',
                  resize: 'vertical',
                }}
              />
              {drawer.completionError && (
                <span id="task-completion-error" role="alert" style={{ color: '#b91c1c', fontWeight: 600 }}>
                  {drawer.completionError}
                </span>
              )}
            </label>
          )}
          {selectedTask.checklist.length === 0 ? (
            <span style={{ color: '#64748b', fontSize: '0.82rem' }}>Nenhuma etapa cadastrada.</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedTask.checklist.map((item, idx) => {
                const isItemDone = item.concluida;
                const latestAudit = checklistAudit.latestByStep.get(idx);
                const completedAudit = latestAudit?.completed ? latestAudit : null;
                const completedAt = formatPersistedCompletionDateTime(completedAudit?.createdAt);
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      gap: '10px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      backgroundColor: isItemDone ? '#f0fdf4' : '#ffffff',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      <input
                        type="checkbox"
                        id={`step-${selectedTask.id}-${idx}`}
                        checked={isItemDone}
                        disabled={drawer.isReadOnly || drawer.pendingChecklistIndex !== null}
                        onChange={(event) => {
                          void drawer.changeChecklist(idx, event.target.checked);
                        }}
                        style={{
                          width: '16px',
                          height: '16px',
                          accentColor: '#c59235',
                          cursor: drawer.isReadOnly || drawer.pendingChecklistIndex !== null
                            ? 'not-allowed'
                            : 'pointer',
                        }}
                      />
                      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: '4px' }}>
                        <label
                          htmlFor={`step-${selectedTask.id}-${idx}`}
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 500,
                            color: '#0f172a',
                            cursor: drawer.isReadOnly || drawer.pendingChecklistIndex !== null
                              ? 'default'
                              : 'pointer',
                            textDecoration: isItemDone ? 'line-through' : 'none',
                            opacity: isItemDone ? 0.6 : 1,
                          }}
                        >
                          {item.titulo}
                        </label>
                        {isItemDone && (
                          <span
                            aria-live="polite"
                            style={{ color: '#047857', fontSize: '0.7rem', fontWeight: 600 }}
                          >
                            {completedAudit && completedAt ? (
                              <>
                                Concluído em{' '}
                                <time dateTime={completedAudit.createdAt}>{completedAt}</time>
                                {' '}por {completedAudit.actorName}
                              </>
                            ) : checklistAudit.isLoading ? (
                              'Carregando registro da conclusão...'
                            ) : checklistAudit.isError ? (
                              'Auditoria da conclusão indisponível.'
                            ) : (
                              'Registro autoritativo da conclusão não localizado.'
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    {isItemDone && (
                      <span style={{
                        fontSize: '0.72rem',
                        color: '#10b981',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#e6fbf1',
                        padding: '2px 8px',
                        borderRadius: '6px',
                      }}>
                        ✓ Concluído
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};

const drawerBackdropStyle = {
  position: 'fixed' as const,
  inset: 0,
  background: 'rgba(15, 23, 42, 0.24)',
  zIndex: 1200,
  display: 'flex',
  justifyContent: 'flex-end',
};

const drawerStyle = {
  width: 'min(520px, 100vw)',
  height: '100%',
  background: '#ffffff',
  borderLeft: '1px solid #e2e8f0',
  padding: '22px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '18px',
  boxShadow: '-18px 0 44px rgba(15, 23, 42, 0.16)',
  overflowY: 'auto' as const,
};
